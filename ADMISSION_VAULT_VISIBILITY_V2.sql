
-- ==============================================================================
-- MISSION CRITICAL: ADMISSION VAULT VISIBILITY PROTOCOL
-- ==============================================================================
-- 1. Robust Lifecycle Promotion: Inherits verified status from enquiry.
-- 2. Permissive Registry Fetch: Allows global admins to see all nodes.
-- 3. Ambiguity Resolution: Ensures single signature for promotion RPC.
-- ==============================================================================

BEGIN;

-- 1. DROP CONFLICTING SIGNATURES
DROP FUNCTION IF EXISTS public.get_admissions_v2(bigint);
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(uuid);
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(text);

-- 2. ENHANCED PROMOTION PROTOCOL
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
  v_target_status text;
BEGIN
  -- [1] Identity Resolution
  BEGIN
      v_enquiry_uuid := p_enquiry_id::uuid;
  EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'message', 'Invalid node identity format.');
  END;

  -- [2] Fetch Reference Node
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_enquiry_uuid FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry node not found.');
  END IF;

  -- [3] Idempotency Check
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Handshake already finalized.',
      'admission_id', v_enquiry.admission_id
    );
  END IF;

  -- [4] Smart Status Mapping
  -- If enquiry was already verified, promote as Verified. Otherwise, Registered.
  CASE v_enquiry.status
    WHEN 'ENQUIRY_VERIFIED' THEN v_target_status := 'Verified';
    WHEN 'ENQUIRY_IN_REVIEW' THEN v_target_status := 'Pending Review';
    ELSE v_target_status := 'Registered';
  END CASE;

  -- [5] Resolve Parent Identity (Identity Handshake)
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL AND v_enquiry.parent_email IS NOT NULL THEN
    SELECT id INTO v_parent_id 
    FROM public.profiles 
    WHERE lower(email) = lower(v_enquiry.parent_email)
    LIMIT 1;
  END IF;

  -- [6] Provision Admission Node
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
    v_enquiry.branch_id, 
    v_enquiry.applicant_name, 
    v_enquiry.parent_name, 
    v_enquiry.parent_email, 
    v_enquiry.parent_phone, 
    v_enquiry.grade, 
    v_target_status,
    v_parent_id,
    v_enquiry.profile_photo_url,
    COALESCE(v_enquiry.received_at, now()),
    v_enquiry.date_of_birth,
    v_enquiry.gender,
    v_enquiry.medical_info,
    v_enquiry.emergency_contact
  ) RETURNING id INTO v_admission_id;

  -- [7] Seal Enquiry Stage
  UPDATE public.enquiries SET 
    admission_id = v_admission_id, 
    conversion_state = 'CONVERTED',
    converted_at = now(),
    status = 'ENQUIRY_CONVERTED'
  WHERE id = v_enquiry_uuid;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Identity promoted to Admission Vault (' || v_target_status || ')', 
    'admission_id', v_admission_id
  );
END;
$$;

-- 3. PERMISSIVE VAULT RETRIEVAL
CREATE OR REPLACE FUNCTION public.get_admissions_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.admissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role text;
    v_user_branch_id bigint;
BEGIN
    -- [1] Get User Context
    SELECT role, branch_id INTO v_user_role, v_user_branch_id FROM public.profiles WHERE id = auth.uid();

    -- [2] Return Filtered Result Set
    RETURN QUERY
    SELECT a.*
    FROM public.admissions a
    WHERE 
        (
            -- [A] Global Admins (School/Super/Principal) can see all nodes or filter by branch
            (v_user_role IN ('School Administration', 'Super Admin', 'Principal', 'school_admin', 'super_admin') 
             AND (p_branch_id IS NULL OR a.branch_id = p_branch_id))
            OR
            -- [B] Branch Staff can see their specific cluster
            (v_user_role IN ('Branch Admin', 'Teacher', 'Academic Coordinator', 'HR Manager', 'branch_admin', 'teacher') 
             AND a.branch_id = v_user_branch_id)
            OR
            -- [C] Explicit check for branch management rights
            EXISTS (
                SELECT 1 FROM public.school_branches sb
                WHERE sb.id = a.branch_id 
                AND (sb.school_user_id = auth.uid() OR sb.branch_admin_id = auth.uid())
            )
        )
    ORDER BY a.submitted_at DESC;
END;
$$;

-- 4. GRANTS
GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_admission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admissions_v2(bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Admission vault visibility protocol deployed.' as status;
