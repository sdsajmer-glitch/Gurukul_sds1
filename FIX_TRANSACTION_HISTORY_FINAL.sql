-- FIX: TRANSACTION HISTORY TYPE SAFETY (FINAL)
-- Purpose: rigorously cast all columns to ensure UNION compatibility between 'payments' and 'fee_payments'.
-- This prevents silent failures where the RPC returns null data due to type mismatches.

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
    
    -- 1. Enterprise Payments (Explicit Casting)
    SELECT 
        p.id::UUID,
        p.amount::NUMERIC,
        p.payment_method::TEXT,
        COALESCE(p.transaction_reference, 'N/A')::TEXT AS transaction_reference,
        COALESCE(p.paid_at, NOW())::TIMESTAMPTZ AS paid_at,
        p.status::TEXT
    FROM public.payments p
    WHERE p.student_id = p_student_id

    UNION ALL

    -- 2. Legacy/Parent Payments (Explicit Casting)
    SELECT 
        fp.id::UUID,
        fp.amount::NUMERIC,
        fp.payment_method::TEXT,
        COALESCE(fp.transaction_id, 'N/A')::TEXT AS transaction_reference,
        COALESCE(fp.payment_date, NOW())::TIMESTAMPTZ AS paid_at,
        fp.status::TEXT
    FROM public.fee_payments fp
    WHERE fp.student_id = p_student_id
    
    ORDER BY paid_at DESC;
END;
$$;

-- Ensure Permissions
GRANT EXECUTE ON FUNCTION public.get_student_payment_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_payment_history(UUID) TO service_role;

COMMIT;
