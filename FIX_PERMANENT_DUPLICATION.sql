-- ==============================================================================
-- FIX: PERMANENT Fix for Duplicate Child Profiles (Enquiry vs Admission)
-- 1. Cleans up existing data by linking orphaned Enquiries to Admissions.
-- 2. Updates `get_my_children_profiles` with strict deduplication logic.
-- ==============================================================================

BEGIN;

-- 1. DATA CLEANUP: Link orphaned Enquiries to Admissions
-- Matches based on Applicant Name, Parent Email, and Grade (Case Insensitive)
UPDATE public.enquiries e
SET 
    admission_id = a.id,
    status = 'ENQUIRY_CONVERTED',
    conversion_state = 'CONVERTED',
    converted_at = COALESCE(e.converted_at, now())
FROM public.admissions a
WHERE e.admission_id IS NULL
  AND e.status NOT IN ('ENQUIRY_CONVERTED', 'conveted', 'Converted')
  AND LOWER(TRIM(e.applicant_name)) = LOWER(TRIM(a.applicant_name))
  AND LOWER(TRIM(e.parent_email)) = LOWER(TRIM(a.parent_email))
  AND e.grade = a.grade;

-- 2. DATA CLEANUP: Ensure status is consistent for linked records
UPDATE public.enquiries e
SET status = 'ENQUIRY_CONVERTED'
WHERE admission_id IS NOT NULL 
  AND status != 'ENQUIRY_CONVERTED';


-- 3. PERMANENT FIX: Enhanced `get_my_children_profiles`
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
    -- 1. Fetch from Admissions (The Single Source of Truth for Enrolled Students)
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

    -- 2. Fetch from Enquiries (Only if NOT converted and NOT matching an existing admission)
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
      
      -- EXCLUSION 1: Must not be explicitly linked to an admission
      AND e.admission_id IS NULL
      
      -- EXCLUSION 2: Status check (Robust case-insensitive check)
      AND e.status NOT ILIKE '%converted%'
      
      -- EXCLUSION 3: Content-based deduplication (Prevent "Orphaned" duplicates)
      -- If an admission exists for this child, do not show the enquiry
      AND NOT EXISTS (
        SELECT 1 FROM public.admissions a 
        WHERE LOWER(TRIM(a.applicant_name)) = LOWER(TRIM(e.applicant_name))
          AND (
            LOWER(TRIM(a.parent_email)) = LOWER(TRIM(e.parent_email)) OR
            a.parent_id = auth.uid()
          )
          -- Optional: Match grade if needed, but Name+Email is usually sufficient and safer for duplicates
      )
    
    ORDER BY submitted_at DESC;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Permanent duplicate fix applied and data cleaned.' as status;
