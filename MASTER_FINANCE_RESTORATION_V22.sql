-- =============================================================================
-- MASTER FINANCE SYSTEM RESTORATION (V22.0)
-- =============================================================================
-- DESCRIPTION: Comprehensive repair and unification of the Finance Module.
--   1. Fixes mismatched Received Amounts (Unified Reconciliation Engine)
--   2. Integrates Grade Fee Structures with Student Nodes (Fuzzy Sync)
--   3. Implements End-to-End Atomic Payment Flow
--   4. Eliminates Data Mirroring Conflicts (Ledger vs Invoices)
--   5. Synchronizes all Dashboard & Reporting RPCs
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [0] CLEANUP & INFRASTRUCTURE
-- ═══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_reconcile_student_account(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.record_fee_payment(BIGINT, NUMERIC, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger(UUID, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_finance_overview_stats_v3(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_grade_wise_collection_stats(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_recent_financial_stream(BIGINT) CASCADE;

-- Ensure summary cache exists with all required columns
CREATE TABLE IF NOT EXISTS public.student_fee_accounts (
    student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_billed NUMERIC DEFAULT 0,
    total_paid NUMERIC DEFAULT 0,
    outstanding_balance NUMERIC DEFAULT 0,
    unallocated_funds NUMERIC DEFAULT 0,
    integrity_score INTEGER DEFAULT 0,
    last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure Ledger has critical columns for versioning
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS scholarship_amount NUMERIC DEFAULT 0;
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] RECONCILIATION ENGINE (THE ULTIMATE SOURCE OF TRUTH)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_total_liability NUMERIC := 0;
    v_total_paid_fp NUMERIC := 0;
    v_total_paid_ent NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_remaining_to_allocate NUMERIC := 0;
    v_integrity INTEGER := 0;
    v_inst RECORD;
    v_applied NUMERIC := 0;
    v_ledger_id UUID;
BEGIN
    -- 1. Resolve Active Ledger Context
    SELECT id, total_amount INTO v_ledger_id, v_total_liability 
    FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND status = 'ACTIVE'
    ORDER BY created_at DESC LIMIT 1;

    -- 2. Calculate Total Paid (Unified summation across legacy & enterprise nodes)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_fp 
    FROM public.fee_payments 
    WHERE student_id = p_student_id 
    AND LOWER(status::text) IN ('completed', 'success', 'verified');

    BEGIN
        EXECUTE 'SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE student_id = $1 AND LOWER(status::text) IN (''success'', ''completed'')'
        INTO v_total_paid_ent
        USING p_student_id;
    EXCEPTION WHEN OTHERS THEN v_total_paid_ent := 0; END;

    v_total_paid := v_total_paid_fp + v_total_paid_ent;

    -- 3. Sync Installment Waterfall (FIFO Allocation)
    IF v_ledger_id IS NOT NULL THEN
        -- Atomic Reset
        UPDATE public.installment_schedule 
        SET paid_amount = 0, status = 'pending' 
        WHERE ledger_id = v_ledger_id;

        v_remaining_to_allocate := v_total_paid;
        
        FOR v_inst IN 
            SELECT id, amount 
            FROM public.installment_schedule 
            WHERE ledger_id = v_ledger_id
            ORDER BY due_date ASC, installment_no ASC
        LOOP
            EXIT WHEN v_remaining_to_allocate <= 0;
            
            v_applied := LEAST(v_remaining_to_allocate, v_inst.amount);
            
            UPDATE public.installment_schedule 
            SET paid_amount = v_applied,
                status = CASE 
                    WHEN v_applied >= v_inst.amount THEN 'paid'
                    WHEN v_applied > 0 THEN 'partial'
                    ELSE 'pending'
                END,
                updated_at = NOW()
            WHERE id = v_inst.id;
            
            v_remaining_to_allocate := v_remaining_to_allocate - v_applied;
        END LOOP;
    END IF;

    -- 4. Calculate Integrity & Health Score
    v_integrity := CASE 
        WHEN v_total_liability <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_total_liability * 100)::INT))
    END;

    -- 5. Synchronize Summary Node for High-Speed Dashboards
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_total_liability, v_total_paid, (v_total_liability - v_total_paid), 
        v_integrity, NOW(), GREATEST(0, v_remaining_to_allocate)
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        last_synced_at = NOW();

END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] GENERATION ENGINE: ENHANCED GRADE-WISE SYNC
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_branch_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_structure_id BIGINT;
    v_total_fee NUMERIC := 0;
    v_ledger_id UUID;
BEGIN
    -- 1. Resolve Identity Context
    SELECT branch_id, grade INTO v_branch_id, v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRADE_NOT_ASSIGNED');
    END IF;

    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));

    -- 2. Locate Active Mapping (Fuzzy Grade Matching)
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = p_academic_year_id 
    AND (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (
        LOWER(target_grade) = LOWER(v_grade) 
        OR TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade
    )
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRADE_MAPPING_MISSING', 'grade', v_grade);
    END IF;

    -- 3. Extract Financial Magnitude
    SELECT COALESCE(SUM(amount), 0) INTO v_total_fee 
    FROM public.fee_components WHERE structure_id = v_structure_id;

    -- 4. Upsert Lifecycle Ledger Node
    INSERT INTO public.student_fee_ledger (
        student_id, academic_year_id, branch_id, total_amount, status
    ) VALUES (
        p_student_id, p_academic_year_id, v_branch_id, v_total_fee, 'ACTIVE'
    )
    ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        status = 'ACTIVE',
        updated_at = NOW()
    RETURNING id INTO v_ledger_id;

    -- 5. Automate Installment Matrix
    PERFORM public.generate_installments(v_ledger_id);
    
    -- 6. Trigger Deep Reconciliation
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'ledger_id', v_ledger_id, 'total_amount', v_total_fee);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [3] OPERATIONAL BRIDGE: ATOMIC PAYMENT
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_fee_payment(
    p_invoice_id BIGINT, 
    p_amount NUMERIC,
    p_method TEXT,
    p_reference TEXT,
    p_student_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_payment_id BIGINT;
    v_branch_id BIGINT;
    v_receipt_no TEXT;
BEGIN
    -- 1. Fetch Logistics Context
    SELECT branch_id INTO v_branch_id FROM public.student_profiles WHERE user_id = p_student_id;
    v_receipt_no := 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 6);

    -- 2. Commit Transaction Record
    INSERT INTO public.fee_payments (
        branch_id, student_id, amount, payment_method, 
        transaction_id, receipt_number, status, payment_date, invoice_id
    ) VALUES (
        v_branch_id, p_student_id, p_amount, p_method,
        COALESCE(p_reference, 'CORE-REC-' || gen_random_uuid()::text),
        v_receipt_no,
        'success',
        NOW(),
        p_invoice_id
    ) RETURNING id INTO v_payment_id;

    -- 3. Atomic Reconciliation Update
    PERFORM public.admin_reconcile_student_account(p_student_id);

    -- 4. Audit Log Entry
    INSERT INTO public.finance_governance_audit (branch_id, action_type, description, performed_by)
    VALUES (v_branch_id, 'PAYMENT_RECORDED', 'Manual payment of ' || p_amount || ' for student ' || p_student_id, auth.uid());

    RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'receipt_number', v_receipt_no);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [4] CORE DASHBOARD FEEDS: HIGH-FIDELITY REPORTING
