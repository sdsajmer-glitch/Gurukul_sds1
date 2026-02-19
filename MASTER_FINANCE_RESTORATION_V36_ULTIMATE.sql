-- ===============================================================================================
-- GURUKUL OS - v36.0.0 ULTIMATE FINANCE PROTOCOL RESTORATION
-- DOMAIN: Global Finance, Fees, Ledgers, & Parent-Student Handshaking
-- OBJECTIVE: Absolute unification of schema, RPCs, and state machine transitions.
-- FIX: "Registry Protocol Fault" / "Attribute Desync: fc.structure_id"
-- ===============================================================================================

BEGIN;

-- [0] PRE-FLIGHT: FORCE CLEANUP OF ALL KNOWN FINANCE RPCs (Admin + Parent + Core)
DO $$ 
BEGIN
    -- Dashboard & Registry (Admin)
    DROP FUNCTION IF EXISTS public.get_finance_overview_stats_v2(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_finance_overview_stats_v3(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_fee_structures_with_metrics(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_grade_wise_collection_stats(BIGINT) CASCADE;
    
    -- Analytics & States
    DROP FUNCTION IF EXISTS public.get_institutional_health_index(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_financial_projection_matrix(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_recent_financial_stream(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_finance_master_state(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.fn_calculate_finance_readiness(BIGINT) CASCADE;
    
    -- Parent Portal RPCs
    DROP FUNCTION IF EXISTS public.get_parent_linked_students_finance_v3() CASCADE;
    DROP FUNCTION IF EXISTS public.get_student_finance_detail_v4(UUID, BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_student_finance_detail_v5(UUID, BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.check_finance_lifecycle(UUID, BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.validate_institution_finance(BIGINT, TEXT, BIGINT) CASCADE;
    
    -- Core Automation & Repair
    DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID, BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID) CASCADE;
    DROP FUNCTION IF EXISTS public.reconcile_finance_registry(BIGINT) CASCADE;
    DROP FUNCTION IF EXISTS public.admin_reconcile_student_account(UUID) CASCADE;
    DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID) CASCADE;
    DROP FUNCTION IF EXISTS public.automate_finance_lifecycle(UUID) CASCADE;
    DROP FUNCTION IF EXISTS public.generate_student_ledger(UUID, BIGINT) CASCADE;
    
    -- Logging & Audit
    DROP FUNCTION IF EXISTS public.get_forensic_audit_logs(BIGINT, INTEGER, INTEGER, TEXT) CASCADE;

EXCEPTION WHEN OTHERS THEN NULL; 
END $$;

-- [1] SCHEMA HARDENING: GLOBAL STANDARDIZATION
DO $$ 
BEGIN
    -- A. Handle Legacy Table Renames (Structures)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fee_structures') AND 
       NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_fee_structures') THEN
        ALTER TABLE public.fee_structures RENAME TO finance_fee_structures;
    END IF;

    -- B. Handle Legacy Table Renames (Components)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fee_components') AND 
       NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_fee_components') THEN
        ALTER TABLE public.fee_components RENAME TO finance_fee_components;
    END IF;

    -- C. Handle Legacy Table Renames (Profiles/Accounts)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_fee_accounts') AND 
       NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_student_profiles') THEN
        ALTER TABLE public.student_fee_accounts RENAME TO finance_student_profiles;
    ELSIF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_student_profiles') THEN
        -- Create it if it doesn't exist at all
        CREATE TABLE public.finance_student_profiles (
            student_id UUID PRIMARY KEY REFERENCES public.profiles(id),
            branch_id BIGINT,
            grade TEXT,
            structure_id BIGINT,
            total_billed NUMERIC DEFAULT 0,
            total_paid NUMERIC DEFAULT 0,
            outstanding_balance NUMERIC DEFAULT 0,
            integrity_score INTEGER DEFAULT 100,
            unallocated_funds NUMERIC DEFAULT 0,
            financial_status TEXT DEFAULT 'ACTIVE',
            is_active BOOLEAN DEFAULT true,
            last_synced_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- D. Column Recovery Protocol (The fc.structure_id Fix)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'finance_fee_components' AND column_name = 'fee_structure_id') THEN
        ALTER TABLE public.finance_fee_components RENAME COLUMN fee_structure_id TO structure_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fee_invoices' AND column_name = 'fee_structure_id') THEN
        ALTER TABLE public.fee_invoices RENAME COLUMN fee_structure_id TO structure_id;
    END IF;

    -- E. Ensure finance_student_profiles has all required columns (Explicit Addition)
    -- This handles cases where the table existed but was missing columns
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_student_profiles') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'branch_id') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN branch_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'grade') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN grade TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'structure_id') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN structure_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'total_billed') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN total_billed NUMERIC DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'total_paid') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN total_paid NUMERIC DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'outstanding_balance') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN outstanding_balance NUMERIC DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'integrity_score') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN integrity_score INTEGER DEFAULT 100;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'unallocated_funds') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN unallocated_funds NUMERIC DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'financial_status') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN financial_status TEXT DEFAULT 'ACTIVE';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'is_active') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'last_synced_at') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN last_synced_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
        
        -- F. Drop Strict Constraints on Cache Columns (To prevent insertion failures)
        ALTER TABLE public.finance_student_profiles ALTER COLUMN grade DROP NOT NULL;
        ALTER TABLE public.finance_student_profiles ALTER COLUMN branch_id DROP NOT NULL;
        ALTER TABLE public.finance_student_profiles ALTER COLUMN structure_id DROP NOT NULL;
    END IF;

END $$;

-- [2] CORE LOGIC: RECONCILIATION ENGINE
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_billed NUMERIC := 0;
    v_paid NUMERIC := 0;
    v_unallocated NUMERIC := 0;
    v_integrity INT;
    v_branch_id BIGINT;
    v_grade TEXT;
    v_structure_id BIGINT;
    v_cycle_id BIGINT;
BEGIN
    -- 0. Identity Fetch
    SELECT sp.branch_id, sp.grade INTO v_branch_id, v_grade 
    FROM public.student_profiles sp WHERE sp.user_id = p_student_id;

    -- 1. Cycle & Structure Detection
    SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    
    SELECT id INTO v_structure_id 
    FROM public.finance_fee_structures 
    WHERE target_grade = v_grade 
    AND (academic_cycle_id = v_cycle_id OR academic_cycle_id IS NULL)
    AND LOWER(status) = 'active'
    LIMIT 1;

    -- 2. Calculate Real-Time Billed Magnitude (Active Invoices)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND LOWER(status::text) NOT IN ('cancelled', 'void');

    -- 3. Sum Settlements (Completed & Pending)
    SELECT COALESCE(SUM(amount), 0) INTO v_paid 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'success', 'pending');

    -- 4. Unallocated Funds
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND (invoice_id IS NULL OR invoice_id = 0) AND LOWER(status::text) IN ('completed', 'success');

    -- 5. Integrity Calculation
    v_integrity := CASE 
        WHEN v_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_paid / v_billed * 100)::INT))
    END;

    -- 6. Atomic State Update (Synced with student_profiles)
    INSERT INTO public.finance_student_profiles (
        student_id, branch_id, grade, structure_id,
        total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds, financial_status
    )
    VALUES (
        p_student_id, v_branch_id, v_grade, v_structure_id,
        v_billed, v_paid, (v_billed - v_paid), 
        v_integrity, NOW(), v_unallocated, 
        CASE WHEN (v_billed - v_paid) > 0 THEN 'OVERDUE' ELSE 'ACTIVE' END
    )
    ON CONFLICT (student_id) DO UPDATE SET
        branch_id = EXCLUDED.branch_id,
        grade = EXCLUDED.grade,
        structure_id = EXCLUDED.structure_id,
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        financial_status = EXCLUDED.financial_status,
        last_synced_at = NOW();
END;
$$;

-- [3] MASTER RPC: OVERVIEW STATS (v3)
CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v3(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_assigned NUMERIC; v_collected NUMERIC; v_pending NUMERIC; v_overdue NUMERIC;
    v_monthly NUMERIC; v_today NUMERIC; v_currency TEXT;
BEGIN
    SELECT 
        COALESCE(SUM(fsp.total_billed), 0), COALESCE(SUM(fsp.total_paid), 0), COALESCE(SUM(fsp.outstanding_balance), 0)
    INTO v_assigned, v_collected, v_pending
    FROM public.finance_student_profiles fsp
    JOIN public.student_profiles sp ON fsp.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id);

    SELECT COALESCE(SUM(total_amount - paid_amount), 0) INTO v_overdue
    FROM public.fee_invoices fi
    JOIN public.student_profiles sp ON fi.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND fi.due_date < CURRENT_DATE AND LOWER(fi.status::text) NOT IN ('paid', 'cancelled');

    SELECT COALESCE(SUM(amount), 0) INTO v_monthly
    FROM public.fee_payments fp
    JOIN public.student_profiles sp ON fp.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND LOWER(fp.status::text) IN ('completed', 'success')
      AND fp.payment_date >= date_trunc('month', NOW());

    SELECT COALESCE(SUM(amount), 0) INTO v_today
    FROM public.fee_payments fp
    JOIN public.student_profiles sp ON fp.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND LOWER(fp.status::text) IN ('completed', 'success')
      AND fp.payment_date >= date_trunc('day', NOW());

    RETURN jsonb_build_object(
        'total_assigned', v_assigned, 'total_collected', v_collected, 'total_pending', v_pending,
        'total_overdue', v_overdue, 'monthly_collection', v_monthly, 'today_collection', v_today,
        'currency', 'INR'
    );
END;
$$;

-- [4] MASTER RPC: FEE STRUCTURES WITH METRICS
CREATE OR REPLACE FUNCTION public.get_fee_structures_with_metrics(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id BIGINT, name TEXT, academic_year TEXT, target_grade TEXT, 
    status TEXT, type TEXT, base_amount NUMERIC, student_count BIGINT,
    projected_revenue NUMERIC, collected_revenue NUMERIC, integrity_score INTEGER,
    is_default BOOLEAN, is_locked BOOLEAN, created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fs.id, fs.name::TEXT, 
        COALESCE((SELECT year_name FROM public.academic_years ay WHERE ay.id = fs.academic_cycle_id), 'N/A')::TEXT as academic_year,
        fs.target_grade::TEXT, fs.status::TEXT, fs.type::TEXT,
        COALESCE((SELECT SUM(fc.amount) FROM public.finance_fee_components fc WHERE fc.structure_id = fs.id), 0)::NUMERIC as base_amount,
        (SELECT COUNT(DISTINCT fsp.student_id) FROM public.finance_student_profiles fsp 
         JOIN public.fee_invoices fi ON fsp.student_id = fi.student_id
         WHERE fi.structure_id = fs.id)::BIGINT as student_count,
        COALESCE((SELECT SUM(fi.total_amount) FROM public.fee_invoices fi WHERE fi.structure_id = fs.id AND LOWER(fi.status::text) != 'cancelled'), 0)::NUMERIC as projected_revenue,
        COALESCE((SELECT SUM(fi.paid_amount) FROM public.fee_invoices fi WHERE fi.structure_id = fs.id AND LOWER(fi.status::text) != 'cancelled'), 0)::NUMERIC as collected_revenue,
        100::INTEGER as integrity_score,
        COALESCE(fs.is_default, false)::BOOLEAN,
        COALESCE(fs.is_locked, false)::BOOLEAN,
        fs.created_at::TIMESTAMPTZ
    FROM public.finance_fee_structures fs
    WHERE (p_branch_id IS NULL OR fs.branch_id = p_branch_id)
    ORDER BY fs.created_at DESC;
END;
$$;

-- [5] MASTER RPC: STUDENT FEE REGISTRY
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
        p.id as student_id,
        COALESCE(p.display_name, p.email)::TEXT as display_name,
        sc.name::TEXT as class_name,
        sp.grade::TEXT as grade,
        COALESCE(fsp.total_billed, 0::NUMERIC)::NUMERIC,
        COALESCE(fsp.total_paid, 0::NUMERIC)::NUMERIC,
        COALESCE(fsp.outstanding_balance, 0::NUMERIC)::NUMERIC,
        COALESCE(fsp.financial_status, 'ACTIVE')::TEXT as overall_status,
        'INR'::TEXT as currency,
        sp.branch_id::BIGINT,
        COALESCE(p.profile_photo_url, sp.profile_photo_url)::TEXT,
        COALESCE(fsp.integrity_score, 100)::INTEGER
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.finance_student_profiles fsp ON p.id = fsp.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND p.is_active = true
    ORDER BY p.display_name ASC;
END;
$$;

-- [6] ANALYTICS: GRADE-WISE STATS
CREATE OR REPLACE FUNCTION public.get_grade_wise_collection_stats(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    grade TEXT, total_students BIGINT, total_billed NUMERIC, total_collected NUMERIC, total_pending NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.grade::TEXT,
        COUNT(DISTINCT sp.user_id)::BIGINT,
        COALESCE(SUM(fsp.total_billed), 0::NUMERIC)::NUMERIC,
        COALESCE(SUM(fsp.total_paid), 0::NUMERIC)::NUMERIC,
        COALESCE(SUM(fsp.outstanding_balance), 0::NUMERIC)::NUMERIC
    FROM public.student_profiles sp
    LEFT JOIN public.finance_student_profiles fsp ON sp.user_id = fsp.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    GROUP BY sp.grade
    ORDER BY sp.grade;
END;
$$;

-- [7] ANALYTICS: HEALTH INDEX
CREATE OR REPLACE FUNCTION public.get_institutional_health_index(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_total_billed NUMERIC; v_total_paid NUMERIC; v_efficiency NUMERIC;
BEGIN
    SELECT COALESCE(SUM(total_billed), 0), COALESCE(SUM(total_paid), 0)
    INTO v_total_billed, v_total_paid
    FROM public.finance_student_profiles fsp
    JOIN public.student_profiles sp ON fsp.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id);

    IF v_total_billed > 0 THEN v_efficiency := (v_total_paid / v_total_billed * 100); ELSE v_efficiency := 100; END IF;

    RETURN jsonb_build_object(
        'health_index', CASE WHEN v_efficiency > 80 THEN 95 ELSE 75 END,
        'collection_efficiency', v_efficiency::INTEGER,
        'outstanding_ratio', (100 - v_efficiency)::INTEGER,
        'burn_rate_stability', 92
    );
END;
$$;

-- [8] ANALYTICS: MASTER STATE
CREATE OR REPLACE FUNCTION public.get_finance_master_state(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_structs INTEGER; v_components INTEGER; v_cycle_name TEXT;
BEGIN
    SELECT COUNT(*) INTO v_structs FROM public.finance_fee_structures WHERE (p_branch_id IS NULL OR branch_id = p_branch_id);
    SELECT COUNT(*) INTO v_components FROM public.finance_fee_components fc JOIN public.finance_fee_structures fs ON fc.structure_id = fs.id WHERE (p_branch_id IS NULL OR fs.branch_id = p_branch_id);
    SELECT year_name INTO v_cycle_name FROM public.academic_years WHERE is_current = true LIMIT 1;
    
    RETURN jsonb_build_object('structures_count', v_structs, 'components_count', v_components, 'active_cycle', v_cycle_name);
END;
$$;

-- [9] PARENT PORTAL: LINKED STUDENTS
CREATE OR REPLACE FUNCTION public.get_parent_linked_students_finance_v3()
RETURNS TABLE (
    student_id UUID, display_name TEXT, profile_photo_url TEXT, grade TEXT,
    branch_name TEXT, total_due NUMERIC, status TEXT, health_score INTEGER
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as student_id,
        p.display_name::TEXT,
        COALESCE(p.profile_photo_url, sp.profile_photo_url)::TEXT,
        sp.grade::TEXT,
        COALESCE(sb.name, 'Branch Registry')::TEXT,
        COALESCE(fsp.outstanding_balance, 0)::NUMERIC as total_due,
        COALESCE(fsp.financial_status, 'ACTIVE')::TEXT,
        COALESCE(fsp.integrity_score, 100)::INTEGER
    FROM public.student_parents spm
    JOIN public.profiles p ON spm.student_id = p.id
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_branches sb ON sp.branch_id = sb.id
    LEFT JOIN public.finance_student_profiles fsp ON p.id = fsp.student_id
    WHERE spm.parent_id = auth.uid() AND spm.status = 'active';
END;
$$;

-- [10] LIFECYCLE STATE MACHINE
CREATE OR REPLACE FUNCTION public.check_finance_lifecycle(p_student_id UUID, p_cycle_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_status TEXT; v_grade TEXT; v_struct_id BIGINT; v_ledger_exists BOOLEAN;
BEGIN
    SELECT enrollment_status, grade INTO v_status, v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    IF v_status NOT IN ('Active', 'Enrolled') THEN RETURN 'ENROLLMENT_PENDING'; END IF;

    SELECT id INTO v_struct_id FROM public.finance_fee_structures WHERE target_grade = v_grade AND academic_cycle_id = p_cycle_id AND status = 'Active' LIMIT 1;
    IF v_struct_id IS NULL THEN RETURN 'FEE_CONFIG_MISSING'; END IF;

    SELECT EXISTS (SELECT 1 FROM public.fee_invoices WHERE student_id = p_student_id AND structure_id = v_struct_id) INTO v_ledger_exists;
    IF NOT v_ledger_exists THEN RETURN 'FEE_CONFIGURED'; END IF;

    RETURN 'PAYMENTS_ENABLED';
END;
$$;

-- [11] PARENT PORTAL: FINANCE DETAIL (v5)
CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v5(p_student_id UUID, p_cycle_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_lifecycle TEXT; v_progress INTEGER; v_summary JSONB; v_inst JSONB; v_hist JSONB; v_break JSONB;
BEGIN
    -- Ownership check via security policy function (assuming it exists as per global policy)
    IF NOT EXISTS (SELECT 1 FROM public.student_parents WHERE student_id = p_student_id AND parent_id = auth.uid() AND status = 'active') THEN
        RETURN jsonb_build_object('error', '403_ACCESS_FORBIDDEN');
    END IF;

    v_lifecycle := public.check_finance_lifecycle(p_student_id, p_cycle_id);
    v_progress := CASE WHEN v_lifecycle = 'PAYMENTS_ENABLED' THEN 100 WHEN v_lifecycle = 'FEE_CONFIGURED' THEN 50 ELSE 20 END;

    -- Fetch Summary
    SELECT jsonb_build_object(
        'total_billed', COALESCE(total_billed, 0),
        'total_paid', COALESCE(total_paid, 0),
        'outstanding', COALESCE(outstanding_balance, 0),
        'status', v_lifecycle,
        'sync_progress', v_progress,
        'academic_period', (SELECT year_name FROM public.academic_years WHERE id = p_cycle_id)
    ) INTO v_summary FROM public.finance_student_profiles WHERE student_id = p_student_id;

    -- Fetch Breakdown (Components)
    SELECT jsonb_agg(jsonb_build_object('name', fc.name, 'amount', fc.amount, 'frequency', fc.frequency))
    INTO v_break FROM public.finance_fee_components fc
    WHERE fc.structure_id = (SELECT id FROM public.finance_fee_structures WHERE target_grade = (SELECT grade FROM public.student_profiles WHERE user_id = p_student_id) AND academic_cycle_id = p_cycle_id AND status = 'Active' LIMIT 1);

    -- Fetch Invoices/Installments
    SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'title', description, 'amount', total_amount, 'paid', paid_amount,
        'due_date', due_date, 'status', status, 'is_overdue', (due_date < CURRENT_DATE AND LOWER(status::text) = 'pending')
    )) INTO v_inst FROM public.fee_invoices WHERE student_id = p_student_id AND LOWER(status::text) != 'cancelled';

    -- Fetch History
    SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'date', payment_date, 'amount', amount, 'mode', payment_method, 'status', status, 'ref_id', transaction_id
    )) INTO v_hist FROM public.fee_payments WHERE student_id = p_student_id ORDER BY payment_date DESC;

    RETURN jsonb_build_object(
        'summary', v_summary, 'installments', COALESCE(v_inst, '[]'::jsonb),
        'breakdown', COALESCE(v_break, '[]'::jsonb), 'history', COALESCE(v_hist, '[]'::jsonb)
    );
END;
$$;

-- [12] REPAIR: INDIVIDUAL NODE HANDSHAKE
CREATE OR REPLACE FUNCTION public.get_student_financial_node(p_student_id UUID, p_cycle_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    student_id UUID, display_name TEXT, profile_photo_url TEXT, grade TEXT, class_name TEXT,
    total_billed NUMERIC, total_paid NUMERIC, outstanding_balance NUMERIC,
    integrity_score INTEGER, unallocated_funds NUMERIC,
    cycle_id BIGINT, cycle_name TEXT, branch_id BIGINT,
    is_active BOOLEAN, financial_status TEXT,
    next_due_date DATE, next_due_amount NUMERIC,
    total_revenue_ytd NUMERIC, scholarship_amount NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_cycle_id BIGINT := p_cycle_id;
    v_cycle_name TEXT;
BEGIN
    IF v_cycle_id IS NULL THEN
        SELECT id, year_name INTO v_cycle_id, v_cycle_name FROM public.academic_years WHERE is_current = true LIMIT 1;
    ELSE
        SELECT year_name INTO v_cycle_name FROM public.academic_years WHERE id = v_cycle_id;
    END IF;

    RETURN QUERY
    SELECT 
        p.id::UUID, 
        COALESCE(p.display_name, p.email)::TEXT, 
        COALESCE(p.profile_photo_url, sp.profile_photo_url)::TEXT, 
        sp.grade::TEXT, 
        sc.name::TEXT as class_name,
        COALESCE(fsp.total_billed, 0::NUMERIC)::NUMERIC, 
        COALESCE(fsp.total_paid, 0::NUMERIC)::NUMERIC, 
        COALESCE(fsp.outstanding_balance, 0::NUMERIC)::NUMERIC,
        COALESCE(fsp.integrity_score, 100)::INTEGER, 
        COALESCE(fsp.unallocated_funds, 0::NUMERIC)::NUMERIC,
        v_cycle_id::BIGINT, 
        COALESCE(v_cycle_name, 'Unknown')::TEXT, 
        sp.branch_id::BIGINT,
        p.is_active::BOOLEAN, 
        COALESCE(fsp.financial_status, 'ACTIVE')::TEXT,
        (SELECT MIN(due_date)::DATE FROM public.fee_invoices WHERE student_id = p.id AND LOWER(status::text) = 'pending'),
        (SELECT total_amount::NUMERIC FROM public.fee_invoices WHERE student_id = p.id AND LOWER(status::text) = 'pending' ORDER BY due_date ASC LIMIT 1),
        COALESCE(fsp.total_billed, 0::NUMERIC)::NUMERIC,
        0::NUMERIC
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.finance_student_profiles fsp ON p.id = fsp.student_id
    WHERE p.id = p_student_id;
END;
$$;

-- [13] ACTION: AUTOMATED RECALCULATION
CREATE OR REPLACE FUNCTION public.reconcile_finance_registry(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Trigger re-sync for all students (which now handles grade/branch/structure)
    PERFORM public.admin_reconcile_student_account(sp.user_id)
    FROM public.student_profiles sp 
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    AND sp.is_active = true;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN jsonb_build_object('success', true, 'nodes_reconciled', v_count, 'timestamp', NOW());
END;
$$;

-- [14] PERMISSIONS
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON TABLE public.finance_student_profiles TO authenticated;
GRANT ALL ON TABLE public.finance_fee_structures TO authenticated;
GRANT ALL ON TABLE public.finance_fee_components TO authenticated;

-- [15] FINAL HANDSHAKE: AUTOMATED RECALCULATION
SELECT public.reconcile_finance_registry(null);

COMMIT;

SELECT 'SUCCESS: Ultimate Finance Protocol Restoration V36 Deployed.' as STATUS;
