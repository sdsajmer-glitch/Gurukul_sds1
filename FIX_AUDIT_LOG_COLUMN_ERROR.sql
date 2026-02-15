-- FIX: Resolve "column performed_by does not exist" in finance_governance_audit
-- The audit table uses 'user_id' instead of 'performed_by' to track the actor.

BEGIN;

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
    v_branch_id TEXT; -- Uses TEXT to accommodate both UUID and Legacy IDs
BEGIN
    -- 1. Identify Branch (Primary Context)
    -- Try to get branch from student profile first as it's the most reliable source
    SELECT branch_id::TEXT INTO v_branch_id 
    FROM student_profiles 
    WHERE user_id = p_student_id 
    LIMIT 1;

    -- If not found, try to get from ledger
    IF v_branch_id IS NULL THEN
        SELECT branch_id::TEXT INTO v_branch_id 
        FROM student_fee_ledger 
        WHERE student_id = p_student_id 
        LIMIT 1;
    END IF;

    -- If still null, default to 'MAIN' or handle error
    IF v_branch_id IS NULL THEN
        v_branch_id := 'MAIN'; -- Fallback to generic branch
    END IF;

    -- 2. Identify Ledger (Financial Context)
    -- Get the most recent active ledger
    SELECT id INTO v_ledger_id 
    FROM student_fee_ledger 
    WHERE student_id = p_student_id 
    ORDER BY created_at DESC 
    LIMIT 1;

    -- 3. Validation for Installment Payment
    -- Note: We relaxed the ledger_id constraint on payments table, so we can proceed even if v_ledger_id IS NULL
    -- But if p_invoice_id is provided, we SHOULD have a ledger.
    IF p_invoice_id IS NOT NULL AND v_ledger_id IS NULL THEN
         RETURN jsonb_build_object(
            'success', false, 
            'message', 'Fee Ledger Missing: Cannot pay a specific invoice without a valid fee ledger.'
        );
    END IF;

    -- 4. Execute Payment Recording with Error Handling
    BEGIN
        INSERT INTO payments (
            branch_id, student_id, ledger_id, amount, payment_method, 
            transaction_reference, status, paid_at
        ) VALUES (
            v_branch_id, p_student_id, v_ledger_id, p_amount, p_method, 
            p_reference, 'success', NOW()
        ) RETURNING id INTO v_payment_id;

        -- 5. Update installment status if linked to specific invoice
        IF p_invoice_id IS NOT NULL THEN
            UPDATE installment_schedule 
            SET status = 'paid', updated_at = NOW() 
            WHERE id = p_invoice_id;
        END IF;

        -- 6. Emit Audit Event (CORRECTED COLUMN NAME)
        -- Changed 'performed_by' to 'user_id' based on table schema in FINANCE_OVERSIGHT_ENGINE.sql
        INSERT INTO finance_governance_audit (branch_id, action_type, description, user_id)
        VALUES (v_branch_id, 'SETTLEMENT', 'Manual payment recorded for st_id: ' || p_student_id, auth.uid());

        RETURN jsonb_build_object(
            'success', true,
            'payment_id', v_payment_id,
            'receipt_number', 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(v_payment_id::TEXT, 1, 6)
        );

    EXCEPTION 
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'System Protocol Error: ' || SQLERRM
            );
    END;
END;
$$;

COMMIT;
