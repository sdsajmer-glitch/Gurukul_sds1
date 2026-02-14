
-- ==============================================================================
-- FINANCE IDENTITY PROTOCOL V3 - PHOTO & ATTRIBUTE SYNCHRONIZATION
-- ==============================================================================
-- Target: Ensures student photos and identities are correctly resolved from the 
--         most recent node in the lifecycle (Admission -> Student Profile -> Profile).
-- ==============================================================================

BEGIN;

-- 1. Upgrade get_student_financial_node (Detail View)
CREATE OR REPLACE FUNCTION public.get_student_financial_node(p_student_id UUID)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER,
    unallocated_funds NUMERIC,
    is_active BOOLEAN,
    academic_cycle TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Reconcile state before retrieval
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        p.id as student_id,
        COALESCE(p.display_name, p.email) as display_name,
        -- MASTER PHOTO COALESCE: Prefer Admission (Latest) > Student Registry > Profile Node
        COALESCE(a.profile_photo_url, sp.profile_photo_url, p.profile_photo_url) as profile_photo_url,
        COALESCE(sp.grade, 'N/A') as grade,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
        p.is_active,
        '2023-24'::TEXT as academic_cycle 
    FROM public.profiles p
    LEFT JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    LEFT JOIN public.admissions a ON p.id = a.student_user_id
    WHERE p.id = p_student_id;
END;
$$;

-- 2. Upgrade get_student_fee_summary_all (Accounts Tab)
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
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as student_id,
        COALESCE(p.display_name, p.email) as display_name,
        -- MASTER PHOTO COALESCE: Ensure list view also gets the latest identity artifact
        COALESCE(a.profile_photo_url, sp.profile_photo_url, p.profile_photo_url) as profile_photo_url,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    LEFT JOIN (
        -- Subquery to get latest admission photo per student to avoid duplicates
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        WHERE student_user_id IS NOT NULL
        ORDER BY student_user_id, registered_at DESC
    ) a ON p.id = a.student_user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND p.role = 'Student'
    ORDER BY p.display_name ASC;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Finance Identity Protocol V3 applied. Photo synchronization reinforced.' as status;
