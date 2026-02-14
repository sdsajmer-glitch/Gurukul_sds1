-- ==============================================================================
-- MISSION CRITICAL: FINAL AMBIGUITY RESOLVER & IDENTITY SYNC REINFORCEMENT
-- ==============================================================================
-- Target: Finance Center, Enquiries, and Identity Node retrieval.
-- Fixes: "column reference 'profile_photo_url' is ambiguous"
-- Strategy:
--  1. Drop all potentially overloaded RPC signatures.
--  2. Use #variable_conflict use_column to prevent PL/pgSQL namespace collision.
--  3. Explicitly alias EVERY table and EVERY column in joins.
--  4. Define standardized photo priority: Master Profile -> Registry -> Archive.
-- ==============================================================================

BEGIN;

-- [1] CLEAN SLATE: Remove conflicting signatures
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all();
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(bigint);
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid);
DROP FUNCTION IF EXISTS public.get_student_financial_nodes(bigint);
DROP FUNCTION IF EXISTS public.get_all_enquiries_v2(bigint);

-- [2] UPGRADE: get_student_fee_summary_all (Accounts Tab)
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
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT 
        p.id as student_id,
        COALESCE(p.display_name, p.email) as display_name,
        -- PHOTO PRIORITY: Profiles (Master) -> Student Registry (Cache) -> Admissions (Historical)
        COALESCE(p.profile_photo_url, sp.profile_photo_url, a.profile_photo_url) as profile_photo_url,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds
    FROM public.profiles p
    INNER JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    LEFT JOIN (
        -- Sync latest photo from admissions node to ensure archive resilience
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

-- [3] UPGRADE: get_student_financial_node (Detail View)
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
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    -- Synchronize state before retrieval to ensure data integrity
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        p.id as student_id,
        COALESCE(p.display_name, p.email) as display_name,
        COALESCE(p.profile_photo_url, sp.profile_photo_url, a.profile_photo_url) as profile_photo_url,
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

-- [4] UPGRADE: get_student_financial_nodes (Plural / Multi-Node Handshake)
CREATE OR REPLACE FUNCTION public.get_student_financial_nodes(p_branch_id BIGINT DEFAULT NULL)
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
    is_standby BOOLEAN
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT 
        p.id as student_id,
        p.display_name,
        COALESCE(p.profile_photo_url, sp.profile_photo_url) as profile_photo_url,
        sp.grade,
        sc.name as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
        p.is_active,
        (NOT EXISTS (SELECT 1 FROM public.student_fee_assignments sfas WHERE sfas.student_id = p.id) 
         OR COALESCE(sfa.unallocated_funds, 0) > 0) as is_standby
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    AND p.role = 'Student'
    ORDER BY p.display_name ASC;
END;
$$;

-- [5] UPGRADE: get_all_enquiries_v2 (Enquiry Hub / LifeCycle Node)
CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    branch_id BIGINT,
    user_id UUID,
    enquiry_code TEXT,
    applicant_name TEXT,
    grade TEXT,
    status TEXT,
    verification_status TEXT,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    notes TEXT,
    conversion_state TEXT,
    admission_id UUID,
    is_archived BOOLEAN,
    is_deleted BOOLEAN,
    received_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    profile_photo_url TEXT,
    address TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
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
        -- Prioritize: Admission Profile > Enquiry Node > Parent Master Profile
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
            OR EXISTS (
                SELECT 1 
                FROM public.profiles admin_p 
                WHERE admin_p.id = auth.uid() 
                AND admin_p.role IN ('Super Admin', 'super_admin', 'School Administration')
            )
        )
    ORDER BY e.received_at DESC;
END;
$$;

-- [6] UPGRADE: get_grade_wise_collection_stats
CREATE OR REPLACE FUNCTION public.get_grade_wise_collection_stats(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    grade TEXT,
    section TEXT,
    total_students BIGINT,
    total_billed NUMERIC,
    total_collected NUMERIC,
    total_pending NUMERIC
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT 
        sp.grade,
        COALESCE(sc.section, 'A') as section,
        COUNT(DISTINCT sp.user_id) as total_students,
        COALESCE(SUM(fi.total_amount), 0) as total_billed,
        COALESCE(SUM(fi.paid_amount), 0) as total_collected,
        COALESCE(SUM(fi.total_amount - fi.paid_amount), 0) as total_pending
    FROM public.student_profiles sp
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.fee_invoices fi ON sp.user_id = fi.student_id AND fi.status != 'cancelled'
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    GROUP BY sp.grade, sc.section
    ORDER BY sp.grade;
END;
$$;

-- [7] Permissions Re-granting
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_nodes(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_grade_wise_collection_stats(bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Nuclear Ambiguity Fix Applied. All Finance RPCs hardened against profile_photo_url collisions.' as status;
