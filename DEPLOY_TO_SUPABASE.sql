-- ============================================
-- DEPLOY TO SUPABASE: Fix FK Constraint Violation
-- Copy this ENTIRE content and paste into Supabase SQL Editor, then click Run
-- ============================================

-- Fix: upsert_parent_profile
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
DECLARE
  v_email text;
BEGIN
  -- Fetch email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  
  -- CRITICAL: Ensure profile exists FIRST (prevents FK violation)
  INSERT INTO public.profiles (id, email, display_name, role, profile_completed)
  VALUES (p_user_id, COALESCE(v_email, ''), p_display_name, 'Parent/Guardian', false)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = 'Parent/Guardian',
    updated_at = now();

  -- Then insert into parent_profiles
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

-- Fix: upsert_teacher_profile
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
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  
  INSERT INTO public.profiles (id, email, display_name, phone, role, profile_completed)
  VALUES (p_user_id, COALESCE(v_email, p_email, ''), p_display_name, p_phone, 'Teacher', false)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    phone = EXCLUDED.phone,
    role = 'Teacher',
    updated_at = now();

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

-- Fix: upsert_student_profile
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
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  
  INSERT INTO public.profiles (id, email, display_name, role, profile_completed)
  VALUES (p_user_id, COALESCE(v_email, ''), p_display_name, 'Student', false)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = 'Student',
    updated_at = now();

  INSERT INTO public.student_profiles (user_id, grade, gender, date_of_birth)
  VALUES (p_user_id, p_grade, p_gender, p_dob)
  ON CONFLICT (user_id) DO UPDATE SET
    grade = EXCLUDED.grade,
    gender = EXCLUDED.gender,
    date_of_birth = EXCLUDED.date_of_birth;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Fix: upsert_transport_profile
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
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  
  INSERT INTO public.profiles (id, email, display_name, role, profile_completed)
  VALUES (p_user_id, COALESCE(v_email, ''), p_display_name, 'Transport Staff', false)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = 'Transport Staff',
    updated_at = now();

  INSERT INTO public.transport_staff_profiles (user_id, vehicle_details, license_info)
  VALUES (p_user_id, p_vehicle_details, p_license_info)
  ON CONFLICT (user_id) DO UPDATE SET
    vehicle_details = EXCLUDED.vehicle_details,
    license_info = EXCLUDED.license_info;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Fix: upsert_ecommerce_profile
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
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  
  INSERT INTO public.profiles (id, email, display_name, role, profile_completed)
  VALUES (p_user_id, COALESCE(v_email, ''), p_display_name, 'Ecommerce Operator', false)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = 'Ecommerce Operator',
    updated_at = now();

  INSERT INTO public.ecommerce_operator_profiles (user_id, store_name, business_type)
  VALUES (p_user_id, p_store_name, p_business_type)
  ON CONFLICT (user_id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    business_type = EXCLUDED.business_type;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Done!
SELECT 'SUCCESS: All upsert functions have been patched!' as status;

-- ============================================
-- BONUS: Ensure handle_new_user trigger exists
-- This creates a profile automatically on user signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'Student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- EMERGENCY FIX: Create missing profile for current user
-- This manually creates a profile if it doesn't exist
-- ============================================

-- For the specific user demo_ps@gmail.com, create their profile if missing
INSERT INTO public.profiles (id, email, display_name, role, profile_completed)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'Parent/Guardian',
  false
FROM auth.users au
WHERE au.email = 'demo_ps@gmail.com'
ON CONFLICT (id) DO NOTHING;

-- Create profile for ALL users who don't have one
INSERT INTO public.profiles (id, email, display_name, role, profile_completed)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'Student',
  false
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO NOTHING;

SELECT 'COMPLETE: All fixes applied, missing profiles created!' as final_status;

-- ============================================
-- MISSING FUNCTION: get_my_children_profiles
-- This function returns all children (admissions) linked to the current parent
-- ============================================

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
  student_user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    a.student_user_id
  FROM public.admissions a
  WHERE a.parent_id = auth.uid()
     OR a.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  ORDER BY a.submitted_at DESC;
$$;

-- Also add parent_switch_student_view function if missing
CREATE OR REPLACE FUNCTION public.parent_switch_student_view(p_new_admission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admission record;
BEGIN
  -- Verify the admission belongs to this parent
  SELECT * INTO v_admission
  FROM public.admissions
  WHERE id = p_new_admission_id
    AND (parent_id = auth.uid() OR parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));
  
  IF v_admission IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Admission not found or access denied');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'admission_id', p_new_admission_id);
END;
$$;

SELECT 'SUCCESS: All functions deployed including get_my_children_profiles!' as status;
