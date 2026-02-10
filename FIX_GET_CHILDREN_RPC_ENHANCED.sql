-- ==============================================================================
-- FIX: Enhance get_my_children_profiles
-- Returns Student ID Number, School Name, and Class Name
-- usage: Parent Portal > Family Nodes
-- UPDATE: Filters out ENQUIRY_CONVERTED records to prevent displaying duplicate profiles
-- for the same child (one as Enquiry, one as Admission).
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
        'Admission'::text as source_type,
        a.student_id_number,
        sb.name as school_name,
        sc.name as class_name
    FROM public.admissions a
    LEFT JOIN public.school_branches sb ON a.branch_id = sb.id
    LEFT JOIN public.student_profiles sp ON a.student_user_id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE a.parent_id = auth.uid()
       OR LOWER(a.parent_email) = LOWER(COALESCE((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), (SELECT auth.jwt() ->> 'email'), ''))

    UNION ALL

    -- 2. Fetch from Enquiries
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
        e.address,
        'Enquiry'::text as source_type,
        NULL::text as student_id_number,
        sb.name as school_name,
        NULL::text as class_name
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE (e.user_id = auth.uid() OR LOWER(e.parent_email) = LOWER(COALESCE((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), (SELECT auth.jwt() ->> 'email'), '')))
      AND e.status != 'ENQUIRY_CONVERTED' -- FIX: Exclude converted enquiries to avoid duplicates
      AND e.admission_id IS NULL          -- FIX: Exclude enquiries already linked to an admission
    
    ORDER BY submitted_at DESC;
END;
$$;

SELECT 'SUCCESS: get_my_children_profiles updated to exclude CONVERTED enquiries' as status;
