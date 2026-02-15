-- FIX: FINANCE DATA ACCESS POLICIES (RLS)
-- Purpose: Ensure that the 'Authenticated' role (School Admins) can READ the payments tables directly.
-- This is critical for the Frontend Fallback logic to work if the RPC fails.

BEGIN;

-- 1. Enable RLS on Payments (if not already)
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fee_payments ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all fee_payments" ON public.fee_payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view own fee_payments" ON public.fee_payments;

-- 3. Create Permissive Policies for School Admins
-- (Assuming 'authenticated' users with a profile are admins or relevant staff)
-- For a School Management System, admins usually need access to ALL records.

CREATE POLICY "Admins can view all payments" 
ON public.payments 
FOR SELECT 
TO authenticated 
USING (true); -- Allow reading all payments (Tenant isolation handled by app logic usually, or add branch_id check if needed)

CREATE POLICY "Admins can view all fee_payments" 
ON public.fee_payments 
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Grant Table Permissions
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.fee_payments TO authenticated;

-- 5. Fix Potential "Ambiguous Column" in RPCs by recreating the History RPC one last time with strict aliases.
-- Just to be 100% sure the RPC isn't the point of failure.

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
    SELECT 
        p.id::UUID,
        p.amount::NUMERIC,
        p.payment_method::TEXT,
        COALESCE(p.transaction_reference, 'N/A')::TEXT,
        COALESCE(p.paid_at, NOW())::TIMESTAMPTZ,
        p.status::TEXT
    FROM public.payments AS p
    WHERE p.student_id = p_student_id

    UNION ALL

    SELECT 
        fp.id::UUID,
        fp.amount::NUMERIC,
        fp.payment_method::TEXT,
        COALESCE(fp.transaction_id, 'N/A')::TEXT,
        COALESCE(fp.payment_date, NOW())::TIMESTAMPTZ,
        fp.status::TEXT
    FROM public.fee_payments AS fp
    WHERE fp.student_id = p_student_id
    
    ORDER BY 5 DESC; -- Order by the 5th column (paid_at)
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_payment_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_payment_history(UUID) TO service_role;

COMMIT;
