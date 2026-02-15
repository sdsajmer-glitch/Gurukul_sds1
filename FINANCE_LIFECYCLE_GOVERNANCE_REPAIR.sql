-- =============================================================================
-- FINANCE LIFECYCLE GOVERNANCE & LEDGER REPAIR ENGINE
-- =============================================================================
-- Resolution for: Enrollment -> Ledger -> Dashboard Sync Flow Faults.
-- Ensures strict cycle isolation, automated billing, and dashboard data integrity.
-- =============================================================================

BEGIN;

-- [1] CYCLE ISOLATION ENGINE
-- Strictly resolves the active academic cycle to prevent ₹0 ghosts.
CREATE OR REPLACE FUNCTION public.get_current_academic_cycle()
RETURNS BIGINT LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_id BIGINT;
BEGIN
    SELECT id INTO v_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    IF v_id IS NULL THEN
        -- Fallback to the latest year if no "is_current" set
        SELECT id INTO v_id FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
    END IF;
    RETURN v_id;
END;
$$;

-- [2] DEEP RECONCILIATION ENGINE
-- Recalculates the source of truth for a student's financial node.
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_billed NUMERIC;
    v_paid NUMERIC;
    v_unallocated NUMERIC;
    v_integrity INTEGER;
BEGIN
    -- 1. Aggregate Billed (Invoices excluding cancelled)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_billed
    FROM public.fee_invoices
    WHERE student_id = p_student_id AND status NOT IN ('cancelled', 'Cancelled');

    -- 2. Aggregate Paid (Confirmed payments)
    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.fee_payments
    WHERE student_id = p_student_id AND status IN ('Completed', 'completed', 'success', 'Success');

    -- 3. Aggregate Unallocated (Payments not linked to invoice)
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND invoice_id IS NULL AND status IN ('Completed', 'completed', 'success', 'Success');

    -- 4. Calculate Integrity Score
    IF v_billed > 0 THEN
        v_integrity := LEAST(100, (v_paid / v_billed * 100)::INT);
    ELSE
        v_integrity := 100;
    END IF;

    -- 5. Upsert Snapshot
    INSERT INTO public.student_fee_accounts (
        student_id, 
        total_billed, 
        total_paid, 
        outstanding_balance, 
        integrity_score, 
        unallocated_funds, 
        last_synced_at,
        is_active
    )
    VALUES (
        p_student_id, 
        v_billed, 
        v_paid, 
        (v_billed - v_paid), 
        v_integrity, 
        v_unallocated, 
        NOW(),
        true
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

-- [3] ENROLLMENT BILLING PROTOCOL
-- Core engine to map Grade -> Structure -> Invoices
CREATE OR REPLACE FUNCTION public.enroll_student_finance_protocol(
    p_student_id UUID,
    p_grade TEXT,
    p_cycle_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_struct_id UUID;
    v_installment RECORD;
    v_count INTEGER := 0;
BEGIN
    -- 1. Identify active structure
    SELECT id INTO v_struct_id
    FROM public.fee_structures
    WHERE target_grade = p_grade AND academic_cycle_id = p_cycle_id AND status = 'Active'
    LIMIT 1;

    IF v_struct_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Structural Fault: No Active Fee Structure for Grade ' || p_grade);
    END IF;

    -- 2. Deploy Installment Schedule (Idempotent)
    FOR v_installment IN 
        SELECT id, name, amount, due_date FROM public.fee_structure_installments WHERE fee_structure_id = v_struct_id
    LOOP
        -- Only insert if not exists to prevent duplicates on re-enrollment logic
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
              AND fee_structure_id = v_struct_id 
              AND title = v_installment.name
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id,
                fee_structure_id,
                total_amount,
                paid_amount,
                due_date,
                status,
                title,
                academic_cycle_id
            )
            VALUES (
                p_student_id,
                v_struct_id,
                v_installment.amount,
                0,
                v_installment.due_date,
                'pending',
                v_installment.name,
                p_cycle_id
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 3. Synchronize Account Snapshot
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'invoices_generated', v_count);
END;
$$;

-- [4] GLOBAL REPAIR ENGINE
-- Self-healing function to fix existing ₹0 ghost ledgers
CREATE OR REPLACE FUNCTION public.global_repair_finance_ledgers()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student RECORD;
    v_cycle_id BIGINT;
    v_count INTEGER := 0;
    v_res JSONB;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();
    
    FOR v_student IN 
        SELECT sp.user_id, sp.grade 
        FROM public.student_profiles sp
        JOIN public.profiles p ON sp.user_id = p.id
        WHERE p.is_active = true
    LOOP
        v_res := public.enroll_student_finance_protocol(v_student.user_id, v_student.grade, v_cycle_id);
        IF (v_res->>'success')::BOOLEAN THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'students_repaired', v_count);
