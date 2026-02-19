-- =============================================================================
-- FINANCE CALCULATION FIX & LEDGER SYNC V1
-- Description: Fixes fee calculation discrepancies by enforced ledger synchronization.
--              Ensures student_fee_accounts summary matches fee_invoices reality.
-- =============================================================================

BEGIN;

-- 1. Ensure Student Fee Accounts Table Exists with Correct Columns
CREATE TABLE IF NOT EXISTS public.student_fee_accounts (
    student_id UUID PRIMARY KEY REFERENCES public.student_profiles(user_id),
    branch_id BIGINT,
    total_billed DECIMAL(15,2) DEFAULT 0,
    total_paid DECIMAL(15,2) DEFAULT 0,
    outstanding_balance DECIMAL(15,2) DEFAULT 0,
    last_payment_date TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Trigger Function to Auto-Update Ledger Summary
CREATE OR REPLACE FUNCTION public.fn_sync_student_ledger_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_student_id UUID;
    v_branch_id BIGINT;
    v_total_billed DECIMAL(15,2);
    v_total_paid DECIMAL(15,2);
BEGIN
    -- Determine affected student
    IF TG_OP = 'DELETE' THEN
        v_student_id := OLD.student_id;
        v_branch_id := OLD.branch_id;
    ELSE
        v_student_id := NEW.student_id;
        v_branch_id := NEW.branch_id;
    END IF;

    -- Recalculate totals from active invoices
    SELECT 
        COALESCE(SUM(total_amount), 0),
        COALESCE(SUM(paid_amount), 0)
    INTO v_total_billed, v_total_paid
    FROM public.fee_invoices
    WHERE student_id = v_student_id 
      AND status != 'cancelled';

    -- Update Summary Table
    INSERT INTO public.student_fee_accounts (
        student_id, 
        branch_id, 
        total_billed, 
        total_paid, 
        outstanding_balance, 
        last_synced_at
    )
    VALUES (
        v_student_id, 
        v_branch_id, 
        v_total_billed, 
        v_total_paid, 
        v_total_billed - v_total_paid, 
        NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        last_synced_at = NOW();

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply Triggers to Transaction Tables
DROP TRIGGER IF EXISTS trg_sync_ledger_invoices ON public.fee_invoices;
CREATE TRIGGER trg_sync_ledger_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.fee_invoices
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_student_ledger_summary();

-- 4. Utility Function to Force Re-Sync Entire Branch
CREATE OR REPLACE FUNCTION public.recalculate_all_student_ledgers(p_branch_id BIGINT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- Update all students who have invoices
    WITH calculated_ledger AS (
        SELECT 
            student_id,
            MAX(branch_id) as branch_id, -- Assume branch consistency
            COALESCE(SUM(total_amount), 0) as calc_billed,
            COALESCE(SUM(paid_amount), 0) as calc_paid
        FROM public.fee_invoices
        WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
          AND status != 'cancelled'
        GROUP BY student_id
    )
    INSERT INTO public.student_fee_accounts (
        student_id, branch_id, total_billed, total_paid, outstanding_balance, last_synced_at
    )
    SELECT 
        student_id, 
        branch_id, 
        calc_billed, 
        calc_paid, 
        (calc_billed - calc_paid), 
        NOW()
    FROM calculated_ledger
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        last_synced_at = NOW();

    -- Return status
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN 'Synced ' || v_count || ' student ledgers.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Get Student Fee Summary (Optimized)
-- Replaces previous versions to use the now-reliable summary table
CREATE OR REPLACE FUNCTION public.get_student_fee_summary_all(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    class_name TEXT,
    grade TEXT,
    total_billed DECIMAL,
    total_paid DECIMAL,
    outstanding_balance DECIMAL,
    overall_status TEXT,
    currency TEXT,
    branch_id BIGINT,
    profile_photo_url TEXT,
    integrity_score INT
) AS $$
BEGIN
    -- Ensure photo URL is not ambiguous by selecting specifically from joined sources
    RETURN QUERY
    SELECT 
        sp.user_id as student_id,
        sp.display_name,
        COALESCE(sc.name, 'Unassigned') as class_name,
        sp.grade,
        COALESCE(sfa.total_billed, 0),
        COALESCE(sfa.total_paid, 0),
        COALESCE(sfa.outstanding_balance, 0),
        CASE 
            WHEN sfa.outstanding_balance > 0 THEN 'Pending'
            WHEN sfa.total_billed > 0 AND sfa.outstanding_balance <= 0 THEN 'Paid'
            ELSE 'No Dues'
        END as overall_status,
        'INR' as currency,
        sp.branch_id,
        sp.profile_photo_url, -- Direct from profile
        COALESCE(sp.integrity_score, 100)
    FROM public.student_profiles sp
    LEFT JOIN public.student_fee_accounts sfa ON sp.user_id = sfa.student_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    ORDER BY sp.grade ASC, sp.display_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger Immediate Re-Sync for Safety
SELECT public.recalculate_all_student_ledgers();

COMMIT;
