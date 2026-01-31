
-- ===============================================================================================
-- GURUKUL OS - CORE MISSION-CRITICAL RPC REGISTRY
-- This file restores essential business logic functions for onboarding and role management.
-- ===============================================================================================

BEGIN;

-- 1. Initialize School Administration Node
CREATE OR REPLACE FUNCTION public.initialize_school_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Update Role in Profile
  UPDATE public.profiles
  SET role = 'School Administration'
  WHERE id = v_user_id;

  -- Ensure School Admin Profile exists
  INSERT INTO public.school_admin_profiles (user_id, onboarding_step)
  VALUES (v_user_id, 'profile')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 2. Complete Institutional Onboarding Step
CREATE OR REPLACE FUNCTION public.complete_branch_step()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Mark Profile as Fully Operational
  UPDATE public.profiles
  SET profile_completed = true
  WHERE id = v_user_id;

  -- Update Internal Step Tracking
  UPDATE public.school_admin_profiles
  SET onboarding_step = 'completed'
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 3. Unified Faculty Profile Synchronizer
CREATE OR REPLACE FUNCTION public.upsert_teacher_profile(
  p_user_id uuid,
  p_display_name text,
  p_email text,
  p_phone text,
  p_department text,
  p_designation text,
  p_subject text,
  p_qualification text,
  p_experience numeric,
  p_doj date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync Core Identity
  UPDATE public.profiles
  SET display_name = p_display_name,
      phone = p_phone,
      role = 'Teacher'
  WHERE id = p_user_id;

  -- Sync Faculty Metadata
  INSERT INTO public.teacher_profiles (
    user_id, subject, qualification, experience_years, date_of_joining, department, designation
  )
  VALUES (
    p_user_id, p_subject, p_qualification, p_experience, p_doj, p_department, p_designation
  )
  ON CONFLICT (user_id) DO UPDATE SET
    subject = EXCLUDED.subject,
    qualification = EXCLUDED.qualification,
    experience_years = EXCLUDED.experience_years,
    date_of_joining = EXCLUDED.date_of_joining,
    department = EXCLUDED.department,
    designation = EXCLUDED.designation;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 4. Get Institutional Branches (Telemetry)
CREATE OR REPLACE FUNCTION public.get_school_branches()
RETURNS SETOF public.school_branches
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.school_branches 
  WHERE school_user_id = auth.uid() 
  OR id IN (SELECT branch_id FROM public.profiles WHERE id = auth.uid());
$$;


-- 5. Atomic Student Profile Sync
CREATE OR REPLACE FUNCTION public.upsert_student_profile(
  p_user_id uuid,
  p_display_name text,
  p_grade text,
  p_gender text,
  p_dob date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync Core Identity
  UPDATE public.profiles
  SET display_name = p_display_name,
      role = 'Student'
  WHERE id = p_user_id;

  -- Sync Student Metadata
  INSERT INTO public.student_profiles (
    user_id, grade, gender, date_of_birth
  )
  VALUES (
    p_user_id, p_grade, p_gender, p_dob
  )
  ON CONFLICT (user_id) DO UPDATE SET
    grade = EXCLUDED.grade,
    gender = EXCLUDED.gender,
    date_of_birth = EXCLUDED.date_of_birth;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 6. Atomic Parent/Guardian Sync
CREATE OR REPLACE FUNCTION public.upsert_parent_profile(
  p_user_id uuid,
  p_display_name text,
  p_relationship text,
  p_gender text,
  p_num_children integer,
  p_address text,
  p_city text,
  p_state text,
  p_country text,
  p_pin_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync Core Identity
  UPDATE public.profiles
  SET display_name = p_display_name,
      role = 'Parent/Guardian'
  WHERE id = p_user_id;

  -- Sync Guardian Metadata
  INSERT INTO public.parent_profiles (
    user_id, relationship_to_student, gender, number_of_children, address, city, state, country, pin_code
  )
  VALUES (
    p_user_id, p_relationship, p_gender, p_num_children, p_address, p_city, p_state, p_country, p_pin_code
  )
  ON CONFLICT (user_id) DO UPDATE SET
    relationship_to_student = EXCLUDED.relationship_to_student,
    gender = EXCLUDED.gender,
    number_of_children = EXCLUDED.number_of_children,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    country = EXCLUDED.country,
    pin_code = EXCLUDED.pin_code;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Transport Staff Profile Sync
CREATE OR REPLACE FUNCTION public.upsert_transport_profile(
  p_user_id uuid,
  p_display_name text,
  p_vehicle_details text,
  p_license_info text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET display_name = p_display_name,
      role = 'Transport Staff'
  WHERE id = p_user_id;

  INSERT INTO public.transport_staff_profiles (user_id, vehicle_details, license_info)
  VALUES (p_user_id, p_vehicle_details, p_license_info)
  ON CONFLICT (user_id) DO UPDATE SET
    vehicle_details = EXCLUDED.vehicle_details,
    license_info = EXCLUDED.license_info;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 8. Ecommerce Operator Profile Sync
CREATE OR REPLACE FUNCTION public.upsert_ecommerce_profile(
  p_user_id uuid,
  p_display_name text,
  p_store_name text,
  p_business_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET display_name = p_display_name,
      role = 'Ecommerce Operator'
  WHERE id = p_user_id;

  INSERT INTO public.ecommerce_operator_profiles (user_id, store_name, business_type)
  VALUES (p_user_id, p_store_name, p_business_type)
  ON CONFLICT (user_id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    business_type = EXCLUDED.business_type;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. Get All Classes (Admin)
CREATE OR REPLACE FUNCTION public.get_all_classes_for_admin()
RETURNS TABLE (
  id bigint,
  name text,
  grade_level text,
  section text,
  academic_year text,
  branch_name text,
  student_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id, c.name, c.grade_level, c.section, c.academic_year,
    b.name as branch_name,
    (SELECT COUNT(*) FROM public.student_profiles s WHERE s.assigned_class_id = c.id) as student_count
  FROM public.school_classes c
  LEFT JOIN public.school_branches b ON c.branch_id = b.id
  ORDER BY c.grade_level, c.name;
$$;


-- 10. Get Class Roster (Teacher/Admin)
CREATE OR REPLACE FUNCTION public.get_class_roster(p_class_id bigint)
RETURNS TABLE (
  student_id uuid,
  display_name text,
  email text,
  roll_number text,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id as student_id,
    p.display_name,
    p.email,
    s.roll_number,
    s.enrollment_status as status
  FROM public.student_profiles s
  JOIN public.profiles p ON s.user_id = p.id
  WHERE s.assigned_class_id = p_class_id;
$$;

-- 11. Update School Plan
CREATE OR REPLACE FUNCTION public.update_school_plan(p_plan_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.school_admin_profiles
  SET 
    plan_id = p_plan_id,
    onboarding_step = 'branches'
  WHERE user_id = auth.uid();
END;
$$;

COMMIT;
