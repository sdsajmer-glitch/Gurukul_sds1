-- =============================================================================
-- MANUAL PAYMENT RECEIPT SUPPORT
-- =============================================================================

BEGIN;

-- 1. Add proof_document_url to fee_payments if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments' AND column_name = 'proof_document_url') THEN
        ALTER TABLE public.fee_payments ADD COLUMN proof_document_url TEXT;
    END IF;
END $$;

-- 2. Create RPC for Manual Payment Submission
CREATE OR REPLACE FUNCTION public.submit_manual_payment_receipt(
    p_student_id UUID,
    p_amount NUMERIC,
    p_transaction_date DATE,
    p_transaction_ref TEXT,
    p_payment_mode TEXT,
    p_proof_url TEXT,
    p_invoice_ids UUID[] DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    INSERT INTO public.fee_payments (
        student_id,
        amount,
        payment_date,
        payment_method,
        transaction_id,
        status,
        proof_document_url,
        invoice_id,
        notes,
        created_at,
        updated_at
    )
    VALUES (
        p_student_id,
        p_amount,
        p_transaction_date,
        p_payment_mode,
        p_transaction_ref,
        'Pending Verification',
        p_proof_url,
        CASE WHEN p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN p_invoice_ids[1] ELSE NULL END,
        'Manual Receipt Uploaded by Parent',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id);
END;
$$;

COMMIT;
