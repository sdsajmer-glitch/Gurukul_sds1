-- ==============================================================================
-- FIX: Update get_my_children_profiles to include missing ADDRESS field
-- This resolves the issue where Residential Address appears blank on edit
-- ==============================================================================

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
  address text,
  source_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    -- 1. Fetch from Admissions (Formal Applications)
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
        a.address,
        'Admission'::text as source_type
    FROM public.admissions a
    WHERE a.parent_id = auth.uid()
       OR LOWER(a.parent_email) = LOWER(COALESCE((SELECT email FROM public.profiles WHERE id = auth.uid()), (SELECT auth.jwt() ->> 'email'), ''))

    UNION ALL

    -- 2. Fetch from Enquiries (Draft/Initial Interest phases potentially created by parent)
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
        e.branch_id,
        e.created_at as submitted_at,
        NULL::uuid as student_user_id,
        e.emergency_contact,
        e.medical_info,
        e.address,
        'Enquiry'::text as source_type
    FROM public.enquiries e
    WHERE e.user_id = auth.uid()
       OR LOWER(e.parent_email) = LOWER(COALESCE((SELECT email FROM public.profiles WHERE id = auth.uid()), (SELECT auth.jwt() ->> 'email'), ''))
    
    ORDER BY submitted_at DESC;
END;
$$;

SELECT 'SUCCESS: get_my_children_profiles updated with ADDRESS and SOURCE_TYPE' as status;
