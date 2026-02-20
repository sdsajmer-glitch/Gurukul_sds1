-- =============================================================================
-- 🚨 FINANCE V52: PAYMENT CONSTRAINT PATCH 🚨
-- =============================================================================
-- Date: 2026-02-20
-- Issue: "new row for relation 'payments' violates check constraint 'payments_status_check'"
--        when calling record_fee_payment.
-- Reason: The RPC `record_fee_payment` inserts status code 'completed' (or 'partial'),
--         but the database constraint `payments_status_check` only accepts things 
--         like 'success', 'failed', 'pending', etc.
-- Action: Overwrite the check constraints on both `payments` and legacy `fee_payments` 
--         tables to safely accept all valid system states.
-- =============================================================================

BEGIN;

-- 1. Fix constraint on the modern `payments` table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'payments'
    ) THEN
        ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
        ALTER TABLE public.payments ADD CONSTRAINT payments_status_check 
        CHECK (LOWER(status::text) IN (
            'completed', 
            'success', 
            'pending', 
            'failed', 
            'refunded', 
            'partial', 
            'pending verification', 
            'verified', 
            'rejected'
        ));
        RAISE NOTICE '[V52] payments table constraint updated successfully.';
    END IF;
END $$;

-- 2. Fix constraint on the legacy `fee_payments` table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'fee_payments'
    ) THEN
        ALTER TABLE public.fee_payments DROP CONSTRAINT IF EXISTS fee_payments_status_check;
        ALTER TABLE public.fee_payments ADD CONSTRAINT fee_payments_status_check 
        CHECK (LOWER(status::text) IN (
            'completed', 
            'success', 
            'pending', 
            'failed', 
            'refunded', 
            'partial', 
            'pending verification', 
            'verified', 
            'rejected'
        ));
        RAISE NOTICE '[V52] fee_payments table constraint updated successfully.';
    END IF;
END $$;

-- 3. Also verify that the payments table schema accepts 'completed' inside the RPC
-- (No further RPC changes required if the constraint is relaxed, as the RPC already uses 'completed')

COMMIT;

SELECT 'SUCCESS: Finance V52 Payment Constraint Fix deployed. The payments table now accepts "completed" and "success" interchangeably.' AS status;
