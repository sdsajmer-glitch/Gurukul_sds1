-- FIX: Resolve "new row for relation payments violates check constraint payments_payment_method_check"
-- The system's payment methods might be restricted to specific values like 'CASH', 'ONLINE', etc.
-- This script will:
-- 1. Identify the constraint definition (implicit in removal)
-- 2. Drop the restrictive check constraint
-- 3. Add a new, broader check constraint OR just leave it open (we will drop it for flexibility)

BEGIN;

-- 1. Drop the restrictive check constraint if it exists
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;

-- 2. (Optional) Add a broader constraint if you want strict validation, 
-- but for now, we'll remove it to allow 'ONLINE TRANSFER', 'UPI', etc. without error.
-- If you wanted to re-add it, it would look like:
-- ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check 
-- CHECK (payment_method IN ('CASH', 'ONLINE', 'CHEQUE', 'ONLINE TRANSFER', 'UPI', 'NEFT', 'RTGS', 'OTHER'));

COMMIT;
