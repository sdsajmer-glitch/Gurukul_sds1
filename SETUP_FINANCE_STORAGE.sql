-- =============================================================================
-- FINANCE STORAGE & MANUAL PAYMENT HARDENING
-- =============================================================================

BEGIN;

-- 1. Create 'secure-documents' bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('secure-documents', 'secure-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies (RLS)
-- Allow Authenticated Users to Upload
CREATE POLICY "Allow Authenticated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'secure-documents');

-- Allow Public Read (or Authenticated Read) - For now Public for receipts
CREATE POLICY "Allow Public Read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'secure-documents');

-- 3. Update Payment Status Enum Constraint
ALTER TABLE public.fee_payments 
DROP CONSTRAINT IF EXISTS fee_payments_status_check;

ALTER TABLE public.fee_payments 
ADD CONSTRAINT fee_payments_status_check 
CHECK (status IN ('success', 'failed', 'pending', 'Pending Verification', 'Verified', 'Rejected'));

-- 4. RPC Update: submit_manual_payment_receipt
-- Ensure it handles invoice_id link correctly to installments
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
        invoice_id, -- Linking primarily to the first invoice if multiple selected
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
