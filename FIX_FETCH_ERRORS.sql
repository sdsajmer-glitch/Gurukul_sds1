-- ==============================================================================
-- FIX FETCH ERRORS: ENQUIRY DESK & ADMISSION VAULT
-- ==============================================================================
-- Run this script in the Supabase SQL Editor to create the missing RPC functions.

BEGIN;

-- 1. FIX ENQUIRY DESK FETCH (get_all_enquiries_v2)
CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.enquiries
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT e.*
    FROM public.enquiries e
    JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE 
        -- Filter by specific branch if provided
        (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        AND
        (
            -- Access Control: User must own the branch OR be the assigned admin
            sb.school_user_id = auth.uid() 
            OR
            sb.branch_admin_id = auth.uid()
        )
        AND e.is_deleted = false
    ORDER BY e.received_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO service_role;


-- 2. FIX ADMISSION VAULT FETCH (get_admissions_v2)
CREATE OR REPLACE FUNCTION public.get_admissions_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.admissions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT a.*
    FROM public.admissions a
    JOIN public.school_branches sb ON a.branch_id = sb.id
    WHERE 
        -- Filter by specific branch if provided
        (p_branch_id IS NULL OR a.branch_id = p_branch_id)
        AND
        (
            -- Access Control: User must own the branch OR be the assigned admin
            sb.school_user_id = auth.uid() 
            OR
            sb.branch_admin_id = auth.uid()
        )
    ORDER BY a.submitted_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admissions_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admissions_v2(bigint) TO service_role;

COMMIT;
