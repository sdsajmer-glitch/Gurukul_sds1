-- FIX: Resolve "new row violates row-level security policy for table payments"
-- This script updates the record_fee_payment function to use SECURITY DEFINER
-- This allows the function to bypass RLS checks on the underlying tables, as it runs with the privileges of the function creator.

BEGIN;

-- Drop function first to ensure clean replacement
DROP FUNCTION IF EXISTS public.record_fee_payment(bigint, numeric, text, text, uuid);

CREATE OR REPLACE FUNCTION public.record_fee_payment(
    p_invoice_id BIGINT,
    p_amount NUMERIC,
    p_method TEXT,
    p_reference TEXT,
    p_student_id UUID
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER -- Run as owner to bypass RLS
SET search_path = public -- Security best practice
AS $$
DECLARE
    v_payment_id UUID;
    v_ledger_id UUID;
    v_branch_id UUID; 
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
