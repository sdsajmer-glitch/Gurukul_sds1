-- ==============================================================================
-- FIX: COLUMN REFERENCE "id" IS AMBIGUOUS
-- ==============================================================================
-- The "id" column in the EXISTS subquery was conflicting with the output parameter "id" 
-- of the function (PL/pgSQL variable collision).
-- Solution: We explicitly alias the subquery table as 'admin_p' and fully qualify columns.
-- ==============================================================================

BEGIN;

-- 1. DROP Existing Function to ensure clean replace
DROP FUNCTION IF EXISTS public.get_all_enquiries_v2(bigint);

-- 2. CREATE Robust Function with Qualified Columns
CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id bigint DEFAULT NULL)
RETURNS TABLE (
    id uuid,
    branch_id bigint,
    user_id uuid,
    enquiry_code text,
    applicant_name text,
    grade text,
    status text,
    verification_status text,
    parent_name text,
    parent_email text,
    parent_phone text,
    notes text,
    conversion_state text,
    admission_id uuid,
    is_archived boolean,
    is_deleted boolean,
    received_at timestamptz,
    updated_at timestamptz,
    converted_at timestamptz,
    profile_photo_url text,
    address text
)
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
        e.status::text,
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
        -- Prioritize: Admission Photo > Enquiry Photo > Parent Photo
        COALESCE(a.profile_photo_url, e.profile_photo_url, p.profile_photo_url) as profile_photo_url,
        e.address
    FROM public.enquiries e
    LEFT JOIN public.profiles p ON e.user_id = p.id
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    LEFT JOIN public.admissions a ON e.admission_id = a.id
    WHERE 
        (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        AND e.is_deleted = false
        AND (
            sb.school_user_id = auth.uid() 
            OR sb.branch_admin_id = auth.uid()
            OR e.branch_id IS NULL
            -- FIXED SUBQUERY: Aliased as 'admin_p' to avoid collision with output variable 'id'
            OR EXISTS (
                SELECT 1 
                FROM public.profiles admin_p 
                WHERE admin_p.id = auth.uid() 
                AND admin_p.role IN ('Super Admin', 'super_admin')
            )
        )
    ORDER BY e.received_at DESC;
END;
$$;

-- 3. Grant Permissions
GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO service_role;

COMMIT;

SELECT 'SUCCESS: RPC Query Ambiguity Resolved.' as status;
