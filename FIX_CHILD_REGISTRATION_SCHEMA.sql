-- ==============================================================================
-- FIX CHILD REGISTRATION SCHEMA
-- ==============================================================================
-- Ensures that 'enquiries' and 'admissions' tables have all the necessary columns
-- to support the Child Registration modal (Address, Medical Info, Emergency Contact).
-- Also updates the 'get_my_children_profiles' RPC to return these fields.
-- ==============================================================================

BEGIN;

-- 1. Add missing columns to ENQUIRIES
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS medical_info text;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS gender text;

-- 2. Add missing columns to ADMISSIONS
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS medical_info text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS gender text;

-- 3. Update the RPC to fetch these new fields
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
        a.branch_id::integer, 
        a.submitted_at, -- CORRECTED: Use submitted_at, not created_at
        a.student_user_id,
        a.emergency_contact,
        a.medical_info,
        a.address,
        'Admission'::text as source_type
    FROM public.admissions a
    WHERE a.parent_id = auth.uid()
       OR LOWER(a.parent_email) = LOWER(COALESCE((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), (SELECT auth.jwt() ->> 'email'), ''))

    UNION ALL

    -- 2. Fetch from Enquiries (Draft/Initial Interest)
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
        'Enquiry'::text as source_type
    FROM public.enquiries e
    WHERE e.user_id = auth.uid()
       OR LOWER(e.parent_email) = LOWER(COALESCE((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), (SELECT auth.jwt() ->> 'email'), ''))
    
    ORDER BY submitted_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_my_children_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_children_profiles() TO service_role;

COMMIT;
