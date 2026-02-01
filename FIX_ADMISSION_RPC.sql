-- ==============================================================================
-- FIX ADMISSION RPC V2
-- ==============================================================================
-- Creates the missing get_admissions_v2 function required by the Admission Vault.
-- Enforces row-level security by checking branch ownership/admin status.

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
