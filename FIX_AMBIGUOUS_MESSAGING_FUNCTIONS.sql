-- ==============================================================================
-- MASTER FIX: AMBIGUOUS FUNCTION RESOLUTION (V6)
-- ==============================================================================
-- Resolves: "Could not choose the best candidate function"
-- This script wipes out conflicting function signatures and restores a 
-- resilient, single-signature messaging gateway.
-- ==============================================================================

BEGIN;

-- 1. DESTRUCTIVE CLEANUP (Remove all versioned signatures to clear ambiguity)
-- We drop both text and uuid versions of all messaging RPCs.

DROP FUNCTION IF EXISTS public.send_enquiry_message_v3(text, text);
DROP FUNCTION IF EXISTS public.send_enquiry_message_v3(uuid, text);

DROP FUNCTION IF EXISTS public.get_enquiry_timeline_v3(text);
DROP FUNCTION IF EXISTS public.get_enquiry_timeline_v3(uuid);

DROP FUNCTION IF EXISTS public.get_enquiry_timeline_v4(text);
DROP FUNCTION IF EXISTS public.get_enquiry_timeline_v4(uuid);

DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(text, text, text);

DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(uuid);
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(text);

-- 2. RESTORE AUTHORITATIVE SIGNATURES (Using TEXT for maximum frontend flexibility)

-- [A] SEND MESSAGE gateway
CREATE OR REPLACE FUNCTION public.send_enquiry_message_v3(
    p_enquiry_id text,
    p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enquiry_uuid uuid;
    v_is_admin boolean;
    v_has_access boolean := false;
    v_user_role text;
BEGIN
    -- [1] Identity Identification (Resilient Casting)
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid identity node identifier: ' || p_enquiry_id);
    END;

    -- [2] Role Resolution (Authoritative for Gurukul System)
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    v_is_admin := v_user_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher', 'HR Manager', 'Academic Coordinator');

    -- [3] Access Validation
    IF v_is_admin THEN
        -- Admin Access Check: Must match branch or be Global Admin
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            LEFT JOIN public.profiles p ON p.id = auth.uid()
            WHERE e.id = v_enquiry_uuid 
            AND (p.branch_id = e.branch_id OR p.role IN ('School Administration', 'Super Admin', 'Principal'))
        ) INTO v_has_access;
    ELSE
        -- Parent Access Check: Must own enquiry or match email
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = auth.uid() 
                OR LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
                OR LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email')
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Identity Handshake Denied. User role: ' || COALESCE(v_user_role, 'Unknown'));
    END IF;

    -- [4] Payload Insertion
    INSERT INTO public.enquiry_messages (
        enquiry_id,
        sender_id,
        message,
        is_admin,
        is_admin_message
    ) VALUES (
        v_enquiry_uuid,
        auth.uid(),
        p_message,
        v_is_admin,
        v_is_admin
    );

    -- [5] Pulse Update
    UPDATE public.enquiries SET updated_at = now() WHERE id = v_enquiry_uuid;

    RETURN jsonb_build_object('success', true, 'message', 'Transmission successful');
END;
$$;

-- [B] GET TIMELINE V3 (Used in Parent Portal)
CREATE OR REPLACE FUNCTION public.get_enquiry_timeline_v3(p_enquiry_id text)
RETURNS TABLE (
    id uuid,
    item_type text,
    created_at timestamptz,
    created_by_name text,
    is_admin boolean,
    details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enquiry_uuid uuid;
    v_user_role text;
    v_has_access boolean := false;
BEGIN
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

    IF v_user_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            LEFT JOIN public.profiles p ON p.id = auth.uid()
            WHERE e.id = v_enquiry_uuid 
            AND (p.branch_id = e.branch_id OR p.role IN ('School Administration', 'Super Admin'))
        ) INTO v_has_access;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = auth.uid() 
                OR LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
                OR LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email')
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, 'Authority Node') as created_by_name,
        COALESCE(m.is_admin, false) as is_admin,
        jsonb_build_object('message', m.message) as details
    FROM public.enquiry_messages m
    LEFT JOIN public.profiles p ON m.sender_id = p.id
    WHERE m.enquiry_id = v_enquiry_uuid
    UNION ALL
    SELECT
        e.id,
        'ENQUIRY_RECEIVED'::text as item_type,
        e.received_at as created_at,
        'System'::text as created_by_name,
        true as is_admin,
        jsonb_build_object('status', 'Identity Decrypted', 'context', e.applicant_name) as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid
    ORDER BY created_at ASC;
END;
$$;

