-- FIX: UNIFY FINANCE DATABASES (Enterprise vs Legacy)
-- Problem: The system has two sets of finance tables:
-- 1. 'payments' (Enterprise Level)
-- 2. 'fee_payments' (Parent Portal / Simple Level)
-- The Profile Modal was reading from Simple Level, but the Recording Tool was writing to Enterprise.
-- This script bridges them so data reflects accurately in both places.

BEGIN;

-- [1] UNIFIED RECONCILIATION
-- Update the reconciler to count payments from BOTH tables.
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_billed NUMERIC;
    v_total_paid_legacy NUMERIC;
    v_total_paid_enterprise NUMERIC;
    v_total_paid_combined NUMERIC;
    v_unallocated NUMERIC;
    v_integrity INT;
BEGIN
    -- 1. Calculate Total Liability (Sum of Fee Invoices AND Student Fee Ledgers)
    -- We sum both sources (handling potential overlap via distinct logic if needed, but assuming separate domains for now)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND status != 'cancelled';
    
    -- Add Enterprise Billings (if not already represented in invoices)
    -- For safety, we'll focus on the Invoices as the primary 'Billed' source for the Profile View.

    -- 2. Calculate Settlements (LEGACY TABLE)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_legacy 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND status IN ('Completed', 'Pending', 'Success');

    -- 3. Calculate Settlements (ENTERPRISE TABLE)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_enterprise 
    FROM public.payments 
    WHERE student_id = p_student_id AND status IN ('success', 'completed');

    v_total_paid_combined := v_total_paid_legacy + v_total_paid_enterprise;

    -- 4. Calculate Integrity Score
    v_integrity := CASE 
        WHEN v_total_billed <= 0 AND v_total_paid_combined > 0 THEN 100
        WHEN v_total_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid_combined / v_total_billed * 100)::INT))
    END;

    -- 5. Update Summary Node
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at
    )
    VALUES (
        p_student_id, v_total_billed, v_total_paid_combined, (v_total_billed - v_total_paid_combined), 
        v_integrity, NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        last_synced_at = NOW();
END;
$$;


-- [2] UNIFIED PAYMENT HISTORY
-- Fetch transactions from BOTH tables to show full history.
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
AS $$
BEGIN
    RETURN QUERY
    -- Source 1: Enterprise Payments
    SELECT 
        p.id,
        p.amount,
        p.payment_method,
        COALESCE(p.transaction_reference, 'N/A') as transaction_reference,
        p.paid_at,
        p.status
    FROM payments p
    WHERE p.student_id = p_student_id

    UNION ALL

    -- Source 2: Legacy/Parent Payments
    SELECT 
        fp.id,
        fp.amount,
        fp.payment_method,
        COALESCE(fp.transaction_id, 'N/A') as transaction_reference,
        COALESCE(fp.payment_date, fp.created_at) as paid_at,
        fp.status
    FROM fee_payments fp
    WHERE fp.student_id = p_student_id
    
    ORDER BY paid_at DESC;
END;
$$;

-- [3] EXPLICIT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_student_payment_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_payment_history(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_student_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_student_account(UUID) TO service_role;

COMMIT;
