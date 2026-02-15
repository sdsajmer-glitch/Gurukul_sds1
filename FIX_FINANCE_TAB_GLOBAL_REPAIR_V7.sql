-- =============================================================================
-- FINANCE REPAIR V7 (SAFE MODE)
-- =============================================================================
-- Purpose: Resolve "Ambiguous Column" error by simplifying the query.
-- Strategy: Reduce complexity in 'get_student_fee_summary_all'.
--           Remove complex COALESCE joins for profile photos temporarily
--           to restore system access.
-- =============================================================================

BEGIN;

-- [1] CLEANUP
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all() CASCADE;

-- [2] REBUILD: get_student_fee_summary_all (Simplified)
CREATE OR REPLACE FUNCTION public.get_student_fee_summary_all(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER,
    unallocated_funds NUMERIC
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS student_id,
        COALESCE(p.display_name, p.email) AS display_name,
        
        -- SIMPLIFIED: Only pull from main profile to avoid ambiguity
        p.profile_photo_url AS profile_photo_url,
        
        COALESCE(sc.name, 'UNASSIGNED') AS class_name,
        COALESCE(sfa.total_billed, 0) AS total_billed,
        COALESCE(sfa.total_paid, 0) AS total_paid,
        COALESCE(sfa.outstanding_balance, 0) AS outstanding_balance,
        COALESCE(sfa.integrity_score, 100) AS integrity_score,
        COALESCE(sfa.unallocated_funds, 0) AS unallocated_funds
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND LOWER(p.role) = 'student'
    ORDER BY p.display_name ASC;
END;
$$;

-- [3] GRANTS
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Repair V7 (Safe Mode) Applied.' as status;
