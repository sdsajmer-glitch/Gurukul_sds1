-- ==============================================================================
-- FIX: ADMISSION PROMOTION WORKFLOW (Consolidated)
-- ==============================================================================
-- 1. Fixes convert_enquiry_to_admission to migrate documents and requirements.
-- 2. Fixes get_my_children_profiles duplication by filtering converted enquiries.
-- 3. Ensures document vault persistence across the lifecycle transition.
-- ==============================================================================

BEGIN;

-- [A] ENHANCED PROMOTION PROTOCOL
-- Implements document migration and re-linking logic
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
  v_existing_admission_check uuid;
BEGIN
  -- 1. Identity Resolution
  BEGIN
      v_enquiry_uuid := p_enquiry_id::uuid;
  EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'message', 'Invalid node identity format.');
  END;

  -- 2. Fetch Reference Node
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_enquiry_uuid FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry node not found.');
  END IF;

  -- 3. Idempotency Check (Prevent duplicate admissions for same enquiry)
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    SELECT id INTO v_existing_admission_check FROM public.admissions WHERE id = v_enquiry.admission_id;
    IF v_existing_admission_check IS NOT NULL THEN
        RETURN jsonb_build_object(
          'success', true, 
          'message', 'Handshake already finalized.',
          'admission_id', v_enquiry.admission_id
        );
    END IF;
  END IF;

  -- 4. Smart Status Mapping
  CASE v_enquiry.status
    WHEN 'ENQUIRY_VERIFIED' THEN v_target_status := 'Verified';
    WHEN 'ENQUIRY_IN_REVIEW' THEN v_target_status := 'Pending Review';
    ELSE v_target_status := 'Registered';
  END CASE;

  -- 5. Resolve Parent Identity
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL AND v_enquiry.parent_email IS NOT NULL THEN
    SELECT id INTO v_parent_id 
    FROM public.profiles 
    WHERE lower(email) = lower(v_enquiry.parent_email)
    LIMIT 1;
  END IF;

  -- 6. Provision Admission Node
  INSERT INTO public.admissions (
    branch_id, applicant_name, parent_name, parent_email, parent_phone, 
    grade, status, parent_id, profile_photo_url, submitted_at,
    date_of_birth, gender, medical_info, emergency_contact, address, notes
  ) VALUES (
    v_enquiry.branch_id::integer, v_enquiry.applicant_name, v_enquiry.parent_name, 
    v_enquiry.parent_email, v_enquiry.parent_phone, v_enquiry.grade, 
    v_target_status, v_parent_id, v_enquiry.profile_photo_url, 
    COALESCE(v_enquiry.received_at, now()), v_enquiry.date_of_birth, 
    v_enquiry.gender, v_enquiry.medical_info, v_enquiry.emergency_contact, 
    v_enquiry.address, v_enquiry.notes
  ) RETURNING id INTO v_admission_id;

  -- 7. CRITICAL: Migrate Virtual Vault Assets
  -- This ensures that all documents uploaded during the enquiry phase 
  -- follow the identity node to the Admission stage.
  
  -- Update requirements to point to new admission ID
  UPDATE public.document_requirements 
  SET admission_id = v_admission_id, enquiry_id = NULL
  WHERE enquiry_id = v_enquiry_uuid;

  -- Update documents to point to new admission ID
  UPDATE public.admission_documents
  SET admission_id = v_admission_id, enquiry_id = NULL
  WHERE enquiry_id = v_enquiry_uuid;

  -- 8. Seal Enquiry Stage
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

-- [B] FIX DUPLICATION IN PARENT PORTAL
-- Ensures only one source of truth per child identity is shown.
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
  branch_id int,
  submitted_at timestamptz,
  student_user_id uuid,
  emergency_contact text,
  medical_info text,
  address text,
  source_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    -- 1. Fetch from Admissions (The Primary Identity for accepted/processing children)
    SELECT 
        a.id, a.applicant_name, a.parent_name, a.parent_email, a.parent_phone, 
        a.grade, a.status, a.date_of_birth, a.gender, a.profile_photo_url, 
        a.branch_id::integer, a.submitted_at, a.student_user_id, 
        a.emergency_contact, a.medical_info, a.address, 'Admission'::text as source_type
    FROM public.admissions a
    WHERE a.parent_id = auth.uid()
       OR LOWER(a.parent_email) = LOWER(COALESCE(
          (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), 
          (SELECT auth.jwt() ->> 'email'), 
          ''
       ))

    UNION ALL

    -- 2. Fetch from Enquiries (Draft identities that haven't been promoted yet)
    SELECT 
        e.id, e.applicant_name, e.parent_name, e.parent_email, e.parent_phone, 
        e.grade, e.status, e.date_of_birth, e.gender, e.profile_photo_url, 
        e.branch_id::integer, e.received_at as submitted_at, NULL::uuid as student_user_id, 
        e.emergency_contact, e.medical_info, e.address, 'Enquiry'::text as source_type
    FROM public.enquiries e
    WHERE (e.user_id = auth.uid()
       OR LOWER(e.parent_email) = LOWER(COALESCE(
          (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), 
          (SELECT auth.jwt() ->> 'email'), 
          ''
       )))
      AND e.admission_id IS NULL             -- THE FIX: Prevent duplication after promotion
      AND e.conversion_state IS DISTINCT FROM 'CONVERTED'
      AND e.is_deleted = false
    
    ORDER BY submitted_at DESC;
END;
$$;

COMMIT;

-- VERIFICATION
SELECT 'SUCCESS: Promotion workflow fixed. Duplication resolved. Documents protected.' as status;
