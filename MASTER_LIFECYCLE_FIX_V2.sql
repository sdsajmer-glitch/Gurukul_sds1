-- ==============================================================================
-- MASTER_LIFECYCLE_FIX_V2.sql
-- Goal: Fix "Child Profile Remove" error and enable Secondary Parent support
-- ==============================================================================

BEGIN;

-- [1] SCHEMA UPGRADE: Support Secondary Parent across lifecycle
ALTER TABLE public.enquiries
ADD COLUMN IF NOT EXISTS secondary_parent_name text,
ADD COLUMN IF NOT EXISTS secondary_parent_phone text,
ADD COLUMN IF NOT EXISTS secondary_parent_email text;

ALTER TABLE public.admissions
ADD COLUMN IF NOT EXISTS secondary_parent_name text,
ADD COLUMN IF NOT EXISTS secondary_parent_phone text,
ADD COLUMN IF NOT EXISTS secondary_parent_email text;

-- [2] ROBUST CONVERSION PROTOCOL (v5 - Includes Secondary Parent & Document migration)
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
  v_target_status text;
  v_existing_admission_id uuid;
BEGIN
  -- 1. Identity Resolution & Locking
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry not found.');
  END IF;

  -- 2. Idempotency Check
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Already promoted.',
        'admission_id', v_enquiry.admission_id
    );
  END IF;

  -- 3. Resolve Parent Identity (Primary)
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL AND v_enquiry.parent_email IS NOT NULL THEN
    SELECT id INTO v_parent_id FROM public.profiles 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_enquiry.parent_email)) 
    AND role = 'Parent/Guardian' LIMIT 1;
  END IF;

  -- 4. Map Status
  CASE v_enquiry.status
    WHEN 'ENQUIRY_VERIFIED' THEN v_target_status := 'Verified';
    WHEN 'ENQUIRY_IN_REVIEW' THEN v_target_status := 'Pending Review';
    ELSE v_target_status := 'Registered';
  END CASE;

  -- 5. Create Admission Record
  INSERT INTO public.admissions (
    branch_id, applicant_name, parent_name, parent_email, parent_phone, 
    secondary_parent_name, secondary_parent_phone, secondary_parent_email,
    grade, status, parent_id, profile_photo_url, submitted_at,
    date_of_birth, gender, medical_info, emergency_contact, address, notes
  ) VALUES (
    v_enquiry.branch_id::integer, v_enquiry.applicant_name, v_enquiry.parent_name, 
    v_enquiry.parent_email, v_enquiry.parent_phone, 
    v_enquiry.secondary_parent_name, v_enquiry.secondary_parent_phone, v_enquiry.secondary_parent_email,
    v_enquiry.grade, v_target_status, v_parent_id, v_enquiry.profile_photo_url, 
    COALESCE(v_enquiry.received_at, now()), v_enquiry.date_of_birth, 
    v_enquiry.gender, v_enquiry.medical_info, v_enquiry.emergency_contact, 
    v_enquiry.address, v_enquiry.notes
  ) RETURNING id INTO v_admission_id;

  -- 6. Migrate Vault Assets (Documents & Requirements)
  UPDATE public.document_requirements SET admission_id = v_admission_id, enquiry_id = NULL WHERE enquiry_id = p_enquiry_id;
  UPDATE public.admission_documents SET admission_id = v_admission_id, enquiry_id = NULL WHERE enquiry_id = p_enquiry_id;

  -- 7. Finalize State
  UPDATE public.enquiries SET 
    admission_id = v_admission_id, 
    conversion_state = 'CONVERTED',
    converted_at = now(),
    status = 'ENQUIRY_CONVERTED'
  WHERE id = p_enquiry_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Promoted successfully.', 
    'admission_id', v_admission_id
  );
END;
$$;

-- [3] FIX CHILD PORTAL VISIBILITY (The "Remove" Error Fix)
-- This ensures all 20 columns are returned and linking is robust.
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
  address text,
  source_type text,
  student_id_number text,
  school_name text,
  class_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    -- A. ADMISSIONS
    SELECT 
        a.id, a.applicant_name, a.parent_name, a.parent_email, a.parent_phone, 
        a.grade, a.status, a.date_of_birth, a.gender, a.profile_photo_url, 
        a.branch_id::integer, a.submitted_at, a.student_user_id, 
        a.emergency_contact, a.medical_info, a.address, 'Admission'::text as source_type,
        a.student_id_number, sb.name as school_name, sc.name as class_name
    FROM public.admissions a
    LEFT JOIN public.school_branches sb ON a.branch_id = sb.id
    LEFT JOIN public.student_profiles sp ON a.student_user_id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE a.parent_id = auth.uid()
       OR LOWER(TRIM(a.parent_email)) = LOWER(TRIM(COALESCE(
          (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), 
          (SELECT auth.jwt() ->> 'email'), 
          ''
       )))

    UNION ALL

    -- B. ENQUIRIES
    SELECT 
        e.id, e.applicant_name, e.parent_name, e.parent_email, e.parent_phone, 
        e.grade, e.status, e.date_of_birth, e.gender, e.profile_photo_url, 
        e.branch_id::integer, e.received_at as submitted_at, NULL::uuid as student_user_id, 
        e.emergency_contact, e.medical_info, e.address, 'Enquiry'::text as source_type,
        NULL::text as student_id_number, sb.name as school_name, NULL::text as class_name
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE (e.user_id = auth.uid() 
       OR LOWER(TRIM(e.parent_email)) = LOWER(TRIM(COALESCE(
          (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), 
          (SELECT auth.jwt() ->> 'email'), 
          ''
       ))))
      AND e.admission_id IS NULL
      AND (e.conversion_state IS DISTINCT FROM 'CONVERTED')
      AND e.is_deleted = false
    
    ORDER BY submitted_at DESC;
END;
$$;

COMMIT;
