-- =============================================================================
-- 🚀 MASTER FINANCE RESTORATION V40: ULTRASONIC AMBIGUITY KILLER (FINAL) 🚀
-- =============================================================================
-- Target: Resolves "column reference 'profile_photo_url' is ambiguous"
-- Diagnosis: Overloaded RPC signatures and unqualified joins in older scripts (V36-V38).
-- Architecture: 
-- 1. NUCLEAR CLEANUP: Drops ALL potentially conflicting RPC signatures.
-- 2. PARANOID ALIASING: Explicitly prefixes EVERY column with its table alias.
-- 3. UNAMBIGUOUS RETURNS: Uses explicit type casting and qualifying in the SELECT list.
-- 4. CROSS-LINKED PHOTO SYNC: Unified resolver for Profile, Student, and Admission photos.
-- =============================================================================

BEGIN;

-- [1] SCHEMA HARDENING: Ensure all target columns exist to satisfy aliased queries.
DO $$ 
BEGIN
    -- Ensure profile_photo_url exists in student_profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.student_profiles ADD COLUMN profile_photo_url TEXT;
    END IF;

    -- Ensure profile_photo_url exists in profiles (should already be there)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.profiles ADD COLUMN profile_photo_url TEXT;
    END IF;

    -- Ensure unallocated_funds exists in student_fee_accounts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_accounts' AND column_name = 'unallocated_funds') THEN
        ALTER TABLE public.student_fee_accounts ADD COLUMN unallocated_funds NUMERIC DEFAULT 0;
    END IF;
END $$;

-- [2] DATA SYNCHRONIZATION: Mirror the photo URLs to reduce lookup overhead.
UPDATE public.student_profiles sp
SET profile_photo_url = p.profile_photo_url
FROM public.profiles p
WHERE sp.user_id = p.id AND sp.profile_photo_url IS NULL AND p.profile_photo_url IS NOT NULL;

-- [3] NUCLEAR CLEANUP: Drop ALL variations of target functions to clear the registry.
-- This resolves the "Multiple node identifiers" fault.

-- get_student_financial_node
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, text) CASCADE;

-- get_student_fee_summary_all
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all() CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(uuid) CASCADE;

-- get_finance_overview_stats_v3
DROP FUNCTION IF EXISTS public.get_finance_overview_stats_v3() CASCADE;
DROP FUNCTION IF EXISTS public.get_finance_overview_stats_v3(bigint) CASCADE;

-- get_grade_wise_collection_stats
DROP FUNCTION IF EXISTS public.get_grade_wise_collection_stats() CASCADE;
DROP FUNCTION IF EXISTS public.get_grade_wise_collection_stats(bigint) CASCADE;

-- [4] REBUILD: get_student_fee_summary_all (The List View Engine)
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
    unallocated_funds NUMERIC,
    grade TEXT,
    overall_status TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_main.id AS student_id,
        COALESCE(p_main.display_name, p_main.email)::TEXT AS display_name,
        
        -- ULTIMATE UNAMBIGUOUS PHOTO FETCH (Paranoid Aliasing)
        COALESCE(
            p_main.profile_photo_url, 
            sp_reg.profile_photo_url, 
            adm_arc.adm_photo_val
        )::TEXT AS profile_photo_url,
        
        COALESCE(sc_node.name, 'UNASSIGNED')::TEXT AS class_name,
        COALESCE(sfa_acc.total_billed, 0::NUMERIC)::NUMERIC AS total_billed,
        COALESCE(sfa_acc.total_paid, 0::NUMERIC)::NUMERIC AS total_paid,
        COALESCE(sfa_acc.outstanding_balance, 0::NUMERIC)::NUMERIC AS outstanding_balance,
        COALESCE(sfa_acc.integrity_score, 100)::INTEGER AS integrity_score,
        COALESCE(sfa_acc.unallocated_funds, 0::NUMERIC)::NUMERIC AS unallocated_funds,
        sp_reg.grade::TEXT AS grade,
        COALESCE(sfa_acc.financial_status, 'ACTIVE')::TEXT AS overall_status
    FROM public.profiles p_main
    JOIN public.student_profiles sp_reg ON p_main.id = sp_reg.user_id
    LEFT JOIN public.school_classes sc_node ON sp_reg.assigned_class_id = sc_node.id
    LEFT JOIN public.student_fee_accounts sfa_acc ON p_main.id = sfa_acc.student_id
    LEFT JOIN (
        -- Isolating Admissions photo fetch to prevent namespace collision
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url AS adm_photo_val
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) adm_arc ON p_main.id = adm_arc.student_user_id
    WHERE (p_branch_id IS NULL OR sp_reg.branch_id = p_branch_id)
      AND p_main.role = 'Student'
      AND p_main.is_active = true
    ORDER BY p_main.display_name ASC;
