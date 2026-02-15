-- FIX: TRANSACTION HISTORY QUERY SAFETY
-- The previous query for `get_student_payment_history` was failing likely due to:
-- 1. `created_at` column potentially missing from `fee_payments`
-- 2. `paid_at` vs `payment_date` confusion
-- This script fixes it by being robust with columns.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_student_payment_history(p_student_id UUID)
RETURNS TABLE (
    id UUID,
    amount NUMERIC,
    payment_method TEXT,
    transaction_reference TEXT,
    paid_at TIMESTAMPTZ,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    
    -- Source 1: Enterprise Payments (Usually the source of truth for modern manual payments)
    SELECT 
        p.id,
        p.amount,
        p.payment_method,
        COALESCE(p.transaction_reference, 'N/A') as transaction_reference,
        COALESCE(p.paid_at, NOW()) as paid_at,
        p.status
    FROM public.payments p
    WHERE p.student_id = p_student_id

    UNION ALL

    -- Source 2: Legacy/Parent Payments (Older table)
    SELECT 
        fp.id,
        fp.amount,
        fp.payment_method,
        COALESCE(fp.transaction_id, 'N/A') as transaction_reference,
        -- Use payment_date directly. If it's NULL, use NOW() as safety fallback.
        -- We removed `fp.created_at` because it might not exist or be accessible.
        COALESCE(fp.payment_date, NOW()) as paid_at,
        fp.status
    FROM public.fee_payments fp
    WHERE fp.student_id = p_student_id
    
    ORDER BY paid_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_payment_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_payment_history(UUID) TO service_role;

COMMIT;
