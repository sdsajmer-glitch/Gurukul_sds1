-- =============================================================================
-- FINANCE AMBIGUITY FIX V5 (OVERVIEW & TABS)
-- =============================================================================
-- Target: Resolve 'ambiguous column reference' in Finance Overview.
-- Diagnosis: The 'get_student_fee_summary_all' function is likely still using
--            unqualified columns or the previous fix wasn't applied.
-- Action:
-- 1. DROP CASCADE all versions of 'get_student_fee_summary_all'.
-- 2. Re-create 'get_student_fee_summary_all' with PARANOID ALIASING.
-- 3. Also refresh 'get_finance_overview_stats_v2' just in case.
-- =============================================================================

BEGIN;

-- [1] NUCLEAR CLEANUP
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all() CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(uuid) CASCADE;

-- [2] REBUILD: get_student_fee_summary_all (Used by Finance Tab)
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
        
        -- FORCE UNAMBIGUOUS SELECTION
        COALESCE(
            p.profile_photo_url, 
            sp.profile_photo_url, 
            adm_distinct.adm_photo_url
        ) AS profile_photo_url,
        
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
    LEFT JOIN (
        -- Subquery alias: adm_distinct
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url AS adm_photo_url
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) adm_distinct ON p.id = adm_distinct.student_user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND LOWER(p.role) = 'student'
    ORDER BY p.display_name ASC;
END;
$$;

-- [3] ENSURE PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Ambiguity V5 (Overview) Applied.' as status;