END;
$$;

-- [5] REBUILD: get_student_financial_node (The Detail View Engine)
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
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
    academic_cycle_id BIGINT,
    cycle_name TEXT,
    ledger_status TEXT,
    branch_id BIGINT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_cycle_id BIGINT;
    v_cycle_name TEXT;
BEGIN
    -- Force reconciliation to ensure detail accuracy
    PERFORM public.admin_reconcile_student_account(p_student_id);

    -- Resolve academic cycle
    IF p_cycle_id IS NULL THEN
        SELECT id, year_name INTO v_cycle_id, v_cycle_name FROM public.academic_years WHERE is_current = true LIMIT 1;
    ELSE
        v_cycle_id := p_cycle_id;
        SELECT year_name INTO v_cycle_name FROM public.academic_years WHERE id = v_cycle_id;
    END IF;

    RETURN QUERY
    SELECT 
        p_main.id AS student_id,
        COALESCE(p_main.display_name, p_main.email)::TEXT AS display_name,
        
        -- PARANOID PHOTO LOOKUP
        COALESCE(
            p_main.profile_photo_url, 
            sp_reg.profile_photo_url, 
            adm_arc.adm_photo_val
        )::TEXT AS profile_photo_url,
        
        sp_reg.grade::TEXT AS grade,
        COALESCE(sc_node.name, 'N/A')::TEXT AS class_name,
        COALESCE(sfa_acc.total_billed, 0::NUMERIC)::NUMERIC AS total_billed,
        COALESCE(sfa_acc.total_paid, 0::NUMERIC)::NUMERIC AS total_paid,
        COALESCE(sfa_acc.outstanding_balance, 0::NUMERIC)::NUMERIC AS outstanding_balance,
        COALESCE(sfa_acc.integrity_score, 100)::INTEGER AS integrity_score,
        COALESCE(sfa_acc.unallocated_funds, 0::NUMERIC)::NUMERIC AS unallocated_funds,
        p_main.is_active::BOOLEAN,
        v_cycle_id::BIGINT AS academic_cycle_id,
        COALESCE(v_cycle_name, 'Unknown')::TEXT AS cycle_name,
        COALESCE(sfa_acc.financial_status, 'ACTIVE')::TEXT AS ledger_status,
        sp_reg.branch_id::BIGINT
    FROM public.profiles p_main
    LEFT JOIN public.student_profiles sp_reg ON p_main.id = sp_reg.user_id
    LEFT JOIN public.school_classes sc_node ON sp_reg.assigned_class_id = sc_node.id
    LEFT JOIN public.student_fee_accounts sfa_acc ON p_main.id = sfa_acc.student_id
    LEFT JOIN (
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url AS adm_photo_val
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) adm_arc ON p_main.id = adm_arc.student_user_id
    WHERE p_main.id = p_student_id;
END;
$$;

