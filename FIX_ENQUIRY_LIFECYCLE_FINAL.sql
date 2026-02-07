-- ==============================================================================
-- FIX ENQUIRY LIFECYCLE & ACCESS CONTROL
-- ==============================================================================
-- 1. Sync Enquiries schema with Admission requirements.
-- 2. Update Union RPC for Parent Portal.
-- 3. Enhance ID-based verification.
-- 4. Update Conversion Bridge.

BEGIN;

-- 1. ENHANCE ENQUIRIES SCHEMA
-- Add missing academic and clinical fields to enquiries to preserve data until conversion
ALTER TABLE public.enquiries 
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS medical_info text,
ADD COLUMN IF NOT EXISTS emergency_contact text;

-- 2. UPDATE PARENT PORTAL UNIFYING RPC
-- This RPC now returns both active Enquiries (Pending Admission) and existing Admissions
DROP FUNCTION IF EXISTS public.get_my_children_profiles();
CREATE OR REPLACE FUNCTION public.get_my_children_profiles()
RETURNS TABLE (
    id uuid,
    applicant_name text,
    parent_name text,
    parent_email text,
    parent_phone text,
    grade text,
    status text,
    date_of_birth date,
    gender text,
    profile_photo_url text,
    branch_id integer,
    submitted_at timestamptz,
    student_user_id uuid,
    emergency_contact text,
    medical_info text,
    source_type text -- 'Enquiry' or 'Admission'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    -- First, fetch genuine Admissions
    SELECT 
        a.id,
        a.applicant_name,
        a.parent_name,
        a.parent_email,
        a.parent_phone,
        a.grade,
        a.status,
        a.date_of_birth,
        a.gender,
        a.profile_photo_url,
        a.branch_id,
        a.submitted_at,
        a.student_user_id,
        a.emergency_contact,
        a.medical_info,
        'Admission'::text as source_type
    FROM public.admissions a
    WHERE a.parent_id = auth.uid()
       OR LOWER(a.parent_email) = (SELECT LOWER(p.email) FROM public.profiles p WHERE p.id = auth.uid())

    UNION ALL

    -- Second, fetch Enquiries that haven't been converted to Admissions yet
    -- This allows parents to see their "Applications" before they are converted by the school
    SELECT 
        e.id,
        e.applicant_name,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.grade,
        e.status,
        e.date_of_birth,
        e.gender,
        e.profile_photo_url,
        e.branch_id::integer,
        e.received_at as submitted_at,
        NULL::uuid as student_user_id,
        e.emergency_contact,
        e.medical_info,
        'Enquiry'::text as source_type
    FROM public.enquiries e
    WHERE (e.user_id = auth.uid() OR LOWER(e.parent_email) = (SELECT LOWER(p.email) FROM public.profiles p WHERE p.id = auth.uid()))
      AND (e.admission_id IS NULL OR e.conversion_state != 'CONVERTED')
      AND e.is_deleted = false;
END;
$$;

-- 3. ENHANCE CONVERSION BRIDGE (Copy clinical fields)
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
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id FOR UPDATE;
  
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
    SELECT id INTO v_parent_id 
    FROM public.profiles 
    WHERE lower(email) = lower(v_enquiry.parent_email) AND role = 'Parent/Guardian'
    LIMIT 1;
  END IF;

  -- 4. Content-Based Matching (Prevent Duplicates if conversion was manual/partially failed)
  SELECT id INTO v_existing_admission_id 
  FROM public.admissions 
  WHERE lower(applicant_name) = lower(v_enquiry.applicant_name)
    AND lower(parent_email) = lower(v_enquiry.parent_email)
    AND grade = v_enquiry.grade
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