END;
$$;

-- [5] REFINED PARENT DETAIL RPC (Fixed Cycle Logic)
CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v2(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_summary JSONB;
    v_installments JSONB;
    v_history JSONB;
    v_cycle_id BIGINT := p_cycle_id;
BEGIN
    -- Resolve Cycle
    IF v_cycle_id IS NULL THEN
        v_cycle_id := public.get_current_academic_cycle();
    END IF;

    -- Auto-Repair/Sync state before fetching
    PERFORM public.admin_reconcile_student_account(p_student_id);

    -- Summary Stats
    SELECT jsonb_build_object(
        'total_billed', COALESCE(total_billed, 0),
        'total_paid', COALESCE(total_paid, 0),
        'outstanding', COALESCE(outstanding_balance, 0),
        'unallocated', COALESCE(unallocated_funds, 0)
    ) INTO v_summary
    FROM public.student_fee_accounts
    WHERE student_id = p_student_id;

    -- Installments
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'amount', total_amount,
        'paid', paid_amount,
        'due_date', due_date,
        'status', status,
        'is_overdue', (due_date < NOW() AND status NOT IN ('paid', 'cancelled', 'Success', 'Completed'))
    )) INTO v_installments
    FROM public.fee_invoices
    WHERE student_id = p_student_id
      AND academic_cycle_id = v_cycle_id
    ORDER BY due_date ASC;

    -- History
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'date', payment_date,
        'amount', amount,
        'mode', payment_method,
        'status', status,
        'ref_id', transaction_id,
        'proof_url', proof_document_url
    )) INTO v_history
    FROM public.fee_payments
    WHERE student_id = p_student_id
    ORDER BY payment_date DESC;

    RETURN jsonb_build_object(
        'summary', COALESCE(v_summary, '{"total_billed":0, "total_paid":0, "outstanding":0, "unallocated":0}'::jsonb),
        'installments', COALESCE(v_installments, '[]'::jsonb),
        'history', COALESCE(v_history, '[]'::jsonb),
        'cycle_id', v_cycle_id
    );
END;
$$;

-- [6] DASHBOARD AGGREGATION REPAIR (Live)
CREATE OR REPLACE FUNCTION public.get_finance_dashboard_snapshot(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_due NUMERIC;
    v_total_paid NUMERIC;
    v_total_outstanding NUMERIC;
    v_overdue_count INTEGER;
BEGIN
    SELECT 
        COALESCE(SUM(total_billed), 0),
        COALESCE(SUM(total_paid), 0),
        COALESCE(SUM(outstanding_balance), 0)
    INTO v_total_due, v_total_paid, v_total_outstanding
    FROM public.student_fee_accounts sfa
    JOIN public.student_profiles sp ON sfa.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id);

    SELECT COUNT(*) INTO v_overdue_count
    FROM public.fee_invoices fi
    JOIN public.student_profiles sp ON fi.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND fi.due_date < NOW() 
      AND fi.status NOT IN ('paid', 'cancelled', 'Success', 'Completed');

    RETURN jsonb_build_object(
        'total_billed', v_total_due,
        'total_paid', v_total_paid,
        'total_outstanding', v_total_outstanding,
        'overdue_count', v_overdue_count,
        'last_updated', NOW()
    );
END;
$$;

COMMIT;
