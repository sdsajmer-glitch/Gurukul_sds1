-- FIX: Consistency between Profile Modal and Finance Detail View
-- 1. Force `get_student_fee_summary` to reconcile first, ensuring it receives the same fresh data as the Detail View.
-- 2. Ensure `admin_reconcile_student_account` handles case-insensitive status checks.

BEGIN;

-- [1] Robust Reconciliation (Case Intependent)
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
    -- 1. Billed
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND LOWER(status) != 'cancelled';
    
    -- 2. Legacy Payments
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_legacy 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND LOWER(status) IN ('completed', 'pending', 'success');

    -- 3. Enterprise Payments
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_enterprise 
    FROM public.payments 
    WHERE student_id = p_student_id AND LOWER(status) IN ('success', 'completed');

    -- Combined
    v_total_paid_combined := v_total_paid_legacy + v_total_paid_enterprise;

    -- 4. Integrity
    v_integrity := CASE 
        WHEN v_total_billed <= 0 AND v_total_paid_combined > 0 THEN 100
        WHEN v_total_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid_combined / v_total_billed * 100)::INT))
    END;

    -- 5. Upsert Summary
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

-- [2] Self-Healing Summary RPC
CREATE OR REPLACE FUNCTION public.get_student_fee_summary(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_billed NUMERIC;
    v_paid NUMERIC;
    v_balance NUMERIC;
BEGIN
    -- A. FORCE RECONCILE (Crucial Step: Ensure data is fresh before read)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    -- B. Read Fresh Data
    SELECT total_billed, total_paid, outstanding_balance
    INTO v_billed, v_paid, v_balance
    FROM student_fee_accounts
    WHERE student_id = p_student_id;

    -- C. Fallback (Should rarely happen now)
    IF v_billed IS NULL THEN
        SELECT COALESCE(SUM(total_amount), 0) INTO v_billed FROM fee_invoices WHERE student_id = p_student_id;
        v_paid := 0; 
        v_balance := v_billed;
    END IF;

    RETURN jsonb_build_object(
        'total_billed', COALESCE(v_billed, 0),
        'total_paid', COALESCE(v_paid, 0),
        'outstanding_balance', COALESCE(v_balance, 0)
    );
END;
$$;

COMMIT;