-- ═══════════════════════════════════════════════════════════════════════════════

-- A. Individual Student Node (Detail View)
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
    is_standby BOOLEAN,
    academic_cycle_id BIGINT,
    cycle_name TEXT,
    branch_id BIGINT,
    ledger_status TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_target_cycle_id BIGINT := p_cycle_id;
    v_target_cycle_name TEXT;
BEGIN
    -- Force Reconcile on Read (Ensures UI is never stale)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    IF v_target_cycle_id IS NULL THEN
        SELECT ay.id, ay.year_name INTO v_target_cycle_id, v_target_cycle_name 
        FROM public.academic_years ay WHERE ay.is_current = true LIMIT 1;
    ELSE
        SELECT ay.year_name INTO v_target_cycle_name FROM public.academic_years ay WHERE ay.id = v_target_cycle_id;
    END IF;

    RETURN QUERY
    SELECT 
        p.id::UUID,
        COALESCE(p.display_name, p.email)::TEXT,
        COALESCE(p.profile_photo_url, sp.profile_photo_url)::TEXT,
        sp.grade::TEXT,
        COALESCE(cls.name, 'UNASSIGNED')::TEXT,
        COALESCE(sacc.total_billed, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.total_paid, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.outstanding_balance, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.integrity_score, 100)::INTEGER,
        COALESCE(sacc.unallocated_funds, 0::NUMERIC)::NUMERIC,
        p.is_active::BOOLEAN,
        (sfl.id IS NULL OR COALESCE(sacc.total_billed, 0) = 0)::BOOLEAN as is_standby,
        v_target_cycle_id::BIGINT,
        v_target_cycle_name::TEXT,
        sp.branch_id::BIGINT,
        COALESCE(sfl.status, 'NO_LEDGER')::TEXT
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes cls ON sp.assigned_class_id = cls.id
    LEFT JOIN public.student_fee_accounts sacc ON p.id = sacc.student_id
    LEFT JOIN public.student_fee_ledger sfl ON p.id = sfl.student_id AND sfl.academic_year_id = v_target_cycle_id
    WHERE p.id = p_student_id
    LIMIT 1;
END;
$$;

