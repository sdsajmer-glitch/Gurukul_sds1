-- =============================================================================
-- MASTER FINANCE RESTORATION & UNIFICATION PROTOCOL (V20.0)
-- =============================================================================
-- DESCRIPTION: Universal repair for the School Administration Fee Module.
--   1. Unifies liability tracking (Ledger -> Installments)
--   2. Resolves Received Amount mismatches (Unified summation)
--   3. Synchronizes Grade-wise structures with student accounts
--   4. Implements end-to-end atomic flow
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [0] INFRASTRUCTURE: ENSURE CONSISTENT SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure summary cache exists
CREATE TABLE IF NOT EXISTS public.student_fee_accounts (
    student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_billed NUMERIC DEFAULT 0,
    total_paid NUMERIC DEFAULT 0,
    outstanding_balance NUMERIC DEFAULT 0,
    unallocated_funds NUMERIC DEFAULT 0,
    integrity_score INTEGER DEFAULT 0,
    last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure Ledger has critical columns
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS scholarship_amount NUMERIC DEFAULT 0;
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0;

-- Normalize installment_schedule status column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_inst_status') THEN
        ALTER TABLE public.installment_schedule 
        ADD CONSTRAINT check_inst_status 
        CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled'));
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE: DATA RECONCILIATION ENGINE (THE SOURCE OF TRUTH)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_total_liability NUMERIC := 0;
    v_total_paid_legacy NUMERIC := 0;
    v_total_paid_enterprise NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_unallocated NUMERIC := 0;
    v_remaining_to_allocate NUMERIC := 0;
    v_integrity INTEGER := 0;
    v_inst RECORD;
    v_applied NUMERIC := 0;
BEGIN
    -- 1. Calculate Total Liability (Sum of all active ledgers for the student)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_liability 
    FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND status = 'ACTIVE';

    -- 2. Calculate Total Paid (Unified summation from all payment channels)
    -- Sum from fee_payments (Primary)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_legacy 
    FROM public.fee_payments 
    WHERE student_id = p_student_id 
    AND LOWER(status::text) IN ('completed', 'success', 'verified', 'pending_verification');

    -- Sum from payments table (if exists - enterprise bridge)
    BEGIN
        EXECUTE 'SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE student_id = $1 AND LOWER(status::text) IN (''success'', ''completed'')'
        INTO v_total_paid_enterprise
        USING p_student_id;
    EXCEPTION WHEN OTHERS THEN v_total_paid_enterprise := 0; END;

    v_total_paid := v_total_paid_legacy + v_total_paid_enterprise;

    -- 3. Reset and Re-allocate Installment States (Self-Healing FIFO)
    -- Step A: Set all installments to 0 paid first
    UPDATE public.installment_schedule 
    SET paid_amount = 0, status = 'pending' 
    WHERE ledger_id IN (SELECT id FROM public.student_fee_ledger WHERE student_id = p_student_id);

    -- Step B: Distribute total_paid across installments by due date
    v_remaining_to_allocate := v_total_paid;
    
    FOR v_inst IN 
        SELECT id, amount 
        FROM public.installment_schedule 
        WHERE ledger_id IN (SELECT id FROM public.student_fee_ledger WHERE student_id = p_student_id)
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

    v_unallocated := GREATEST(0, v_remaining_to_allocate);

    -- 4. Calculate Integrity Score
    v_integrity := CASE 
        WHEN v_total_liability <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_total_liability * 100)::INT))
    END;

    -- 5. Synchronize Summary Node
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_total_liability, v_total_paid, (v_total_liability - v_total_paid), 
        v_integrity, NOW(), v_unallocated
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
    v_year_status TEXT;
