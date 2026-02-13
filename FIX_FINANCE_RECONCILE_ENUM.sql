-- FIX: invoice_status Enum Case Sensitivity
-- The invoice_status enum is lowercase ('pending', 'paid', 'overdue', 'cancelled', 'partial').
-- Previous functions operated on 'Cancelled' (Title Case) causing Protocol Failure.

BEGIN;

-- 1. FIX: admin_reconcile_student_account
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_billed NUMERIC;
    v_total_paid NUMERIC;
    v_unallocated NUMERIC;
    v_integrity INT;
BEGIN
    -- Calculate Total Liability (Excluding cancelled invoices)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND status != 'cancelled'; -- FIXED

    -- Calculate Total Settlements (Completed and Pending payments)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND status IN ('Completed', 'Pending');

    -- Identify Unallocated Magnitude (Payments not linked to a specific invoice)
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND invoice_id IS NULL AND status = 'Completed';

    -- Calculate Integrity Score (Percentage of dues cleared)
    v_integrity := CASE 
        WHEN v_total_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_total_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_total_billed * 100)::INT))
    END;

    -- Update Summary Node (Atomic Upsert)
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_total_billed, v_total_paid, (v_total_billed - v_total_paid), 
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

-- 2. FIX: generate_student_ledger_for_student
CREATE OR REPLACE FUNCTION public.generate_student_ledger_for_student(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_grade TEXT;
    v_structure_id BIGINT;
    v_component RECORD;
    v_count INT := 0;
BEGIN
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Grade context not initialized.');
    END IF;

    SELECT id INTO v_structure_id 
    FROM public.fee_structures 
    WHERE target_grade = v_grade AND status = 'Active' AND is_default = true
    ORDER BY created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No default active structure for Grade ' || v_grade);
    END IF;

    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    FOR v_component IN 
        SELECT * FROM public.fee_components WHERE structure_id = v_structure_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
            AND description ILIKE v_component.name || '%'
            AND status != 'cancelled' -- FIXED
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, total_amount, due_date, description, status, created_at
            ) VALUES (
                p_student_id, v_component.amount, NOW() + INTERVAL '15 days',
                v_component.name || ' (INITIAL_SYNC)', 'pending', NOW() -- Ensure lowercase insert too
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'invoices_created', v_count, 'structure_id', v_structure_id);
END;
$$;

-- 3. FIX: admin_generate_bulk_invoices
CREATE OR REPLACE FUNCTION public.admin_generate_bulk_invoices(
    p_branch_id BIGINT,
    p_class_id BIGINT,
    p_billing_month TEXT,
    p_billing_year TEXT,
    p_due_date DATE
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student RECORD;
    v_component RECORD;
    v_count INT := 0;
BEGIN
    FOR v_student IN 
        SELECT sp.user_id, sfa.structure_id
        FROM public.student_profiles sp
        JOIN public.student_fee_assignments sfa ON sp.user_id = sfa.student_id
        WHERE sp.assigned_class_id = p_class_id
    LOOP
        FOR v_component IN 
            SELECT * FROM public.fee_components 
            WHERE structure_id = v_student.structure_id 
            AND frequency IN ('Monthly', 'Quarterly')
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.fee_invoices 
                WHERE student_id = v_student.user_id 
                AND description ILIKE v_component.name || '%'
                AND description ILIKE '%' || p_billing_month || ' ' || p_billing_year || '%'
                AND status != 'cancelled' -- FIXED
            ) THEN
                INSERT INTO public.fee_invoices (
                    student_id, total_amount, due_date, description, status
                ) VALUES (
                    v_student.user_id, v_component.amount, p_due_date,
                    v_component.name || ' (' || p_billing_month || ' ' || p_billing_year || ')', 'pending' -- Ensure lowercase insert
                );
                v_count := v_count + 1;
            END IF;
        END LOOP;
        PERFORM public.admin_reconcile_student_account(v_student.user_id);
    END LOOP;
    RETURN jsonb_build_object('success', true, 'invoices_generated', v_count);
END;
$$;

-- 4. FIX: get_student_running_ledger
CREATE OR REPLACE FUNCTION public.get_student_running_ledger(p_student_id UUID)
RETURNS TABLE (
    transaction_date TIMESTAMPTZ,
    identifier TEXT,
    description TEXT,
    debit NUMERIC,
    credit NUMERIC,
    running_balance NUMERIC,
    protocol TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    WITH raw_entries AS (
        -- Debits (Invoices/Liabilities)
        SELECT 
            fi.created_at as t_date,
            'INV-' || fi.id::TEXT as idnt,
            fi.description as descr,
            fi.total_amount as dbt,
            0::NUMERIC as crdt,
            CASE 
                WHEN fi.description ILIKE '%SYSTEM_AUTO_SYNC%' THEN 'SYSTEM_SYNC'
                ELSE 'MANUAL_DEBIT'
            END as prot
        FROM public.fee_invoices fi
        WHERE fi.student_id = p_student_id AND fi.status != 'cancelled' -- FIXED

        UNION ALL

        -- Credits (Payments/Settlements)
        SELECT 
            COALESCE(fp.payment_date, fp.created_at) as t_date,
            'PAY-' || fp.id::TEXT as idnt,
            'Settlement: ' || COALESCE(fp.payment_method, 'Transfer'),
            0::NUMERIC as dbt,
            fp.amount as crdt,
            CASE 
                WHEN fp.invoice_id IS NULL THEN 'UNALLOCATED_ADVANCE'
                ELSE 'ALLOCATED_SETTLEMENT'
            END as prot
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id AND fp.status = 'Completed'
    )
    SELECT 
        t_date as transaction_date,
        idnt as identifier,
        descr as description,
        dbt as debit,
        crdt as credit,
        SUM(dbt - crdt) OVER (ORDER BY t_date ASC, idnt ASC) as running_balance,
        prot as protocol
    FROM raw_entries
    ORDER BY t_date DESC, idnt DESC;
END;
$$;

COMMIT;
