-- ==============================================================================
-- MISSION CRITICAL: IDENTITY PHOTO SYNCHRONIZATION PROTOCOL
-- ==============================================================================
-- 1. Rectifies the photo mismatch by prioritizing student-specific photo over parent.
-- 2. Ensures the conversion process maintains the source student photo.
-- 3. Standardizes retrieval RPCs for identity consistency across all portals.
-- ==============================================================================
DROP FUNCTION IF EXISTS public.get_all_enquiries_v2(bigint);
BEGIN;

-- 1. REFACTOR get_all_enquiries_v2 (Priority Fix)
-- We must prioritize e.profile_photo_url (target applicant) over p.profile_photo_url (parent user)
CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.enquiries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.branch_id,
        e.user_id,
        e.enquiry_code,
        e.applicant_name,
        e.grade,
        e.status,
        e.verification_status,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.notes,
        e.conversion_state,
        e.admission_id,
        e.is_archived,
        e.is_deleted,
        e.received_at,
        e.updated_at,
        e.converted_at,
        -- CRITICAL: Prioritize applicant photo (e) over parent profile (p)
        COALESCE(e.profile_photo_url, p.profile_photo_url) as profile_photo_url
    FROM public.enquiries e
    LEFT JOIN public.profiles p ON e.user_id = p.id
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE 
        (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        AND e.is_deleted = false
        AND (
            sb.school_user_id = auth.uid() 
            OR sb.branch_admin_id = auth.uid()
            OR e.branch_id IS NULL -- Allow global admins to see unassigned enquiries
        )
    ORDER BY e.received_at DESC;
END;
$$;

-- 2. REINFORCE get_admissions_v2
-- Ensure admissions also use their own photo column explicitly (already done in a.* but let's be safe)
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
    SELECT role, branch_id INTO v_user_role, v_user_branch_id FROM public.profiles WHERE id = auth.uid();

    RETURN QUERY
    SELECT a.*
    FROM public.admissions a
    WHERE 
        (
            (v_user_role IN ('School Administration', 'Super Admin', 'Principal', 'school_admin', 'super_admin') 
             AND (p_branch_id IS NULL OR a.branch_id = p_branch_id))
            OR
            (v_user_role IN ('Branch Admin', 'Teacher', 'Academic Coordinator', 'HR Manager', 'branch_admin', 'teacher') 
             AND a.branch_id = v_user_branch_id)
            OR
            EXISTS (
                SELECT 1 FROM public.school_branches sb
                WHERE sb.id = a.branch_id 
                AND (sb.school_user_id = auth.uid() OR sb.branch_admin_id = auth.uid())
            )
        )
    ORDER BY a.submitted_at DESC;
END;
$$;

-- 3. UPDATE convert_enquiry_to_admission (Data Integrity Check)
-- Ensure that when converting, we don't accidentally pull the parent's photo if the child has one.
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
  v_photo_url text;
BEGIN
  BEGIN
      v_enquiry_uuid := p_enquiry_id::uuid;
  EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'message', 'Invalid node identity format.');
  END;

  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_enquiry_uuid FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry node not found.');
  END IF;

  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Handshake already finalized.', 'admission_id', v_enquiry.admission_id);
  END IF;

  CASE v_enquiry.status
    WHEN 'ENQUIRY_VERIFIED' THEN v_target_status := 'Verified';
    WHEN 'ENQUIRY_IN_REVIEW' THEN v_target_status := 'Pending Review';
    ELSE v_target_status := 'Registered';
  END CASE;

  v_parent_id := v_enquiry.user_id;
  
  -- Resolve photo: Explicitly prefer enquiry photo
  v_photo_url := v_enquiry.profile_photo_url;

  INSERT INTO public.admissions (
    branch_id, applicant_name, parent_name, parent_email, parent_phone, 
    grade, status, parent_id, profile_photo_url, submitted_at,
    date_of_birth, gender, medical_info, emergency_contact
  ) VALUES (
    v_enquiry.branch_id, v_enquiry.applicant_name, v_enquiry.parent_name, 
    v_enquiry.parent_email, v_enquiry.parent_phone, v_enquiry.grade, 
    v_target_status, v_parent_id, v_photo_url, COALESCE(v_enquiry.received_at, now()),
    v_enquiry.date_of_birth, v_enquiry.gender, v_enquiry.medical_info, v_enquiry.emergency_contact
  ) RETURNING id INTO v_admission_id;

  UPDATE public.enquiries SET 
    admission_id = v_admission_id, 
    conversion_state = 'CONVERTED',
    converted_at = now(),
    status = 'ENQUIRY_CONVERTED'
  WHERE id = v_enquiry_uuid;

  RETURN jsonb_build_object('success', true, 'message', 'Identity promoted to Admission Vault', 'admission_id', v_admission_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admissions_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_admission(text) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Identity Photo Synchronization Protocol applied.' as status;
