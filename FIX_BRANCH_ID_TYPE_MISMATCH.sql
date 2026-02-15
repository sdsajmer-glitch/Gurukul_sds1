-- FIX: Resolve "invalid input syntax for type uuid: '4'"
-- This script relaxes the type constraints on branch_id to allow both UUIDs and Legacy Integer IDs (as strings).
-- It also updates the record_fee_payment function to handle branch_id as TEXT.

BEGIN;

-- 1. Relax Table Constraints (Safely handle FKs and Type Conversion)
DO $$ 
BEGIN 
    -- Attempt to drop foreign keys if they exist (since we are moving to mixed types)
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_branch_id_fkey;
    ALTER TABLE finance_governance_audit DROP CONSTRAINT IF EXISTS finance_governance_audit_branch_id_fkey;
EXCEPTION 
    WHEN OTHERS THEN 
        RAISE NOTICE 'Constraint drop failed or not found, proceeding...';
END $$;

-- Alter columns to TEXT to support '4' (Int) and 'uuid-string'
ALTER TABLE payments ALTER COLUMN branch_id TYPE TEXT USING branch_id::TEXT;
ALTER TABLE finance_governance_audit ALTER COLUMN branch_id TYPE TEXT USING branch_id::TEXT;


-- 2. Update the RPC Function to use TEXT for branch_id
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
    v_branch_id TEXT; -- Fixed: Changed to TEXT to accept '4' or UUIDs
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
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'System Protocol Error: ' || SQLERRM
            );
    END;
END;
$$;

COMMIT;