BEGIN
    -- 1. Fetch Context
    SELECT branch_id, grade INTO v_branch_id, v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRADE_NOT_ASSIGNED');
    END IF;

    -- 2. Normalize Grade for mapping
    v_normalized_grade := TRIM(REPLACE(REPLACE(v_grade, 'Class ', ''), 'class ', ''));

    -- 3. Locate Active Grade Fee Structure
    -- Matches "Class 4", "4", or "4th" via fuzzy check
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = p_academic_year_id 
    AND (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (
        target_grade = v_grade 
        OR target_grade = v_normalized_grade
        OR TRIM(REPLACE(REPLACE(target_grade, 'Class ', ''), 'class ', '')) = v_normalized_grade
    )
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRADE_MAPPING_MISSING', 'grade', v_grade);
    END IF;

    -- 4. Calculate Total Fee Magnitude
    SELECT COALESCE(SUM(amount), 0) INTO v_total_fee 
    FROM public.fee_components WHERE structure_id = v_structure_id;

    IF v_total_fee <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'ZERO_FEE_MAGNITUDE');
    END IF;

    -- 5. Upsert Ledger Node
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

    -- 6. Trigger Installment Generation
    -- (Standard 4-quarter split if no custom plan exists)
    PERFORM public.generate_installments(v_ledger_id);

    -- 7. Initial Reconciliation
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'ledger_id', v_ledger_id, 
        'total_amount', v_total_fee,
        'structure_id', v_structure_id
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [3] OPERATIONAL BRIDGE: ATOMIC PAYMENT RECORDING
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_fee_payment(
    p_invoice_id BIGINT, -- Legacy support or specific installment ID
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
    -- 1. Context Retrieval
    SELECT branch_id INTO v_branch_id FROM public.student_profiles WHERE user_id = p_student_id;
    v_receipt_no := 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

    -- 2. Transaction Record
    INSERT INTO public.fee_payments (
        branch_id, student_id, amount, payment_method, 
        transaction_id, receipt_number, status, payment_date
    ) VALUES (
        v_branch_id, p_student_id, p_amount, p_method,
        COALESCE(p_reference, 'MANUAL-' || gen_random_uuid()::text),
        v_receipt_no,
        'success',
        NOW()
    ) RETURNING id INTO v_payment_id;

    -- 3. Trigger Global Reconciliation (Forces Waterfall Allocation to installments)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    -- 4. Audit Log
    INSERT INTO public.finance_audit_logs (actor_id, action_type, description, metadata)
    VALUES (
        auth.uid(), 
        'PAYMENT_RECORDED', 
        'Manual payment of ' || p_amount || ' for student ' || p_student_id,
        jsonb_build_object('payment_id', v_payment_id, 'receipt', v_receipt_no)
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'receipt_number', v_receipt_no
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [4] DATA FEEDS: ENHANCED SUMMARY NODES
-- ═══════════════════════════════════════════════════════════════════════════════

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
    gross_billed NUMERIC,
    scholarship_amount NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER,
    unallocated_funds NUMERIC,
    next_due_date DATE,
    next_due_amount NUMERIC,
    is_active BOOLEAN,
    is_standby BOOLEAN,
    academic_cycle_id BIGINT,
    cycle_name TEXT,
    branch_id BIGINT,
    ledger_status TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Force Reconcile for accuracy on read (The Ultimate Sync)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        p.id,
        p.display_name,
        COALESCE(p.profile_photo_url, sp.profile_photo_url)::TEXT,
        sp.grade,
        cls.name,
        sacc.total_billed,
        COALESCE(sfl.total_amount, sacc.total_billed),
        COALESCE(sfl.scholarship_amount, 0::NUMERIC),
        sacc.total_paid,
        sacc.outstanding_balance,
        sacc.integrity_score,
        sacc.unallocated_funds,
        (SELECT MIN(due_date) FROM public.installment_schedule WHERE ledger_id = sfl.id AND status = 'pending')::DATE,
        (SELECT amount FROM public.installment_schedule WHERE ledger_id = sfl.id AND status = 'pending' ORDER BY due_date ASC LIMIT 1)::NUMERIC,
        p.is_active,
        (sfl.id IS NULL OR sacc.total_billed = 0),
        ay.id,
        ay.year_name,
        sp.branch_id,
        COALESCE(sfl.status, 'NO_LEDGER')
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes cls ON sp.assigned_class_id = cls.id
    LEFT JOIN public.student_fee_accounts sacc ON p.id = sacc.student_id
    LEFT JOIN public.academic_years ay ON (ay.id = p_cycle_id OR (p_cycle_id IS NULL AND ay.is_current = true))
    LEFT JOIN public.student_fee_ledger sfl ON p.id = sfl.student_id AND sfl.academic_year_id = ay.id
    WHERE p.id = p_student_id
    LIMIT 1;
END;
$$;

-- Standardizing get_student_running_ledger
CREATE OR REPLACE FUNCTION public.get_student_running_ledger(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    transaction_date TIMESTAMPTZ,
    identifier TEXT,
    description TEXT,
    debit NUMERIC,
    credit NUMERIC,
    running_balance NUMERIC,
    protocol TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH raw_entries AS (
        -- Debits (Ledger Assessments)
        SELECT 
            sfl.created_at as t_date,
            'LEDGER-' || sfl.id::TEXT as idnt,
            'Fee Assessment (' || ay.year_name || ')' as descr,
            sfl.total_amount as dbt,
            0::NUMERIC as crdt,
            'ACADEMIC_CYCLE' as prot
        FROM public.student_fee_ledger sfl
        JOIN public.academic_years ay ON sfl.academic_year_id = ay.id
        WHERE sfl.student_id = p_student_id
        AND (p_cycle_id IS NULL OR sfl.academic_year_id = p_cycle_id)

        UNION ALL

        -- Credits (Payments)
        SELECT 
            fp.payment_date as t_date,
            'PAY-' || fp.id::TEXT as idnt,
            'Settlement: ' || COALESCE(fp.payment_method, 'Online') as descr,
            0::NUMERIC as dbt,
            fp.amount as crdt,
            'SETTLEMENT' as prot
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id
        AND LOWER(fp.status::text) IN ('completed', 'success', 'verified', 'pending_verification')
    )
    SELECT 
        t_date,
        idnt,
        descr,
        dbt,
        crdt,
        SUM(dbt - crdt) OVER (ORDER BY t_date ASC, idnt ASC) as running_balance,
        prot
    FROM raw_entries
    ORDER BY t_date DESC;
END;
$$;

COMMIT;
