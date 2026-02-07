-- ==============================================================================
-- FIX: RESOLVE RPC AMBIGUITY FOR convert_enquiry_to_admission
-- ==============================================================================

BEGIN;

-- 1. DROP ALL conflicting signatures to ensure clean slate
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(text);
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(uuid);

-- 2. RE-CREATE the correct version (UUID inputs)
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
  v_existing_admission_id uuid;
BEGIN
  -- 1. Fetch current state with row-level lock (Concurrency Control)
  SELECT * INTO v_enquiry FROM public.enquiries e WHERE e.id = p_enquiry_id FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry node not found.');
  END IF;

  -- 2. Idempotency Check: Already converted?
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Enquiry already promoted to Admission Vault.',
      'admission_id', v_enquiry.admission_id
    );
  END IF;

  -- 3. Resolve Parent Identity
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL AND v_enquiry.parent_email IS NOT NULL THEN
    SELECT p.id INTO v_parent_id 
    FROM public.profiles p
    WHERE lower(p.email) = lower(v_enquiry.parent_email) AND p.role = 'Parent/Guardian'
    LIMIT 1;
  END IF;

  -- 4. Content-Based Matching (Prevent Duplicates if conversion was manual/partially failed)
  SELECT a.id INTO v_existing_admission_id 
  FROM public.admissions a
  WHERE lower(a.applicant_name) = lower(v_enquiry.applicant_name)
    AND lower(a.parent_email) = lower(v_enquiry.parent_email)
    AND a.grade = v_enquiry.grade
  LIMIT 1;

  IF v_existing_admission_id IS NOT NULL THEN
    -- Heal the link if it exists but wasn't recorded
    UPDATE public.enquiries SET 
      admission_id = v_existing_admission_id, 
      conversion_state = 'CONVERTED',
      converted_at = now()
    WHERE id = p_enquiry_id;
    
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Synchronized existing Admission record found.',
      'admission_id', v_existing_admission_id
    );
  END IF;

  -- 5. Create New Admission Record (Identity Node Promotion)
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

  -- 6. Seal Enquiry Stage
  UPDATE public.enquiries SET 
    admission_id = v_admission_id, 
    conversion_state = 'CONVERTED',
    converted_at = now(),
    status = 'ENQUIRY_CONVERTED'
  WHERE id = p_enquiry_id;

  -- 7. Log Operation (Audit)
  INSERT INTO public.audit_logs (user_id, action, module, details)
  VALUES (
    auth.uid(), 
    'ENQUIRY_PROMOTED', 
    'ENROLLMENT', 
    jsonb_build_object('enquiry_id', p_enquiry_id, 'admission_id', v_admission_id)
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Identity node promoted to Admission Vault successfully.',
    'admission_id', v_admission_id
  );
END;
$$;

COMMIT;
