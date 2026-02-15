-- =============================================================================
-- INSTITUTIONAL FINANCE REPAIR: GLOBAL PROTOCOL (V6)
-- =============================================================================
-- This script repairs ALL Finance Tab functions to resolve "Ambiguous Column"
-- errors and Schema Mismatches.
-- 
-- INSTRUCTIONS:
-- 1. Run this ENTIRE script in your Supabase SQL Editor.
-- 2. It will drop and recreate all critical Finance Node functions.
-- 3. It enforces strict column aliasing (e.g., p.col instead of col).
-- =============================================================================

BEGIN;

-- [1] PRE-FLIGHT CHECK: Columns
DO $$ 
BEGIN
    -- Ensure profile_photo_url exists in student_profiles so aliases don't break
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.student_profiles ADD COLUMN profile_photo_url TEXT;
    END IF;
END $$;

-- [2] CLEANUP: Drop ALL Finance Related Functions (Cascade to remove old signatures)
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all() CASCADE;

DROP FUNCTION IF EXISTS public.get_finance_overview_stats_v2(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_grade_wise_collection_stats(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_institutional_health_index(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.fn_calculate_finance_readiness(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_financial_projection_matrix(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_finance_master_state(bigint) CASCADE;


-- [3] REBUILD: get_student_fee_summary_all (The Primary Cause of Ambiguity)
-- We use STRICT ALIASING (p.*, sp.*) to prevent "Ambiguous Column" errors.
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
        
        -- [CRITICAL FIX] Distinct Aliasing Priority
        COALESCE(
            p.profile_photo_url,          -- 1. Primary Profile
            sp.profile_photo_url,         -- 2. Student Profile
            adm_distinct.adm_photo_url    -- 3. Admission Record (Aliased)
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
        -- Subquery prevents any main-query namespace pollution
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url AS adm_photo_url
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) adm_distinct ON p.id = adm_distinct.student_user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND LOWER(p.role) = 'student'
    ORDER BY p.display_name ASC;
END;
$$;


-- [4] REBUILD: get_finance_overview_stats_v2 (KPI Cards)
CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v2(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total NUMERIC;
    v_paid NUMERIC;
    v_overdue NUMERIC;
    v_monthly NUMERIC;
    v_today NUMERIC;
BEGIN
    -- Aggregates
    SELECT COALESCE(SUM(total_amount), 0), COALESCE(SUM(paid_amount), 0) 
    INTO v_total, v_paid 
    FROM public.fee_invoices 
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id) AND status::TEXT NOT IN ('cancelled', 'Cancelled');

    -- Overdue
    SELECT COALESCE(SUM(total_amount - paid_amount), 0) INTO v_overdue
    FROM public.fee_invoices
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND status::TEXT IN ('pending', 'partial', 'Pending', 'Partially Paid')
    AND due_date < NOW();

    -- Monthly
    SELECT COALESCE(SUM(amount), 0) INTO v_monthly
    FROM public.fee_payments
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND status::TEXT ILIKE 'completed'
    AND payment_date >= date_trunc('month', NOW());

    -- Today
    SELECT COALESCE(SUM(amount), 0) INTO v_today
    FROM public.fee_payments
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND status::TEXT ILIKE 'completed'
    AND payment_date >= CURRENT_DATE;

    RETURN jsonb_build_object(
        'total_assigned', v_total,
        'total_collected', v_paid,
        'total_pending', v_total - v_paid,
        'total_overdue', v_overdue,
        'monthly_collection', v_monthly,
        'today_collection', v_today,
        'currency', 'INR'
    );
END;
$$;

-- [5] REBUILD: get_grade_wise_collection_stats
CREATE OR REPLACE FUNCTION public.get_grade_wise_collection_stats(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    grade TEXT, section TEXT, total_students BIGINT, 
    total_billed NUMERIC, total_collected NUMERIC, total_pending NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.grade, 
        COALESCE(sc.section, 'A'), 
        COUNT(DISTINCT sp.user_id), 
        COALESCE(SUM(fi.total_amount), 0), 
        COALESCE(SUM(fi.paid_amount), 0), 
        COALESCE(SUM(fi.total_amount - fi.paid_amount), 0)
    FROM public.student_profiles sp
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.fee_invoices fi ON sp.user_id = fi.student_id AND fi.status::TEXT NOT IN ('cancelled', 'Cancelled')
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    GROUP BY sp.grade, sc.section 
    ORDER BY sp.grade;
END;
$$;

-- [6] REBUILD: get_institutional_health_index
CREATE OR REPLACE FUNCTION public.get_institutional_health_index(p_branch_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total NUMERIC; v_paid NUMERIC; v_eff NUMERIC;
begin
    SELECT COALESCE(SUM(total_amount), 0), COALESCE(SUM(paid_amount), 0) 
    INTO v_total, v_paid 
    FROM public.fee_invoices 
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id) AND status::TEXT NOT IN ('cancelled', 'Cancelled');
    
    v_eff := CASE WHEN v_total > 0 THEN (v_paid / v_total) * 100 ELSE 100 END;
    
    RETURN jsonb_build_object(
        'health_index', ROUND(v_eff * 0.8 + 20, 2),
        'collection_efficiency', ROUND(v_eff, 2),
        'outstanding_ratio', 100 - ROUND(v_eff, 2),
        'burn_rate_stability', 95.0
    );
END;
$$;

-- [7] REBUILD: fn_calculate_finance_readiness
CREATE OR REPLACE FUNCTION public.fn_calculate_finance_readiness(p_branch_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_has BOOLEAN; v_billed NUMERIC;
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.fee_structures WHERE (p_branch_id IS NULL OR branch_id = p_branch_id) AND status='Active') INTO v_has;
    SELECT COALESCE(SUM(total_amount), 0) INTO v_billed FROM public.fee_invoices WHERE (p_branch_id IS NULL OR branch_id = p_branch_id) AND status::TEXT NOT IN ('cancelled', 'Cancelled');
    RETURN jsonb_build_object('isSetupComplete', (v_has AND v_billed > 0), 'hasStructures', v_has, 'hasAssignments', (v_billed > 0));
END;
$$;

-- [8] REBUILD: get_financial_projection_matrix
CREATE OR REPLACE FUNCTION public.get_financial_projection_matrix(p_branch_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total NUMERIC; v_paid NUMERIC;
BEGIN
    SELECT COALESCE(SUM(total_amount), 0), COALESCE(SUM(paid_amount), 0) INTO v_total, v_paid 
    FROM public.fee_invoices WHERE (p_branch_id IS NULL OR branch_id = p_branch_id) AND status::TEXT NOT IN ('cancelled', 'Cancelled');
    RETURN jsonb_build_object(
        'confidence_index', 85,
        'projections', jsonb_build_array(
            jsonb_build_object('node', 'REALIZED', 'amount', v_paid, 'confidence', 1.0),
            jsonb_build_object('node', 'PREDICTED', 'amount', (v_total - v_paid) * 0.7, 'confidence', 0.8)
        )
    );
END;
$$;

-- [9] REBUILD: get_finance_master_state
CREATE OR REPLACE FUNCTION public.get_finance_master_state(p_branch_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN jsonb_build_object(
        'settings', '{"base_currency": "INR", "is_tax_enabled": false}'::jsonb,
        'readiness', public.fn_calculate_finance_readiness(p_branch_id)
    );
END;
$$;

-- [10] GRANTS
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_overview_stats_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_grade_wise_collection_stats(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_institutional_health_index(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_calculate_finance_readiness(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_projection_matrix(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_master_state(bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Tab Global Repair (V6) Complete. Ambiguity Eliminated.' as status;
