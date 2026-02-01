-- ==============================================================================
-- FIX: ENROLLMENT LINKING & ROLE SWITCHING
-- ==============================================================================
-- 1. Update convert_enquiry_to_admission to link parent_id correctly.
-- 2. Create get_user_completed_roles to enable robust identity discovery.
-- 3. Improve switch_active_role to handle shadow profile creation.

BEGIN;

-- 1. UPDATE CONVERSION LOGIC
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_admission(p_enquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enquiry record;
  v_admission_id uuid;
  v_parent_id uuid;
BEGIN
  -- Fetch enquiry details
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id;
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry not found');
  END IF;

  -- Attempt to resolve parent_id (if the parent already has an account)
  v_parent_id := v_enquiry.user_id;
  
  IF v_parent_id IS NULL THEN
     v_parent_id := (SELECT id FROM public.profiles WHERE LOWER(email) = LOWER(v_enquiry.parent_email) LIMIT 1);
  END IF;

  -- Create Admission Record with parent_id linkage
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

  -- Mark enquiry as converted
  UPDATE public.enquiries 
  SET conversion_state = 'CONVERTED', 
      admission_id = v_admission_id,
      status = 'ENQUIRY_CONVERTED'
  WHERE id = p_enquiry_id;

  RETURN jsonb_build_object('success', true, 'admission_id', v_admission_id);
END;
$$;

-- 2. ROBUST IDENTITY DISCOVERY
CREATE OR REPLACE FUNCTION public.get_user_completed_roles()
RETURNS TABLE (
    role_name text,
    is_completed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    RETURN QUERY
    SELECT 'School Administration'::text, EXISTS(SELECT 1 FROM public.school_admin_profiles WHERE user_id = v_user_id)
    UNION ALL
    SELECT 'Parent/Guardian'::text, EXISTS(SELECT 1 FROM public.parent_profiles WHERE user_id = v_user_id)
    UNION ALL
    SELECT 'Teacher'::text, EXISTS(SELECT 1 FROM public.teacher_profiles WHERE user_id = v_user_id)
    UNION ALL
    SELECT 'Student'::text, EXISTS(SELECT 1 FROM public.student_profiles WHERE user_id = v_user_id);
END;
$$;

-- 3. IMPROVED ROLE SWITCHER
CREATE OR REPLACE FUNCTION public.switch_active_role(p_target_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_profile_exists boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Update the active role
  UPDATE public.profiles
  SET role = p_target_role
  WHERE id = v_user_id;

  -- Check if sub-profile exists for the target role
  CASE p_target_role
    WHEN 'School Administration' THEN SELECT EXISTS(SELECT 1 FROM public.school_admin_profiles WHERE user_id = v_user_id) INTO v_profile_exists;
    WHEN 'Parent/Guardian' THEN SELECT EXISTS(SELECT 1 FROM public.parent_profiles WHERE user_id = v_user_id) INTO v_profile_exists;
    WHEN 'Teacher' THEN SELECT EXISTS(SELECT 1 FROM public.teacher_profiles WHERE user_id = v_user_id) INTO v_profile_exists;
    WHEN 'Student' THEN SELECT EXISTS(SELECT 1 FROM public.student_profiles WHERE user_id = v_user_id) INTO v_profile_exists;
    ELSE v_profile_exists := true;
  END CASE;

  RETURN jsonb_build_object(
    'success', true, 
    'profile_restored', v_profile_exists,
    'target_role', p_target_role
  );
END;
$$;

COMMIT;