-- [C] GET TIMELINE V4 (Used in Admin Modal - Includes Photos)
CREATE OR REPLACE FUNCTION public.get_enquiry_timeline_v4(p_enquiry_id text)
RETURNS TABLE (
    id uuid,
    item_type text,
    created_at timestamptz,
    created_by_name text,
    created_by_email text,
    sender_photo_url text,
    is_admin boolean,
    details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enquiry_uuid uuid;
    v_user_role text;
    v_has_access boolean := false;
BEGIN
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

    IF v_user_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            LEFT JOIN public.profiles p ON p.id = auth.uid()
            WHERE e.id = v_enquiry_uuid 
            AND (p.branch_id = e.branch_id OR p.role IN ('School Administration', 'Super Admin'))
        ) INTO v_has_access;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = auth.uid() 
                OR LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
                OR LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email')
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, 'Authority Node') as created_by_name,
        p.email as created_by_email,
        p.profile_photo_url as sender_photo_url,
        COALESCE(m.is_admin, false) as is_admin,
        jsonb_build_object('message', m.message) as details
    FROM public.enquiry_messages m
    LEFT JOIN public.profiles p ON m.sender_id = p.id
    WHERE m.enquiry_id = v_enquiry_uuid
    UNION ALL
    SELECT
        e.id,
        'ENQUIRY_RECEIVED'::text as item_type,
        e.received_at as created_at,
        'System'::text as created_by_name,
        'system'::text as created_by_email,
        NULL::text as sender_photo_url,
        true as is_admin,
        jsonb_build_object('status', 'Identity Decrypted', 'context', e.applicant_name) as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid
    ORDER BY created_at ASC;
END;
$$;

-- [D] UPDATE STATUS (Standardized for TEXT input)
CREATE OR REPLACE FUNCTION public.admin_update_enquiry_status(
    p_enquiry_id text,
    p_status text,
    p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_enquiry_uuid uuid;
BEGIN
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid identity node identifier');
    END;

    UPDATE public.enquiries
    SET 
        status = p_status,
        notes = p_notes,
        updated_at = now()
    WHERE id = v_enquiry_uuid;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- [E] CONVERT TO ADMISSION (Standardized for TEXT input)
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_admission(p_enquiry_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enquiry_uuid uuid;
  v_enquiry record;
  v_admission_id uuid;
  v_parent_id uuid;
  v_existing_admission_id uuid;
BEGIN
  -- 1. Identity Resolution
  BEGIN
      v_enquiry_uuid := p_enquiry_id::uuid;
  EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'message', 'Invalid node identity');
  END;

  -- 2. Fetch current state with row-level lock
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_enquiry_uuid FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry node not found.');
  END IF;

  -- 3. Idempotency Check
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Enquiry already promoted to Admission Vault.',
      'admission_id', v_enquiry.admission_id
    );
  END IF;

  -- 4. Resolve Parent Identity (Guru Identity Handshake)
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL AND v_enquiry.parent_email IS NOT NULL THEN
    SELECT id INTO v_parent_id 
    FROM public.profiles 
    WHERE lower(email) = lower(v_enquiry.parent_email) AND role = 'Parent/Guardian'
    LIMIT 1;
  END IF;

  -- 5. Content-Based Matching
  SELECT id INTO v_existing_admission_id 
  FROM public.admissions 
  WHERE lower(applicant_name) = lower(v_enquiry.applicant_name)
    AND lower(parent_email) = lower(v_enquiry.parent_email)
    AND grade = v_enquiry.grade
  LIMIT 1;

  IF v_existing_admission_id IS NOT NULL THEN
    UPDATE public.enquiries SET 
      admission_id = v_existing_admission_id, 
      conversion_state = 'CONVERTED',
      converted_at = now()
    WHERE id = v_enquiry_uuid;
    
    RETURN jsonb_build_object('success', true, 'message', 'Synchronized existing Admission record found.', 'admission_id', v_existing_admission_id);
  END IF;

  -- 6. Create New Admission Record
  INSERT INTO public.admissions (
    branch_id, 
    applicant_name, 
    parent_name, 
    parent_email, 
    parent_phone, 
    grade, 
    status,
    parent_id,
    profile_photo_url,
    submitted_at,
    date_of_birth,
    gender,
    medical_info,
    emergency_contact
  ) VALUES (
    v_enquiry.branch_id::integer, 
    v_enquiry.applicant_name, 
    v_enquiry.parent_name, 
    v_enquiry.parent_email, 
    v_enquiry.parent_phone, 
    v_enquiry.grade, 
    'Registered',
    v_parent_id,
    v_enquiry.profile_photo_url,
    COALESCE(v_enquiry.received_at, now()),
    v_enquiry.date_of_birth,
    v_enquiry.gender,
    v_enquiry.medical_info,
    v_enquiry.emergency_contact
  ) RETURNING id INTO v_admission_id;

  -- 7. Seal Enquiry Stage
  UPDATE public.enquiries SET 
    admission_id = v_admission_id, 
    conversion_state = 'CONVERTED',
    converted_at = now(),
    status = 'ENQUIRY_CONVERTED'
  WHERE id = v_enquiry_uuid;

  RETURN jsonb_build_object('success', true, 'message', 'Identity node promoted successfully.', 'admission_id', v_admission_id);
END;
$$;

-- 3. GRANTS
GRANT EXECUTE ON FUNCTION public.send_enquiry_message_v3(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_enquiry_message_v3(text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v3(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v3(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v4(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v4(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_update_enquiry_status(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_enquiry_status(text, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_admission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_admission(text) TO service_role;

COMMIT;

SELECT 'SUCCESS: Ambiguous messaging and lifecycle functions resolved.' as status;