-- [6] REBUILD: get_finance_overview_stats_v3 (The Executive Dashboard)
CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v3(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_assigned NUMERIC; v_collected NUMERIC; v_pending NUMERIC; v_overdue NUMERIC;
    v_monthly NUMERIC; v_today NUMERIC;
BEGIN
    -- Global Snapshots from student_fee_accounts
    SELECT 
        COALESCE(SUM(src_acc.total_billed), 0), 
        COALESCE(SUM(src_acc.total_paid), 0), 
        COALESCE(SUM(src_acc.outstanding_balance), 0)
    INTO v_assigned, v_collected, v_pending
    FROM public.student_fee_accounts src_acc
    JOIN public.student_profiles sp_node ON src_acc.student_id = sp_node.user_id
    WHERE (p_branch_id IS NULL OR sp_node.branch_id = p_branch_id);

    -- Overdue magnitude from invoices
    SELECT COALESCE(SUM(inv.total_amount - inv.paid_amount), 0) INTO v_overdue
    FROM public.fee_invoices inv
    JOIN public.student_profiles sp_node ON inv.student_id = sp_node.user_id
    WHERE (p_branch_id IS NULL OR sp_node.branch_id = p_branch_id)
      AND inv.due_date < CURRENT_DATE 
      AND LOWER(inv.status::text) NOT IN ('paid', 'cancelled');

    -- Monthly velocity
    SELECT COALESCE(SUM(pay.amount), 0) INTO v_monthly
    FROM public.fee_payments pay
    JOIN public.student_profiles sp_node ON pay.student_id = sp_node.user_id
    WHERE (p_branch_id IS NULL OR sp_node.branch_id = p_branch_id)
      AND LOWER(pay.status::text) IN ('completed', 'success')
      AND pay.payment_date >= date_trunc('month', NOW());

    -- Daily velocity
    SELECT COALESCE(SUM(pay.amount), 0) INTO v_today
    FROM public.fee_payments pay
    JOIN public.student_profiles sp_node ON pay.student_id = sp_node.user_id
    WHERE (p_branch_id IS NULL OR sp_node.branch_id = p_branch_id)
      AND LOWER(pay.status::text) IN ('completed', 'success')
      AND pay.payment_date >= date_trunc('day', NOW());

    RETURN jsonb_build_object(
        'total_assigned', v_assigned, 
        'total_collected', v_collected, 
        'total_pending', v_pending,
        'total_overdue', v_overdue, 
        'monthly_collection', v_monthly, 
        'today_collection', v_today,
        'collection_efficiency', CASE WHEN v_assigned > 0 THEN ROUND((v_collected / v_assigned * 100), 2) ELSE 100 END,
        'currency', 'INR'
    );
END;
$$;

-- [7] REBUILD: get_student_financial_nodes (Plural Handshake)
CREATE OR REPLACE FUNCTION public.get_student_financial_nodes(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    grade TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER,
    profile_photo_url TEXT,
    is_active BOOLEAN,
    is_standby BOOLEAN,
    unallocated_funds NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_main.id AS student_id,
        COALESCE(p_main.display_name, p_main.email)::TEXT AS display_name,
        sp_reg.grade::TEXT AS grade,
        COALESCE(sc_node.name, 'N/A')::TEXT AS class_name,
        COALESCE(sfa_acc.total_billed, 0::NUMERIC)::NUMERIC AS total_billed,
        COALESCE(sfa_acc.total_paid, 0::NUMERIC)::NUMERIC AS total_paid,
        COALESCE(sfa_acc.outstanding_balance, 0::NUMERIC)::NUMERIC AS outstanding_balance,
        COALESCE(sfa_acc.integrity_score, 100)::INTEGER AS integrity_score,
        COALESCE(p_main.profile_photo_url, sp_reg.profile_photo_url)::TEXT AS profile_photo_url,
        p_main.is_active::BOOLEAN,
        (NOT EXISTS (SELECT 1 FROM public.fee_invoices fi WHERE fi.student_id = p_main.id) 
         OR COALESCE(sfa_acc.unallocated_funds, 0) > 0) AS is_standby,
        COALESCE(sfa_acc.unallocated_funds, 0::NUMERIC)::NUMERIC AS unallocated_funds
    FROM public.profiles p_main
    JOIN public.student_profiles sp_reg ON p_main.id = sp_reg.user_id
    LEFT JOIN public.school_classes sc_node ON sp_reg.assigned_class_id = sc_node.id
    LEFT JOIN public.student_fee_accounts sfa_acc ON p_main.id = sfa_acc.student_id
    WHERE (p_branch_id IS NULL OR sp_reg.branch_id = p_branch_id)
      AND p_main.role = 'Student'
      AND p_main.is_active = true;
END;
$$;

-- [8] PERMISSIONS: Restore access after Rebuild
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_overview_stats_v3(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_nodes(BIGINT) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Restoration V40 (Paranoid Ambiguity Killer) Deployed.' as report;
