-- FIX: Allow payments without a ledger_id (e.g. Unallocated/Advance Payments)
-- The error "null value in column ledger_id violates not-null constraint" occurs
-- when a student has no Billing Ledger yet but makes a payment.

BEGIN;

-- 1. Relax the NOT NULL constraint on ledger_id
ALTER TABLE public.payments ALTER COLUMN ledger_id DROP NOT NULL;

COMMIT;
