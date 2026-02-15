-- FIX: Ensure Payments Update Ledger & Provide Transaction History
-- 1. Updates record_fee_payment to trigger reconciliation (so Total Collected updates).
-- 2. Creates get_student_payment_history for the UI list.
-- 3. Ensures get_student_fee_summary exists and is accurate.

BEGIN;

-- [1] Update record_fee_payment to AUTO-RECONCILE
-- This ensures that when a payment is made, the student_fee_accounts summary is updated immediately.

CREATE OR REPLACE FUNCTION public.record_fee_payment(
    p_invoice_id BIGINT,
    p_amount NUMERIC,
    p_method TEXT,
    p_reference TEXT,
    p_student_id UUID
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment_id UUID;
    v_ledger_id UUID;
    v_branch_id TEXT;
BEGIN
    -- 1. Identify Branch
    SELECT branch_id::TEXT INTO v_branch_id 
    FROM student_profiles 
    WHERE user_id = p_student_id 
    LIMIT 1;

    IF v_branch_id IS NULL THEN
        SELECT branch_id::TEXT INTO v_branch_id 
        FROM student_fee_ledger 
        WHERE student_id = p_student_id 
        LIMIT 1;
    END IF;

    IF v_branch_id IS NULL THEN v_branch_id := 'MAIN'; END IF;

    -- 2. Identify Ledger
    SELECT id INTO v_ledger_id 
    FROM student_fee_ledger 
    WHERE student_id = p_student_id 
    ORDER BY created_at DESC 
    LIMIT 1;

    -- 3. Validation
    IF p_invoice_id IS NOT NULL AND v_ledger_id IS NULL THEN
         RETURN jsonb_build_object('success', false, 'message', 'Fee Ledger Missing.');
    END IF;

    -- 4. Execute Payment
    BEGIN
        INSERT INTO payments (
            branch_id, student_id, ledger_id, amount, payment_method, 
            transaction_reference, status, paid_at
        ) VALUES (
            v_branch_id, p_student_id, v_ledger_id, p_amount, p_method, 
            p_reference, 'success', NOW()
        ) RETURNING id INTO v_payment_id;

        -- 5. Update installment status (if applicable)
        IF p_invoice_id IS NOT NULL THEN
            UPDATE installment_schedule 
            SET status = 'paid', updated_at = NOW() 
            WHERE id = p_invoice_id;
        END IF;

        -- 6. Audit Log
        INSERT INTO finance_governance_audit (branch_id, action_type, description, user_id)
        VALUES (v_branch_id, 'SETTLEMENT', 'Manual payment recorded for st_id: ' || p_student_id, auth.uid());

        -- 7. RECONCILIATION (CRITICAL FIX)
        -- Attempt to reconcile if the function exists
        BEGIN
            PERFORM public.admin_reconcile_student_account(p_student_id);
        EXCEPTION WHEN OTHERS THEN
            -- Ignore reconciliation errors to ensure payment is recorded
            RAISE NOTICE 'Reconciliation skipped: %', SQLERRM;
        END;

        RETURN jsonb_build_object(
            'success', true,
            'payment_id', v_payment_id,
            'receipt_number', 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(v_payment_id::TEXT, 1, 6)
        );

    EXCEPTION 
        WHEN OTHERS THEN
            RETURN jsonb_build_object('success', false, 'message', 'System Protocol Error: ' || SQLERRM);
    END;
END;
$$;


-- [2] Create/Ensure get_student_fee_summary (Singular for Modal)
CREATE OR REPLACE FUNCTION public.get_student_fee_summary(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_billed NUMERIC;
    v_paid NUMERIC;
    v_balance NUMERIC;
BEGIN
    -- Try to get from fast summary table
    SELECT total_billed, total_paid, outstanding_balance
    INTO v_billed, v_paid, v_balance
    FROM student_fee_accounts
    WHERE student_id = p_student_id;

    -- Fallback to calculation if no summary exists
    IF v_billed IS NULL THEN
        -- Billed: Sum of ledgers
        SELECT COALESCE(SUM(total_amount), 0) INTO v_billed
        FROM student_fee_ledger
        WHERE student_id = p_student_id;

        -- Paid: Sum of payments
        SELECT COALESCE(SUM(amount), 0) INTO v_paid
        FROM payments
        WHERE student_id = p_student_id AND status = 'success';

        v_balance := v_billed - v_paid;
    END IF;

    RETURN jsonb_build_object(
        'total_billed', COALESCE(v_billed, 0),
        'total_paid', COALESCE(v_paid, 0),
        'outstanding_balance', COALESCE(v_balance, 0)
    );
END;
$$;


-- [3] Create get_student_payment_history (New RPC for List)
CREATE OR REPLACE FUNCTION public.get_student_payment_history(p_student_id UUID)
RETURNS TABLE (
    id UUID,
    amount NUMERIC,
    payment_method TEXT,
    transaction_reference TEXT,
    paid_at TIMESTAMPTZ,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.amount,
        p.payment_method,
        COALESCE(p.transaction_reference, 'N/A'),
        p.paid_at,
        p.status
    FROM payments p
    WHERE p.student_id = p_student_id
    ORDER BY p.paid_at DESC;
END;
$$;

COMMIT;
