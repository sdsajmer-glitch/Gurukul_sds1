-- ===============================================================================================
-- GURUKUL OS: FINANCE & FEES ULTIMATE CONVERGENCE PROTOCOL (V31.4 - REINFORCED)
-- DOMAIN: Institutional Finance, Mass Billing, & Ledger Convergence
-- FIX: Missing integrity_score column, Enum Casting, & RPC Desync
-- ===============================================================================================

BEGIN;

-- [0] PRE-FLIGHT: FORCE CLEANUP
DO $$ 
BEGIN
    -- Dashboard RPCs
    DROP FUNCTION IF EXISTS public.get_finance_overview_stats_v3(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_fee_structures_with_metrics(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_grade_wise_collection_stats(BIGINT) CASCADE;
    
    -- Analytics & Master State
    DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID, BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_institutional_health_index(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_financial_projection_matrix(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_recent_financial_stream(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_finance_master_state(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.fn_calculate_finance_readiness(BIGINT) CASCADE;
    
    -- Repair & Sync
    DROP FUNCTION IF EXISTS public.reconcile_finance_registry(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.fn_sync_student_finance_profiles(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.normalize_grade_string(TEXT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_current_academic_cycle() CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; 
END $$;

-- [1] UTILITIES
CREATE OR REPLACE FUNCTION public.normalize_grade_string(p_grade TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF p_grade IS NULL THEN RETURN NULL; END IF;
    RETURN TRIM(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(p_grade), 'grade', ''), 'class', ''), 'th', ''), ' ', ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_academic_cycle()
RETURNS BIGINT LANGUAGE plpgsql STABLE AS $$
DECLARE v_id BIGINT;
BEGIN
    SELECT id INTO v_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
    END IF;
    RETURN v_id;
END;
$$;

-- [2] INFRASTRUCTURE HARDENING
DO $$
BEGIN
    -- A. Ensure core table exists
    CREATE TABLE IF NOT EXISTS public.finance_student_profiles (
        student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
        branch_id BIGINT,
        grade TEXT,
        structure_id BIGINT,
        total_billed NUMERIC DEFAULT 0,
        total_paid NUMERIC DEFAULT 0,
        outstanding_balance NUMERIC DEFAULT 0,
        unallocated_funds NUMERIC DEFAULT 0,
        integrity_score INTEGER DEFAULT 100,
        financial_status TEXT DEFAULT 'ACTIVE',
        last_sync_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- B. Verify all required columns on finance_student_profiles (if table existed without them)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'finance_student_profiles' AND column_name = 'integrity_score') THEN
        ALTER TABLE public.finance_student_profiles ADD COLUMN integrity_score INTEGER DEFAULT 100;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'finance_student_profiles' AND column_name = 'unallocated_funds') THEN
        ALTER TABLE public.finance_student_profiles ADD COLUMN unallocated_funds NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'finance_student_profiles' AND column_name = 'financial_status') THEN
        ALTER TABLE public.finance_student_profiles ADD COLUMN financial_status TEXT DEFAULT 'ACTIVE';
    END IF;

    -- C. Standardize finance_fee_components (The 'fc.structure_id' Fix)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'finance_fee_components') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'fee_structure_id') THEN
            ALTER TABLE public.finance_fee_components RENAME COLUMN fee_structure_id TO structure_id;
        END IF;
    END IF;

    -- D. Standardize Column Naming: total_due -> outstanding_balance
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'total_due') THEN
        ALTER TABLE public.finance_student_profiles RENAME COLUMN total_due TO outstanding_balance;
    END IF;

END $$;

-- [3] MASTER RPC RE-IMPLEMENTATION
-- ===============================

-- 1. OVERVIEW: get_finance_overview_stats_v3
CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v3(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_assigned NUMERIC; v_collected NUMERIC; v_pending NUMERIC; v_overdue NUMERIC;
    v_monthly NUMERIC; v_today NUMERIC; v_expense_30d NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(total_billed), 0),
        COALESCE(SUM(total_paid), 0),
        COALESCE(SUM(outstanding_balance), 0)
    INTO v_assigned, v_collected, v_pending
    FROM public.finance_student_profiles
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id);

    SELECT COALESCE(SUM(total_amount - paid_amount), 0) INTO v_overdue
    FROM public.fee_invoices fi
    JOIN public.student_profiles sp ON fi.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND fi.due_date < NOW() AND LOWER(fi.status::text) NOT IN ('paid', 'cancelled');

    SELECT COALESCE(SUM(amount), 0) INTO v_monthly
    FROM public.fee_payments fp
    JOIN public.student_profiles sp ON fp.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND LOWER(fp.status::text) IN ('completed', 'success')
      AND (fp.payment_date >= date_trunc('month', NOW()) OR fp.created_at >= date_trunc('month', NOW()));

    SELECT COALESCE(SUM(amount), 0) INTO v_today
    FROM public.fee_payments fp
    JOIN public.student_profiles sp ON fp.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND LOWER(fp.status::text) IN ('completed', 'success')
      AND (fp.payment_date::date = CURRENT_DATE OR fp.created_at::date = CURRENT_DATE);

    BEGIN
        SELECT COALESCE(SUM(amount), 0) INTO v_expense_30d
        FROM public.expenses
        WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
          AND expense_date >= NOW() - INTERVAL '30 days'
          AND LOWER(status::text) NOT IN ('cancelled', 'rejected');
    EXCEPTION WHEN OTHERS THEN v_expense_30d := 0; END;

    RETURN jsonb_build_object(
        'total_assigned', v_assigned,
        'total_collected', v_collected,
        'total_pending', v_pending,
        'total_overdue', v_overdue,
        'monthly_collection', v_monthly,
        'today_collection', v_today,
        'total_expense_30d', v_expense_30d,
        'health_index', ROUND((CASE WHEN v_assigned > 0 THEN (v_collected / v_assigned) * 80 + 20 ELSE 100 END)::NUMERIC, 0),
        'currency', 'INR'
    );
END;
$$;

-- 2. STRUCTURES: get_fee_structures_with_metrics
CREATE OR REPLACE FUNCTION public.get_fee_structures_with_metrics(p_branch_id BIGINT)
RETURNS TABLE (
    id BIGINT, name TEXT, academic_year TEXT, target_grade TEXT, currency TEXT, 
    status TEXT, state TEXT, created_at TIMESTAMPTZ, components JSONB,
    student_count BIGINT, potential_count BIGINT, base_amount NUMERIC,
    projected_revenue NUMERIC, collected_revenue NUMERIC, integrity_score INTEGER
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    WITH sb AS (
        SELECT fs.id, fs.name::TEXT, 
               COALESCE(ay.year_name, fs.academic_year::TEXT)::TEXT as ay_name, 
               fs.target_grade::TEXT as t_grade, COALESCE(fs.currency, 'INR')::TEXT as curr,
               fs.status::TEXT, COALESCE(fs.status, 'ACTIVE')::TEXT as st, fs.created_at,
               COALESCE((SELECT SUM(fc.amount) FROM public.finance_fee_components fc WHERE fc.structure_id = fs.id), 0) as b_amt
        FROM public.finance_fee_structures fs
        LEFT JOIN public.academic_years ay ON fs.academic_cycle_id = ay.id
        WHERE (fs.branch_id = p_branch_id OR p_branch_id IS NULL)
    ),
    gp AS (
        SELECT sp.grade, COUNT(*) as p_count FROM public.student_profiles sp
        WHERE (sp.branch_id = p_branch_id OR p_branch_id IS NULL) GROUP BY sp.grade
    ),
    m AS (
        SELECT 
            fsp.structure_id,
            COUNT(DISTINCT fsp.student_id) as s_count,
            COALESCE(SUM(fsp.total_billed), 0) as p_rev,
            COALESCE(SUM(fsp.total_paid), 0) as c_rev,
            AVG(COALESCE(CASE WHEN fsp.total_billed > 0 THEN (fsp.total_paid / fsp.total_billed * 100)::INTEGER ELSE 100 END, 100))::INTEGER as avg_integrity
        FROM public.finance_student_profiles fsp
        WHERE (fsp.branch_id = p_branch_id OR p_branch_id IS NULL)
        GROUP BY fsp.structure_id
    )
    SELECT 
        sb.id, sb.name, sb.ay_name, sb.t_grade, sb.curr, sb.status, sb.st, sb.created_at,
        NULL::JSONB,
        COALESCE(m.s_count, 0::BIGINT),
        COALESCE(gp.p_count, 0::BIGINT),
        sb.b_amt,
        COALESCE(m.p_rev, 0::NUMERIC), 
        COALESCE(m.c_rev, 0::NUMERIC),
        COALESCE(m.avg_integrity, 100)::INTEGER
    FROM sb
    LEFT JOIN m ON sb.id = m.structure_id
    LEFT JOIN gp ON public.normalize_grade_string(sb.t_grade) = public.normalize_grade_string(gp.grade)
    ORDER BY sb.created_at DESC;
END;
$$;

-- 3. REGISTRY: get_student_fee_summary_all
CREATE OR REPLACE FUNCTION public.get_student_fee_summary_all(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    student_id UUID, display_name TEXT, class_name TEXT, grade TEXT,
    total_billed NUMERIC, total_paid NUMERIC, outstanding_balance NUMERIC,
    overall_status TEXT, currency TEXT, branch_id BIGINT,
    profile_photo_url TEXT, integrity_score INTEGER
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        COALESCE(p.display_name, 'Unknown')::TEXT,
        COALESCE(sc.name, 'N/A')::TEXT,
        COALESCE(sp.grade, 'N/A')::TEXT,
        COALESCE(fsp.total_billed, 0)::NUMERIC,
        COALESCE(fsp.total_paid, 0)::NUMERIC,
        COALESCE(fsp.outstanding_balance, 0)::NUMERIC,
        COALESCE(fsp.financial_status, 'ACTIVE')::TEXT,
        'INR'::TEXT,
        sp.branch_id,
        p.profile_photo_url::TEXT,
        COALESCE(fsp.integrity_score, 100)::INTEGER
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.finance_student_profiles fsp ON p.id = fsp.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND p.role = 'Student'
    ORDER BY p.display_name ASC;
END;
$$;

-- 4. REPAIR: reconcile_finance_registry (Hardened integrity column access)
CREATE OR REPLACE FUNCTION public.reconcile_finance_registry(p_branch_id BIGINT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- [1] Sync Missing Students
    INSERT INTO public.finance_student_profiles (student_id, branch_id, grade, last_sync_at)
    SELECT sp.user_id, sp.branch_id, sp.grade, NOW()
    FROM public.student_profiles sp
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND sp.is_active = true
    ON CONFLICT (student_id) DO UPDATE SET
        branch_id = EXCLUDED.branch_id,
        grade = EXCLUDED.grade,
        last_sync_at = NOW();

    -- [2] Recalculate Totals
    UPDATE public.finance_student_profiles fsp
    SET 
        total_billed = (SELECT COALESCE(SUM(total_amount), 0) FROM public.fee_invoices WHERE student_id = fsp.student_id AND LOWER(status::text) != 'cancelled'),
        total_paid = (SELECT COALESCE(SUM(amount), 0) FROM public.fee_payments WHERE student_id = fsp.student_id AND LOWER(status::text) IN ('completed', 'success')),
        integrity_score = (
            SELECT CASE 
                WHEN COALESCE(SUM(total_amount), 0) > 0 THEN (COALESCE(SUM(paid_amount), 0) / COALESCE(SUM(total_amount), 0) * 100)::INTEGER 
                ELSE 100 END 
            FROM public.fee_invoices WHERE student_id = fsp.student_id AND LOWER(status::text) != 'cancelled'
        )
    WHERE (p_branch_id IS NULL OR fsp.branch_id = p_branch_id);

    UPDATE public.finance_student_profiles
    SET outstanding_balance = total_billed - total_paid
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id);
END;
$$;

-- [4] FINAL SEED
SELECT public.reconcile_finance_registry(null);

-- [5] GRANTS
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON public.finance_student_profiles TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Mastery Convergence Protocol (V31.4) Deployed. Schema Hardening Complete.' as status;
