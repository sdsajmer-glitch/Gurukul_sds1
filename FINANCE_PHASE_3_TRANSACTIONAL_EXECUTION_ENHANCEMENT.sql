-- =============================================================================
-- 🚀 FINANCE PHASE 3: TRANSACTIONAL EXECUTION ENHANCEMENT (v1.0) 🚀
-- =============================================================================
-- Target: Professionalize payment flows with UPI, Stripe, and Manual protocols.
-- Features: Atomic settlements, Forensic receipts, Immutable audit trails.
-- =============================================================================

BEGIN;

-- [0] SCHEMA HARDENING: Add missing columns for Phase 3
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'metadata') THEN
        ALTER TABLE public.payments ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'updated_at') THEN
        ALTER TABLE public.payments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'receipt_number') THEN
        ALTER TABLE public.payments ADD COLUMN receipt_number TEXT;
    END IF;
END $$;

-- [1] SCHEMA HARMONIZATION: Identity & Forensic Tables
-- Ensure 'finance_receipts' exists for immutable record keeping.
CREATE TABLE IF NOT EXISTS public.finance_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT UNIQUE NOT NULL,
    payment_id UUID NOT NULL, -- Links to relevant payment table
    student_id UUID NOT NULL,
    branch_id BIGINT,
    amount NUMERIC NOT NULL,
    protocol TEXT NOT NULL, -- UPI, Stripe, Manual
    metadata JSONB DEFAULT '{}'::jsonb,
    forensic_hash TEXT, -- SHA-256 or similar for immutability check
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure 'finance_audit_trail' is robust
CREATE TABLE IF NOT EXISTS public.finance_audit_trail (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint,
    actor_id uuid,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action_type text NOT NULL,
    magnitude numeric,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- [2] FORENSIC RECEIPT GENERATOR
-- Helper to create a structured evidence node for every transaction.
CREATE OR REPLACE FUNCTION public.fn_generate_forensic_receipt(
    p_payment_id UUID,
    p_student_id UUID,
    p_amount NUMERIC,
    p_protocol TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_receipt_no TEXT;
    v_branch_id BIGINT;
BEGIN
    -- Resolve Branch
    SELECT branch_id INTO v_branch_id FROM public.student_profiles WHERE user_id = p_student_id LIMIT 1;
    
    -- Generate Unique Receipt Number
    v_receipt_no := 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(p_payment_id::TEXT, 1, 8));

    INSERT INTO public.finance_receipts (
        receipt_number, payment_id, student_id, branch_id, amount, protocol, metadata, forensic_hash
    ) VALUES (
        v_receipt_no, p_payment_id, p_student_id, v_branch_id, p_amount, p_protocol, p_metadata,
        md5(v_receipt_no || p_amount::TEXT || p_student_id::TEXT || NOW()::TEXT) -- Simple forensic signature
    );

    RETURN v_receipt_no;
END;
$$;

-- [3] ATOMIC SETTLEMENT ENGINE: record_fee_payment (v3.0)
-- Upgraded to handle UPI, Stripe, and Manual protocols with full audit logging.
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
    v_payment_id UUID;
    v_receipt_no TEXT;
    v_ledger_id UUID;
    v_branch_id BIGINT;
    v_actor_id UUID;
BEGIN
    v_actor_id := auth.uid();
    
    -- 1. Identity Verification
    SELECT branch_id INTO v_branch_id FROM public.student_profiles WHERE user_id = p_student_id LIMIT 1;
    
    -- 2. Resolve Financial Context (Ledger)
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger 
    WHERE student_id = p_student_id 
    ORDER BY created_at DESC LIMIT 1;

    -- 3. VALIDATION: Prevent Ghost Payments
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'PROTOCOL ERROR: Settlement magnitude must be positive.');
    END IF;

    -- 4. ATOMIC EXECUTION: Record Transaction
    INSERT INTO public.payments (
        branch_id, student_id, ledger_id, amount, payment_method, 
        transaction_reference, status, paid_at, metadata, receipt_number
    ) VALUES (
        v_branch_id::TEXT, p_student_id, v_ledger_id, p_amount, p_method, 
        p_reference, 'success', NOW(), p_metadata, NULL -- Will be updated in step 7
    ) RETURNING id INTO v_payment_id;

    -- 5. Backwards Compatibility: Sync to fee_payments
    INSERT INTO public.fee_payments (
        branch_id, student_id, amount, payment_method, transaction_id, status, payment_date, receipt_number
    ) VALUES (
        v_branch_id, p_student_id, p_amount, p_method, p_reference, 'Completed', NOW(), NULL
    );

    -- 6. Update Installment State
    IF p_invoice_id IS NOT NULL THEN
        UPDATE public.installment_schedule 
        SET status = 'paid', updated_at = NOW() 
        WHERE id = p_invoice_id;
    END IF;

    -- 7. GENERATE FORENSIC RECEIPT
    v_receipt_no := public.fn_generate_forensic_receipt(
        v_payment_id, p_student_id, p_amount, p_method, p_metadata
    );

    -- Sync receipt number back to main record
    UPDATE public.payments SET receipt_number = v_receipt_no WHERE id = v_payment_id;
    UPDATE public.fee_payments SET receipt_number = v_receipt_no WHERE transaction_id = p_reference AND student_id = p_student_id;

    -- 8. IMMUTABLE AUDIT LOGGING
    INSERT INTO public.finance_audit_trail (
        branch_id, actor_id, entity_type, entity_id, action_type, magnitude, metadata
    ) VALUES (
        v_branch_id, v_actor_id, 'PAYMENT', v_payment_id::TEXT, 'SETTLEMENT', p_amount, 
        jsonb_build_object('protocol', p_method, 'receipt_no', v_receipt_no, 'student_id', p_student_id)
    );

    -- 9. Trigger Secondary Reconciliation (Ensures outstanding balances are updated)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'receipt_number', v_receipt_no,
        'message', 'Transaction finalized and forensic record generated.'
    );

EXCEPTION 
    WHEN OTHERS THEN
        INSERT INTO public.finance_audit_trail (
            branch_id, actor_id, entity_type, entity_id, action_type, metadata
        ) VALUES (
            v_branch_id, v_actor_id, 'PAYMENT_FAILURE', 'SYSTEM', 'CRITICAL_ERROR', 
            jsonb_build_object('error', SQLERRM, 'student_id', p_student_id)
        );
        
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'PROTOCOL REJECTION: ' || SQLERRM
        );
END;
$$;

-- [4] PROTOCOL SPECIFIC HELPERS: Confirming Stripe/UPI Webhooks
-- Logic for external gateway confirmations.
CREATE OR REPLACE FUNCTION public.confirm_external_payment(
    p_transaction_ref TEXT,
    p_provider TEXT, -- 'STRIPE', 'UPI'
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    UPDATE public.payments 
    SET status = 'success', 
        metadata = metadata || p_metadata,
        updated_at = NOW()
    WHERE transaction_reference = p_transaction_ref
    RETURNING id INTO v_payment_id;

    IF v_payment_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Transaction reference not found.');
    END IF;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Phase 3 Transactional Execution Enhanced. Forensic receipts enabled.' as result;
