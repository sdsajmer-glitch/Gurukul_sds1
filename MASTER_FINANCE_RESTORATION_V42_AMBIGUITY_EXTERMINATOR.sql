-- =============================================================================
-- 🚀 MASTER FINANCE RESTORATION V42: AMBIGUITY EXTERMINATOR (NUCLEAR) 🚀
-- =============================================================================
-- Target: Permanently resolve "column reference 'profile_photo_url' is ambiguous"
-- Diagnosis: Overlapping columns in profiles and student_profiles, combined with
--            unqualified joins in legacy/cached RPCs.
-- 
-- Strategy:
-- 1. SCHEMA SANITIZATION: Drops redundant photo columns from extension tables.
-- 2. IDENTITY CONSOLIDATION: Unifies photos in public.profiles.
-- 3. PARANOID RPC REBUILD: Strictly qualifies EVERY column in joint queries.
-- 4. SIGNATURE PURGE: Deletes all variations of overloaded functions.
-- =============================================================================

BEGIN;

-- [1] SCHEMA SANITIZATION: Remove the source of ambiguity
-- We only want profile_photo_url to exist in the 'profiles' table.
DO $$ 
BEGIN
    -- Remove from student_profiles (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.student_profiles DROP COLUMN profile_photo_url;
    END IF;

    -- Remove from finance_student_profiles (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.finance_student_profiles DROP COLUMN profile_photo_url;
    END IF;
    
    -- Ensure it exists in profiles (Identity Owner)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.profiles ADD COLUMN profile_photo_url TEXT;
    END IF;
END $$;

-- [2] IDENTITY CONSOLIDATION: Backfill photos from Admissions to Profiles
UPDATE public.profiles p
SET profile_photo_url = a.profile_photo_url
FROM public.admissions a
WHERE p.id = a.student_user_id
  AND (p.profile_photo_url IS NULL OR p.profile_photo_url = '')
  AND a.profile_photo_url IS NOT NULL;

-- [3] NUCLEAR CLEANUP: Drop ALL variations of target functions
-- get_student_financial_node
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, text) CASCADE;

-- get_student_financial_nodes
DROP FUNCTION IF EXISTS public.get_student_financial_nodes() CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_nodes(bigint) CASCADE;

-- get_student_fee_summary_all
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all() CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(bigint) CASCADE;

-- [4] REBUILD: get_student_fee_summary_all (The Executive Registry)
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
        
        -- STRICTLY QUALIFIED IDENTITY LOOKUP
        COALESCE(
            p_main.profile_photo_url, 
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
    INNER JOIN public.student_profiles sp_reg ON p_main.id = sp_reg.user_id
    LEFT JOIN public.school_classes sc_node ON sp_reg.assigned_class_id = sc_node.id
    LEFT JOIN public.student_fee_accounts sfa_acc ON p_main.id = sfa_acc.student_id
    LEFT JOIN (
        -- Subquery prevents any namespace collision with 'admissions' table columns
        SELECT DISTINCT ON (student_user_id) 
            student_user_id AS arc_student_id, 
            profile_photo_url AS adm_photo_val
        FROM public.admissions
        ORDER BY student_user_id, submitted_at DESC
    ) adm_arc ON p_main.id = adm_arc.arc_student_id
    WHERE (p_branch_id IS NULL OR sp_reg.branch_id = p_branch_id)
      AND p_main.role = 'Student'
      AND p_main.is_active = true
    ORDER BY p_main.display_name ASC;
END;
$$;

-- [5] REBUILD: get_student_financial_node (The Precision Detail Node)
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
    -- Ensure summary data is refreshed
    PERFORM public.admin_reconcile_student_account(p_student_id);

    -- Resolve academic cycle
    IF p_cycle_id IS NULL THEN
        SELECT ay_node.id, ay_node.year_name INTO v_cycle_id, v_cycle_name FROM public.academic_years ay_node WHERE ay_node.is_current = true LIMIT 1;
    ELSE
        v_cycle_id := p_cycle_id;
        SELECT ay_node.year_name INTO v_cycle_name FROM public.academic_years ay_node WHERE ay_node.id = v_cycle_id;
    END IF;

    RETURN QUERY
    SELECT 
        pm.id AS student_id,
        COALESCE(pm.display_name, pm.email)::TEXT AS display_name,
        
        -- PARANOID IDENTITY LOOKUP
        COALESCE(
            pm.profile_photo_url, 
            adm_arc.adm_photo_val
        )::TEXT AS profile_photo_url,
        
        sp_node.grade::TEXT AS grade,
        COALESCE(cl_node.name, 'N/A')::TEXT AS class_name,
        COALESCE(sfa.total_billed, 0::NUMERIC)::NUMERIC AS total_billed,
        COALESCE(sfa.total_paid, 0::NUMERIC)::NUMERIC AS total_paid,
        COALESCE(sfa.outstanding_balance, 0::NUMERIC)::NUMERIC AS outstanding_balance,
        COALESCE(sfa.integrity_score, 100)::INTEGER AS integrity_score,
        COALESCE(sfa.unallocated_funds, 0::NUMERIC)::NUMERIC AS unallocated_funds,
        pm.is_active::BOOLEAN,
        v_cycle_id::BIGINT AS academic_cycle_id,
        COALESCE(v_cycle_name, 'Unknown')::TEXT AS cycle_name,
        COALESCE(sfa.financial_status, 'ACTIVE')::TEXT AS ledger_status,
        sp_node.branch_id::BIGINT
    FROM public.profiles pm
    LEFT JOIN public.student_profiles sp_node ON pm.id = sp_node.user_id
    LEFT JOIN public.school_classes cl_node ON sp_node.assigned_class_id = cl_node.id
    LEFT JOIN public.student_fee_accounts sfa ON pm.id = sfa.student_id
    LEFT JOIN (
        SELECT DISTINCT ON (student_user_id) 
            student_user_id AS arc_student_id, 
            profile_photo_url AS adm_photo_val
        FROM public.admissions
        ORDER BY student_user_id, submitted_at DESC
    ) adm_arc ON pm.id = adm_arc.arc_student_id
    WHERE pm.id = p_student_id;
END;
$$;

-- [6] REBUILD: get_student_financial_nodes (The Plural Registry Proxy)
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
        res.student_id, res.display_name, res.grade, res.class_name, 
        res.total_billed, res.total_paid, res.outstanding_balance, res.integrity_score, 
        res.profile_photo_url, res.overall_status = 'ACTIVE' as is_active,
        (res.total_billed = 0 OR res.unallocated_funds > 0) as is_standby,
        res.unallocated_funds
    FROM public.get_student_fee_summary_all(p_branch_id) res;
END;
$$;

-- [7] REBUILD: get_grade_wise_collection_stats (Chart Data)
CREATE OR REPLACE FUNCTION public.get_grade_wise_collection_stats(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    grade TEXT,
    total_students BIGINT,
    total_billed NUMERIC,
    total_collected NUMERIC,
    total_pending NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp_node.grade::TEXT,
        COUNT(DISTINCT sp_node.user_id)::BIGINT,
        COALESCE(SUM(sfa.total_billed), 0::NUMERIC)::NUMERIC,
        COALESCE(SUM(sfa.total_paid), 0::NUMERIC)::NUMERIC,
        COALESCE(SUM(sfa.outstanding_balance), 0::NUMERIC)::NUMERIC
    FROM public.student_profiles sp_node
    LEFT JOIN public.student_fee_accounts sfa ON sp_node.user_id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp_node.branch_id = p_branch_id)
    GROUP BY sp_node.grade
    ORDER BY sp_node.grade;
END;
$$;

-- [8] REBUILD: get_finance_overview_stats_v3 (The Executive Dashboard)
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
      AND (pay.payment_date >= date_trunc('month', NOW()) OR pay.created_at >= date_trunc('month', NOW()));

    -- Daily velocity
    SELECT COALESCE(SUM(pay.amount), 0) INTO v_today
    FROM public.fee_payments pay
    JOIN public.student_profiles sp_node ON pay.student_id = sp_node.user_id
    WHERE (p_branch_id IS NULL OR sp_node.branch_id = p_branch_id)
      AND LOWER(pay.status::text) IN ('completed', 'success')
      AND (pay.payment_date >= date_trunc('day', NOW()) OR pay.created_at >= date_trunc('day', NOW()));

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

-- [9] PERMISSIONS: GRANTS
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_nodes(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_grade_wise_collection_stats(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_overview_stats_v3(BIGINT) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Mastery V42 (Ambiguity Exterminator) Deployed. All dashboard and chart RPCs unified.' as status;
