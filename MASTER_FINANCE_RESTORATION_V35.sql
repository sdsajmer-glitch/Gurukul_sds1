-- ===============================================================================================
-- GURUKUL OS: MASTER FINANCE RESTORATION V35 (NUCLEAR REALIGNMENT)
-- DOMAIN: Institutional Finance, Mass Billing, & Ledger Convergence
-- FIX: Attribute Desync (fc.structure_id), RPC Signature Mismatch, & Identity Ambiguity
-- ===============================================================================================

BEGIN;

-- [0] PRE-FLIGHT: FORCE CLEANUP OF OUTDATED RPCs
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS public.get_finance_overview_stats_v3(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_fee_structures_with_metrics(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_grade_wise_collection_stats(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID, BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID) CASCADE;
    DROP FUNCTION IF EXISTS public.get_institutional_health_index(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_financial_projection_matrix(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_recent_financial_stream(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_finance_master_state(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.fn_calculate_finance_readiness(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.reconcile_finance_registry(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.admin_reconcile_student_account(UUID) CASCADE;
    DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID) CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; 
END $$;

-- [1] SCHEMA HARDENING: STANDARDIZE TABLE & COLUMN PROTOCOLS
DO $$
BEGIN
    -- A. Handle Legacy Table Renames
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fee_structures') AND 
       NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_fee_structures') THEN
        ALTER TABLE public.fee_structures RENAME TO finance_fee_structures;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fee_components') AND 
       NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_fee_components') THEN
        ALTER TABLE public.fee_components RENAME TO finance_fee_components;
    END IF;

    -- B. Fix Column Names in finance_fee_components (The fc.structure_id Fix)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'fee_structure_id') THEN
        ALTER TABLE public.finance_fee_components RENAME COLUMN fee_structure_id TO structure_id;
    END IF;

    -- C. Standardize finance_student_profiles
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

    -- D. Standardize Legacy Column Naming
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'total_due') THEN
        ALTER TABLE public.finance_student_profiles RENAME COLUMN total_due TO outstanding_balance;
    END IF;

    -- E. Ensure Student profiles has integrity_score if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'integrity_score') THEN
        ALTER TABLE public.student_profiles ADD COLUMN integrity_score INTEGER DEFAULT 100;
    END IF;

END $$;

-- [2] UTILITY: GRADE NORMALIZATION
CREATE OR REPLACE FUNCTION public.normalize_grade_string(p_grade TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF p_grade IS NULL THEN RETURN NULL; END IF;
    RETURN TRIM(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(p_grade), 'grade', ''), 'class', ''), 'th', ''), ' ', ''));
END;
$$;

-- [3] REPAIR ENGINE: admin_reconcile_student_account
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_billed NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_unallocated NUMERIC := 0;
    v_integrity INT;
    v_branch_id BIGINT;
    v_grade TEXT;
BEGIN
    -- 1. Fetch metadata
    SELECT branch_id, grade INTO v_branch_id, v_grade FROM public.student_profiles WHERE user_id = p_student_id;

    -- 2. Calculate Liabilities
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND LOWER(status::text) NOT IN ('cancelled', 'rejected');

    -- 3. Calculate Settlements
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'success');

    -- 4. Unallocated Funds
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND (invoice_id IS NULL OR invoice_id = 0) AND LOWER(status::text) IN ('completed', 'success');

    -- 5. Integrity Score
    v_integrity := CASE 
        WHEN v_total_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_total_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_total_billed * 100)::INT))
    END;

    -- 6. Atomic Upsert to Summary Node
    INSERT INTO public.finance_student_profiles (
        student_id, branch_id, grade, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_sync_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_branch_id, v_grade, v_total_billed, v_total_paid, (v_total_billed - v_total_paid), 
        v_integrity, NOW(), v_unallocated
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        last_sync_at = NOW();

    -- Sync back to student_profiles for legacy compatibility
    UPDATE public.student_profiles SET integrity_score = v_integrity WHERE user_id = p_student_id;
END;
$$;

-- [4] MASTER RPC: OVERVIEW
CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v3(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_assigned NUMERIC; v_collected NUMERIC; v_pending NUMERIC; v_overdue NUMERIC;
    v_monthly NUMERIC; v_today NUMERIC; v_health_index INTEGER;
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

    v_health_index := CASE WHEN v_assigned > 0 THEN (v_collected / v_assigned * 100)::INTEGER ELSE 100 END;

    RETURN jsonb_build_object(
        'total_assigned', v_assigned,
        'total_collected', v_collected,
        'total_pending', v_pending,
        'total_overdue', v_overdue,
        'monthly_collection', v_monthly,
        'today_collection', v_today,
        'health_index', v_health_index,
        'currency', 'INR'
    );
END;
$$;

-- [5] MASTER RPC: STRUCTURE METRICS
CREATE OR REPLACE FUNCTION public.get_fee_structures_with_metrics(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id BIGINT, name TEXT, academic_year TEXT, target_grade TEXT, currency TEXT, 
    status TEXT, created_at TIMESTAMPTZ,
    student_count BIGINT, potential_count BIGINT, base_amount NUMERIC,
    projected_revenue NUMERIC, collected_revenue NUMERIC, integrity_score INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH sb AS (
        SELECT fs.id, fs.name, fs.academic_year, 
               fs.target_grade, COALESCE(fs.currency, 'INR') as curr,
               fs.status, fs.created_at,
               COALESCE((SELECT SUM(fc.amount) FROM public.finance_fee_components fc WHERE fc.structure_id = fs.id), 0) as b_amt
        FROM public.finance_fee_structures fs
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
            AVG(COALESCE(fsp.integrity_score, 100))::INTEGER as avg_integrity
        FROM public.finance_student_profiles fsp
        WHERE (fsp.branch_id = p_branch_id OR p_branch_id IS NULL)
        GROUP BY fsp.structure_id
    )
    SELECT 
        sb.id, sb.name, sb.academic_year, sb.target_grade, sb.curr, sb.status, sb.created_at,
        COALESCE(m.s_count, 0::BIGINT),
        COALESCE(gp.p_count, 0::BIGINT),
        sb.b_amt,
        COALESCE(m.p_rev, 0::NUMERIC), 
        COALESCE(m.c_rev, 0::NUMERIC),
        COALESCE(m.avg_integrity, 100)::INTEGER
    FROM sb
    LEFT JOIN m ON sb.id = m.structure_id
    LEFT JOIN gp ON public.normalize_grade_string(sb.target_grade) = public.normalize_grade_string(gp.grade)
    ORDER BY sb.created_at DESC;
END;
$$;

-- [6] MASTER RPC: STUDENT REGISTRY
CREATE OR REPLACE FUNCTION public.get_student_fee_summary_all(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    student_id UUID, display_name TEXT, class_name TEXT, grade TEXT,
    total_billed NUMERIC, total_paid NUMERIC, outstanding_balance NUMERIC,
    overall_status TEXT, currency TEXT, branch_id BIGINT,
    profile_photo_url TEXT, integrity_score INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        COALESCE(p.display_name, 'Unknown'),
        COALESCE(sc.name, 'N/A'),
        COALESCE(sp.grade, 'N/A'),
        COALESCE(fsp.total_billed, 0),
        COALESCE(fsp.total_paid, 0),
        COALESCE(fsp.outstanding_balance, 0),
        COALESCE(fsp.financial_status, 'ACTIVE'),
        'INR'::TEXT,
        sp.branch_id,
        COALESCE(p.profile_photo_url, sp.profile_photo_url),
        COALESCE(fsp.integrity_score, 100)
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.finance_student_profiles fsp ON p.id = fsp.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND p.role = 'Student'
    ORDER BY p.display_name ASC;
END;
$$;

-- [7] MASTER RPC: INDIVIDUAL NODE HANDSHAKE
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID, display_name TEXT, profile_photo_url TEXT, grade TEXT, class_name TEXT,
    total_billed NUMERIC, total_paid NUMERIC, outstanding_balance NUMERIC, integrity_score INTEGER,
    unallocated_funds NUMERIC, academic_cycle_id BIGINT, cycle_name TEXT, branch_id BIGINT,
    is_active BOOLEAN, ledger_status TEXT, next_due_date DATE, next_due_amount NUMERIC,
    gross_billed NUMERIC, scholarship_amount NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_cycle_id BIGINT := p_cycle_id;
    v_cycle_name TEXT;
BEGIN
    PERFORM public.admin_reconcile_student_account(p_student_id);
    
    IF v_cycle_id IS NULL THEN
        SELECT id, year_name INTO v_cycle_id, v_cycle_name FROM public.academic_years WHERE is_current = true LIMIT 1;
        IF v_cycle_id IS NULL THEN
            SELECT id, year_name INTO v_cycle_id, v_cycle_name FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
        END IF;
    ELSE
        SELECT year_name INTO v_cycle_name FROM public.academic_years WHERE id = v_cycle_id;
    END IF;

    RETURN QUERY
    SELECT 
        p.id, COALESCE(p.display_name, p.email), COALESCE(p.profile_photo_url, sp.profile_photo_url), 
        sp.grade, sc.name as class_name,
        COALESCE(fsp.total_billed, 0), COALESCE(fsp.total_paid, 0), COALESCE(fsp.outstanding_balance, 0),
        COALESCE(fsp.integrity_score, 100), COALESCE(fsp.unallocated_funds, 0),
        v_cycle_id, COALESCE(v_cycle_name, 'Unknown'), sp.branch_id,
        p.is_active, COALESCE(fsp.financial_status, 'ACTIVE'),
        (SELECT MIN(due_date) FROM public.fee_invoices WHERE student_id = p.id AND status = 'Pending'),
        (SELECT total_amount FROM public.fee_invoices WHERE student_id = p.id AND status = 'Pending' ORDER BY due_date ASC LIMIT 1),
        COALESCE(fsp.total_billed, 0), -- fallback for gross
        0::NUMERIC -- placeholder for scholarship if not tracking separately in fsp
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.finance_student_profiles fsp ON p.id = fsp.student_id
    WHERE p.id = p_student_id;
END;
$$;

-- [8] BULK REPAIR: reconcile_finance_registry
CREATE OR REPLACE FUNCTION public.reconcile_finance_registry(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student_id UUID;
    v_count INTEGER := 0;
BEGIN
    FOR v_student_id IN 
        SELECT user_id FROM public.student_profiles WHERE (p_branch_id IS NULL OR branch_id = p_branch_id) AND is_active = true
    LOOP
        PERFORM public.admin_reconcile_student_account(v_student_id);
        v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'nodes_synchronized', v_count);
END;
$$;

-- [9] FRONTEND SYNC: admin_sync_student_billing
CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM public.admin_reconcile_student_account(p_student_id);
    RETURN jsonb_build_object('success', true, 'message', 'Node synchronized');
END;
$$;

-- [10] FINAL HANDSHAKE
SELECT public.reconcile_finance_registry(null);
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON public.finance_student_profiles TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Mastery Restoration Protocol (V35.0) Deployed.' as resolution_status;
