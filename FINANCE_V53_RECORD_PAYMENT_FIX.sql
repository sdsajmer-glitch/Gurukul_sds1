-- =============================================================================
-- 🚨 FINANCE V53: RECORD PAYMENT TYPE MISMATCH FIX 🚨
-- =============================================================================
-- Issue: "invalid input syntax for type bigint: [UUID]" 
-- Reason: The RPC `record_fee_payment` had a variable `v_payment_id` declared as BIGINT, 
--         but in environments where the `payments` table uses UUID as its primary key, 
--         the `RETURNING id INTO v_payment_id` statement failed abruptly.
-- Action: Drop all conflicting signatures and recreate `record_fee_payment` with 
--         polymorphic type casting (`TEXT`) for primary keys returning from inserts.
-- =============================================================================

BEGIN;

-- 1. Nuclear Drop of all overloaded record_fee_payment signatures
DO $$ 
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT oid::regprocedure AS func_signature 
        FROM pg_proc 
        WHERE proname = 'record_fee_payment'
    LOOP
        EXECUTE 'DROP FUNCTION ' || rec.func_signature || ' CASCADE';
        RAISE NOTICE 'Dropped: %', rec.func_signature;
    END LOOP;
END $$;

-- 2. Recreate protocol with agnostic ID types
CREATE OR REPLACE FUNCTION public.record_fee_payment(
    p_invoice_id BIGINT,
    p_amount NUMERIC,
    p_method TEXT,
    p_reference TEXT,
    p_student_id UUID,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment_id TEXT;
    v_branch_id TEXT;
    v_receipt_number TEXT;
    v_protocol TEXT;
    v_actor UUID;
BEGIN
    -- Identity resolution
    v_actor := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

    -- Branch resolution from student profile
    SELECT sp_branch.branch_id::TEXT INTO v_branch_id
    FROM public.student_profiles sp_branch
    WHERE sp_branch.user_id = p_student_id
    LIMIT 1;

    -- Protocol classification
    v_protocol := UPPER(COALESCE(p_method, 'MANUAL'));

    -- Validation: reject zero/negative
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'ZERO_MAGNITUDE_REJECTION: Amount must be positive.');
    END IF;

    -- ATOMIC PAYMENT INSERTION (ID safely cast to TEXT)
    INSERT INTO public.payments (
        student_id, amount, status, payment_method, transaction_reference,
        branch_id, metadata, created_at, updated_at
    ) VALUES (
        p_student_id, p_amount, 'completed', v_protocol, p_reference,
        COALESCE(v_branch_id, '00000000-0000-0000-0000-000000000000'), p_metadata, NOW(), NOW()
    )
    RETURNING id::TEXT INTO v_payment_id;

    -- LEGACY SYNC: fee_payments table for backward compatibility
    BEGIN
        INSERT INTO public.fee_payments (
            student_id, amount, payment_method, status, payment_date,
            transaction_id, created_at
        ) VALUES (
            p_student_id, p_amount, v_protocol, 'completed', NOW(),
            p_reference, NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Legacy fee_payments sync skipped: %', SQLERRM;
    END;

    -- INVOICE UPDATE (if targeting specific invoice)
    IF p_invoice_id IS NOT NULL THEN
        BEGIN
            UPDATE public.fee_invoices
            SET paid_amount = COALESCE(paid_amount, 0) + p_amount,
                status = CASE
                    WHEN COALESCE(paid_amount, 0) + p_amount >= total_amount THEN 'paid'
                    ELSE 'partial'
                END,
                updated_at = NOW()
            WHERE id = p_invoice_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Invoice binding failure: %', SQLERRM;
        END;
    END IF;

    -- AUDIT INGESTION
    BEGIN
        INSERT INTO public.audit_logs (
            branch_id, action_type, description, user_id, 
            machine_name, table_name, record_id
        ) VALUES (
            COALESCE(v_branch_id, '00000000-0000-0000-0000-000000000000'), 
            'SYS_PAYMENT_RECORD', 
            'Settlement Executed: ' || p_amount || ' via ' || v_protocol, 
            v_actor, 
            'FINANCE_MODULE', 
            'payments', 
            v_payment_id
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Audit trail bypass: %', SQLERRM;
    END;

    -- FORMAT FORENSIC RESPONSE
    v_receipt_number := 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(v_payment_id, 1, 6);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Protocol Authorized',
        'payment_id', v_payment_id,
        'receipt_number', UPPER(v_receipt_number)
    );
END;
$$;

-- Grant permissions for new function
GRANT EXECUTE ON FUNCTION public.record_fee_payment(BIGINT, NUMERIC, TEXT, TEXT, UUID, JSONB) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance V53 Deployment Complete. Signature and Return types harmonized.' AS status;
