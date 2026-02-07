-- ==============================================================================
-- FIX: PREVENT DUPLICATE PROFILES & RESOLVE RPC AMBIGUITY
-- ==============================================================================
-- 1. Fixes get_my_children_profiles to strictly exclude converted enquiries.
-- 2. Resolves any lingering ambiguity in column references.
-- ==============================================================================

BEGIN;

-- 1. Redefine get_my_children_profiles with STRICT filtering
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
    source_type text -- 'Enquiry' or 'Admission'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    -- 1. Fetch Admissions (The Source of Truth for Student Identity)
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
        CAST(a.branch_id AS INTEGER), 
        a.submitted_at,
        a.student_user_id,
        a.emergency_contact,
        a.medical_info,
        'Admission'::text as source_type
    FROM public.admissions a
    WHERE a.parent_id = auth.uid()
       OR LOWER(a.parent_email) = (SELECT LOWER(p.email) FROM public.profiles p WHERE p.id = auth.uid())

    UNION ALL

    -- 2. Fetch Enquiries (Only if NOT converted/linked to an admission)
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
        CAST(e.branch_id AS INTEGER),
        e.received_at as submitted_at,
        NULL::uuid as student_user_id,
        e.emergency_contact,
        e.medical_info,
        'Enquiry'::text as source_type
    FROM public.enquiries e
    WHERE (e.user_id = auth.uid() OR LOWER(e.parent_email) = (SELECT LOWER(p.email) FROM public.profiles p WHERE p.id = auth.uid()))
      AND e.admission_id IS NULL -- STRICT FILTER: If it has an admission_id, it is NOT shown here.
      AND e.is_deleted = false;
END;
$$;

COMMIT;
