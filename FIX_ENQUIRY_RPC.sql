-- ==============================================================================
-- FIX ENQUIRY RPC V2
-- ==============================================================================
-- Creates the missing get_all_enquiries_v2 function required by the Enquiry Desk.
-- Enforces row-level security by checking branch ownership/admin status.

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
        -- Filter by specific branch if provided, otherwise show all accessible
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
