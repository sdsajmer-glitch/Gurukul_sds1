-- ==============================================================================
-- FINAL ENQUIRY-ADMISSION FLOW & MESSAGING FIX
-- ==============================================================================
-- 1. Resolve Duplicate Admissions (Idempotency)
-- 2. Align Status Update with Promotion Workflow
-- 3. Enable Real-time for Messaging Reliability
-- 4. Fix Timeline Attribution (Name Fallbacks)
-- 5. Fix RLS for Cross-Stakeholder Visibility

BEGIN;

-- 1. DROP OVERLOADED FUNCTIONS
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(uuid);
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(text, text, text);

-- 2. IDEMPOTENT CONVERSION FUNCTION
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_admission(p_enquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enquiry record;
  v_admission_id uuid;
  v_parent_id uuid;
BEGIN
  -- Fetch current state
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry not found');
  END IF;

  -- IDEMPOTENCY CHECK: If already converted, don't create a new admission record
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Handshake already finalized. Redirecting to existing vault entry.',
        'admission_id', v_enquiry.admission_id,
        'already_converted', true
    );
  END IF;

  -- Resolve parent identity
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL THEN
     v_parent_id := (SELECT id FROM public.profiles WHERE LOWER(email) = LOWER(v_enquiry.parent_email) LIMIT 1);
  END IF;

  -- Create Admission Record
  INSERT INTO public.admissions (
    branch_id, 
    applicant_name, 
    parent_name, 
    parent_email, 
    parent_phone, 
    grade, 
    status,
    parent_id
  ) VALUES (
    v_enquiry.branch_id::integer, 
    v_enquiry.applicant_name, 
    v_enquiry.parent_name, 
    v_enquiry.parent_email, 
    v_enquiry.parent_phone, 
    v_enquiry.grade, 
    'Registered',
    v_parent_id
  ) RETURNING id INTO v_admission_id;

  -- Atomic state update for enquiry
  UPDATE public.enquiries 
  SET conversion_state = 'CONVERTED', 
      admission_id = v_admission_id,
      status = 'ENQUIRY_CONVERTED',
      converted_at = now(),
      updated_at = now()
  WHERE id = p_enquiry_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Identity node promoted to Admission Vault successfully.',
    'admission_id', v_admission_id
  );
END;
$$;

-- 3. ROBUST STATUS UPDATE (Handles implicit promotion)
CREATE OR REPLACE FUNCTION public.admin_update_enquiry_status(
    p_enquiry_id text,
    p_status text,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enquiry_uuid uuid;
BEGIN
    -- Safe cast
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid Identity Node ID');
    END;

    -- If status is 'ENQUIRY_CONVERTED', trigger the conversion logic instead of a simple update
    IF p_status = 'ENQUIRY_CONVERTED' THEN
        RETURN public.convert_enquiry_to_admission(v_enquiry_uuid);
    END IF;

    -- Standard Update
    UPDATE public.enquiries
    SET 
        status = p_status,
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = v_enquiry_uuid;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Node not found in registry');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. FIX TIMELINE ATTRIBUTION FALLBACKS
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
BEGIN
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    RETURN QUERY
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, p.email, 'Unknown User') as created_by_name,
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
        jsonb_build_object('status', 'Received') as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at ASC;
END;
$$;

-- 5. ENABLE REAL-TIME (Crucial for Reliability)
DO $$
BEGIN
    -- Check if publication exists, then add tables
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.enquiry_messages;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.enquiries;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 6. ENSURE RLS FOR MESSAGING
ALTER TABLE public.enquiry_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cross-stakeholder visibility" ON public.enquiry_messages;
CREATE POLICY "Cross-stakeholder visibility"
ON public.enquiry_messages
FOR SELECT
TO authenticated
USING (
    -- Admins can see all messages for enquiries they can access
    EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = enquiry_messages.enquiry_id
        AND (
            auth.jwt() ->> 'role' IN ('School Administration', 'Super Admin')
            OR e.branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
        )
    )
    OR
    -- Parents can see messages for their own enquiries
    EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = enquiry_messages.enquiry_id
        AND (e.user_id = auth.uid() OR e.parent_email = (auth.jwt() ->> 'email'))
    )
);

COMMIT;