-- B. Global Registry (Accounts View)
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
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id::UUID,
        COALESCE(p.display_name, p.email)::TEXT,
        COALESCE(p.profile_photo_url, sp.profile_photo_url)::TEXT,
        COALESCE(sc.name, sp.grade, 'N/A')::TEXT,
        COALESCE(sfa.total_billed, 0::NUMERIC)::NUMERIC,
        COALESCE(sfa.total_paid, 0::NUMERIC)::NUMERIC,
        COALESCE(sfa.outstanding_balance, 0::NUMERIC)::NUMERIC,
        COALESCE(sfa.integrity_score, 100)::INTEGER,
        COALESCE(sfa.unallocated_funds, 0::NUMERIC)::NUMERIC
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND (LOWER(p.role) = 'student')
      AND p.is_active = true
    ORDER BY p.display_name ASC;
END;
$$;

-- C. Overview KPI Strip
CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v3(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_assigned NUMERIC;
    v_collected NUMERIC;
    v_pending NUMERIC;
    v_monthly NUMERIC;
    v_overdue NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(sfa.total_billed), 0),
        COALESCE(SUM(sfa.total_paid), 0),
        COALESCE(SUM(sfa.outstanding_balance), 0)
    INTO v_assigned, v_collected, v_pending
    FROM public.student_fee_accounts sfa
    JOIN public.student_profiles sp ON sfa.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id);

    SELECT COALESCE(SUM(amount), 0) INTO v_monthly
    FROM public.fee_payments
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND LOWER(status::text) IN ('completed', 'success')
      AND payment_date >= date_trunc('month', NOW());

    SELECT COALESCE(SUM(amount - paid_amount), 0) INTO v_overdue
    FROM public.installment_schedule ins
    JOIN public.student_profiles sp ON ins.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND ins.due_date < CURRENT_DATE 
      AND ins.status != 'paid';

    RETURN jsonb_build_object(
        'total_assigned', v_assigned,
        'total_collected', v_collected,
        'total_pending', v_pending,
        'total_overdue', v_overdue,
        'monthly_collection', v_monthly,
        'collection_efficiency', (CASE WHEN v_assigned > 0 THEN ROUND((v_collected / v_assigned * 100)::NUMERIC, 1) ELSE 100 END),
        'health_index', (CASE WHEN v_assigned > 0 THEN (v_collected / v_assigned * 80 + 20)::INT ELSE 100 END)
    );
END;
$$;

-- D. Grade Saturation Chart
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
        sp.grade::TEXT,
        COUNT(DISTINCT sp.user_id)::BIGINT,
        COALESCE(SUM(sfa.total_billed), 0::NUMERIC)::NUMERIC,
        COALESCE(SUM(sfa.total_paid), 0::NUMERIC)::NUMERIC,
        COALESCE(SUM(sfa.outstanding_balance), 0::NUMERIC)::NUMERIC
    FROM public.student_profiles sp
    LEFT JOIN public.student_fee_accounts sfa ON sp.user_id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND sp.grade IS NOT NULL
    GROUP BY sp.grade
    ORDER BY sp.grade;
END;
$$;

-- E. Forensic Transaction Stream
CREATE OR REPLACE FUNCTION public.get_recent_financial_stream(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id TEXT,
    student_name TEXT,
    amount NUMERIC,
    status TEXT,
    performed_at TIMESTAMPTZ,
    protocol TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    (
        SELECT 
            ('PAY-' || fp.id::TEXT)::TEXT,
            COALESCE(p.display_name, p.email, 'Unknown Student')::TEXT,
            fp.amount::NUMERIC,
            fp.status::TEXT,
            fp.payment_date::TIMESTAMPTZ,
            'FINANCE_SETTLEMENT'::TEXT
        FROM public.fee_payments fp
        JOIN public.student_profiles sp ON fp.student_id = sp.user_id
        JOIN public.profiles p ON sp.user_id = p.id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
          AND LOWER(fp.status::text) IN ('completed', 'success')
        
        UNION ALL

        SELECT 
            ('ENT-' || pay.id::TEXT)::TEXT,
            COALESCE(prof.display_name, prof.email, 'Unknown Student')::TEXT,
            pay.amount::NUMERIC,
            pay.status::TEXT,
            pay.created_at::TIMESTAMPTZ,
            'ENTERPRISE_NODE'::TEXT
        FROM public.payments pay
        JOIN public.student_profiles spent ON pay.student_id = spent.user_id
        JOIN public.profiles prof ON spent.user_id = prof.id
        WHERE (p_branch_id IS NULL OR spent.branch_id = p_branch_id)
          AND LOWER(pay.status::text) IN ('success', 'completed')
    )
    ORDER BY performed_at DESC
    LIMIT 10;
END;
$$;

COMMIT;
