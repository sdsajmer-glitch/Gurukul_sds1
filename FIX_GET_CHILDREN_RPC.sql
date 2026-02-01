-- ==============================================================================
-- FIX: Update get_my_children_profiles to include missing fields
-- This resolves the issue where Safety Contact and Clinical Disclosures appear blank
-- ==============================================================================

-- CRITICAL: Drop the existing function first because we are changing the return return type (adding columns)
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
  medical_info text
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
    a.student_user_id,
    a.emergency_contact,
    a.medical_info
  FROM public.admissions a
  WHERE a.parent_id = auth.uid()
     OR a.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  ORDER BY a.submitted_at DESC;
$$;

SELECT 'SUCCESS: get_my_children_profiles updated with emergency_contact and medical_info' as status;
