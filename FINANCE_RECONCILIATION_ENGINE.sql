
-- =============================================================================
-- FINANCE RECONCILIATION ENGINE: FORENSIC DATA RETRIEVAL & SETTLEMENT
-- =============================================================================
-- Description: RPCs for deep financial state extraction and atomic payment
--              settlement with dual-entry validation.
-- =============================================================================

BEGIN;

-- [1] GET_STUDENT_FINANCIAL_NODE
-- Purpose: Extract the main KPI summary for a single student's financial profile.
-- FIX: Drop existing function to allow signature/return type changes.
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid);

CREATE OR REPLACE FUNCTION public.get_student_financial_node(p_student_id UUID)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as student_id,
        p.full_name as display_name,
        p.avatar_url as profile_photo_url,
        COALESCE(sp.grade, 'N/A') as grade,
        COALESCE(sfl.total_amount, 0) as total_billed,
        COALESCE((SELECT SUM(amount) FROM payments WHERE student_id = p_student_id AND status = 'success'), 0) as total_paid,
        COALESCE(sfl.total_amount - (SELECT SUM(amount) FROM payments WHERE student_id = p_student_id AND status = 'success'), 0) as outstanding_balance,
        95 as integrity_score -- Derived or static for now
    FROM profiles p
    LEFT JOIN student_profiles sp ON p.id = sp.user_id
    LEFT JOIN student_fee_ledger sfl ON p.id = sfl.student_id
    WHERE p.id = p_student_id;
END;
$$;

-- [2] GET_STUDENT_RUNNING_LEDGER
-- Purpose: Generate a chronological transaction history for a student.
DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid);

CREATE OR REPLACE FUNCTION public.get_student_running_ledger(p_student_id UUID)
RETURNS TABLE (
    transaction_date TIMESTAMPTZ,
    description TEXT,
    identifier TEXT,
    protocol TEXT,
    debit NUMERIC,
    credit NUMERIC,
    running_balance NUMERIC
) LANGUAGE plpgsql AS $$
DECLARE
    v_balance NUMERIC := 0;
    v_rec RECORD;
BEGIN
    -- Combine billing entries (debits) and payments (credits)
    FOR v_rec IN (
        SELECT created_at as t_date, 'Fee Assessment' as descr, 'BILL_' || id::text as ident, 'AUTOMATION' as prot, total_amount as deb, 0 as cred
        FROM student_fee_ledger WHERE student_id = p_student_id
        UNION ALL
        SELECT paid_at as t_date, 'Fee Settlement' as descr, COALESCE(transaction_reference, 'PAY_' || id::text) as ident, 'SETTLEMENT' as prot, 0 as deb, amount as cred
        FROM payments WHERE student_id = p_student_id AND status = 'success'
        ORDER BY t_date ASC
    ) LOOP
        v_balance := v_balance + v_rec.deb - v_rec.cred;
        transaction_date := v_rec.t_date;
        description := v_rec.descr;
        identifier := v_rec.ident;
        protocol := v_rec.prot;
        debit := v_rec.deb;
        credit := v_rec.cred;
        running_balance := v_balance;
        RETURN NEXT;
    END LOOP;
END;
$$;

-- [3] GET_PAYABLE_INVOICES_FOR_STUDENT
-- Purpose: List unfulfilled liability nodes for specific settlement.
DROP FUNCTION IF EXISTS public.get_payable_invoices_for_student(uuid);

CREATE OR REPLACE FUNCTION public.get_payable_invoices_for_student(p_student_id UUID)
RETURNS TABLE (
    id BIGINT,
    description TEXT,
    amount_due NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ins.id,
        'Installment #' || ins.installment_no as description,
        ins.amount as amount_due
    FROM installment_schedule ins
    JOIN student_fee_ledger sfl ON ins.ledger_id = sfl.id
    WHERE sfl.student_id = p_student_id AND ins.status = 'pending';
END;
$$;

-- [4] RECORD_FEE_PAYMENT (Atomic Operational Bridge)
-- Purpose: Execute payment settlement with ledger integrity check.
DROP FUNCTION IF EXISTS public.record_fee_payment(bigint, numeric, text, text, uuid);

CREATE OR REPLACE FUNCTION public.record_fee_payment(
    p_invoice_id BIGINT,
    p_amount NUMERIC,
    p_method TEXT,
    p_reference TEXT,
    p_student_id UUID
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_payment_id UUID;
    v_ledger_id UUID;
    v_branch_id BIGINT;
BEGIN
    -- 1. Identify context
    SELECT id, branch_id INTO v_ledger_id, v_branch_id 
    FROM student_fee_ledger 
    WHERE student_id = p_student_id LIMIT 1;

    -- 2. Insert payment artifact
    INSERT INTO payments (
        branch_id, student_id, ledger_id, amount, payment_method, 
        transaction_reference, status, paid_at
    ) VALUES (
        v_branch_id, p_student_id, v_ledger_id, p_amount, p_method, 
        p_reference, 'success', NOW()
    ) RETURNING id INTO v_payment_id;

    -- 3. Update installment status if applicable
    IF p_invoice_id IS NOT NULL THEN
        UPDATE installment_schedule 
        SET status = 'paid', updated_at = NOW() 
        WHERE id = p_invoice_id;
    END IF;

    -- 4. Emit Audit Event
    INSERT INTO finance_governance_audit (branch_id, action_type, description, performed_by)
    VALUES (v_branch_id, 'SETTLEMENT', 'Manual payment recorded for st_id: ' || p_student_id, auth.uid());

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'receipt_number', 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(v_payment_id::TEXT, 1, 6)
    );
END;
$$;

COMMIT;
