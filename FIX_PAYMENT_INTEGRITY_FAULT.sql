-- FIX: Handle missing parameters and enhance error reporting for payments
-- This script updates the record_fee_payment function to gracefully handle missing branch_id or ledger_id
-- and provides clear error messages instead of generic "Data Integrity Fault".

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
    v_branch_id UUID;
BEGIN
    -- 1. Identify Branch (Primary Context)
    -- Try to get branch from student profile first as it's the most reliable source
    SELECT branch_id INTO v_branch_id 
    FROM student_profiles 
    WHERE user_id = p_student_id 
    LIMIT 1;

    -- If not found, try to get from ledger
    IF v_branch_id IS NULL THEN
        SELECT branch_id INTO v_branch_id 
        FROM student_fee_ledger 
        WHERE student_id = p_student_id 
        LIMIT 1;
    END IF;

    -- If still null, we cannot proceed as branch_id is mandatory for security/scoping
    IF v_branch_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Configuration Error: Student is not linked to any valid Branch. Please contact support.'
        );
    END IF;

    -- 2. Identify Ledger (Financial Context)
    -- Get the most recent active ledger
    SELECT id INTO v_ledger_id 
    FROM student_fee_ledger 
    WHERE student_id = p_student_id 
    ORDER BY created_at DESC 
    LIMIT 1;

    -- 3. Validation for Installment Payment
    IF p_invoice_id IS NOT NULL AND v_ledger_id IS NULL THEN
         RETURN jsonb_build_object(
            'success', false, 
            'message', 'Fee Ledger Missing: Cannot pay an invoice without a valid fee ledger. Please generate student fees first.'
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

        -- 6. Emit Audit Event
        INSERT INTO finance_governance_audit (branch_id, action_type, description, performed_by)
        VALUES (v_branch_id, 'SETTLEMENT', 'Manual payment recorded for st_id: ' || p_student_id, auth.uid());

        RETURN jsonb_build_object(
            'success', true,
            'payment_id', v_payment_id,
            'receipt_number', 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(v_payment_id::TEXT, 1, 6)
        );

    EXCEPTION 
        WHEN not_null_violation THEN
            -- Check specifically if ledger_id caused the issue
            IF v_ledger_id IS NULL THEN
                 RETURN jsonb_build_object(
                    'success', false, 
                    'message', 'Fee Ledger Required: This student does not have an active fee account. Please assign a Class/Section and generate fees first.'
                );
            ELSE
                RETURN jsonb_build_object(
                    'success', false, 
                    'message', 'Data Integrity Error: Missing mandatory field during payment recording. ' || SQLERRM
                );
            END IF;
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'System Protocol Error: ' || SQLERRM
            );
    END;
END;
$$;

COMMIT;
