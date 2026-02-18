-- =============================================================================
-- [FINANCE] ULTIMATE REGISTRY REPAIR & RECALCULATION (V18.2)
-- Objective: Fix "net_amount can only be updated to DEFAULT" (Generated Column Conflict)
-- Objective: Fix the 90k vs 78k discrepancy permanently by forcing net magnitude logic.
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] SCHEMA REPAIR: Ensure Independent Columns for Arithmetic
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS scholarship_amount NUMERIC DEFAULT 0;
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] CORE REPAIR: admin_reconcile_student_account
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_gross_billed NUMERIC := 0;
    v_scholarship_ledger NUMERIC := 0;
    v_discount_ledger NUMERIC := 0;
    v_total_deduction NUMERIC := 0;
    v_net_billed NUMERIC := 0;
    v_total_paid_legacy NUMERIC := 0;
    v_total_paid_ent NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_unallocated NUMERIC := 0;
    v_integrity INT;
    v_cycle_id BIGINT;
BEGIN
    -- 1. Fetch Structural Context (Scholarship/Discount assigned in Ledger)
    SELECT COALESCE(scholarship_amount, 0), COALESCE(discount_amount, 0), academic_year_id 
    INTO v_scholarship_ledger, v_discount_ledger, v_cycle_id
    FROM public.student_fee_ledger 
    WHERE student_id = p_student_id 
    ORDER BY created_at DESC LIMIT 1;
    
    v_total_deduction := v_scholarship_ledger + v_discount_ledger;

    -- 2. Calculate Gross Liability from Invoice registry (Active Debits)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_gross_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND LOWER(status::text) NOT IN ('cancelled', 'rejected');

    -- 3. Force Net Liability Calculation (78k vs 90k fix)
    v_net_billed := v_gross_billed - v_total_deduction;

    -- 4. Sum Legacy Settlements
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_legacy 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'success', 'pending');

    -- 5. Sum Enterprise Settlements (Payments Matrix)
    BEGIN
        EXECUTE 'SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE student_id = $1 AND LOWER(status::text) IN (''success'', ''pending'', ''completed'')'
        INTO v_total_paid_ent
        USING p_student_id;
    EXCEPTION WHEN OTHERS THEN v_total_paid_ent := 0; END;

    v_total_paid := v_total_paid_legacy + v_total_paid_ent;

    -- 6. Locate Unallocated Funds
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND (invoice_id IS NULL OR invoice_id = 0) AND LOWER(status::text) IN ('completed', 'success');

    -- 7. Calculate Collection Integrity Score
    v_integrity := CASE 
        WHEN v_net_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_net_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_net_billed * 100)::INT))
    END;

    -- 8. Synchronize Dynamic Summary Node (Dashboard Stats)
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_net_billed, v_total_paid, (v_net_billed - v_total_paid), 
        v_integrity, NOW(), v_unallocated
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        last_synced_at = NOW();

    -- 9. Synchronize Deep Ledger Node (Archival Record)
    -- WARNING: We update total_amount and scholarship inputs.
    -- We use a sub-transaction to update net_amount ONLY if it is not a generated column.
    UPDATE public.student_fee_ledger
    SET total_amount = v_gross_billed,
        scholarship_amount = v_scholarship_ledger,
        discount_amount = v_discount_ledger,
        updated_at = NOW()
    WHERE student_id = p_student_id AND (academic_year_id = v_cycle_id OR v_cycle_id IS NULL);

    -- [FIX] Generated Column Guard
    BEGIN
        UPDATE public.student_fee_ledger
        SET net_amount = v_net_billed
        WHERE student_id = p_student_id AND (academic_year_id = v_cycle_id OR v_cycle_id IS NULL);
    EXCEPTION WHEN OTHERS THEN 
        -- If the error "column can only be updated to DEFAULT" occurs, we ignore it.
        -- This means the column is generated and the DB will calculate it automatically
        -- from total_amount and scholarship_amount which we already updated.
        NULL;
    END;

    -- 10. Self-Healing: Update Installment Schedule Status
    UPDATE public.installment_schedule inst
    SET status = 'paid', paid_amount = amount
    FROM public.student_fee_ledger sledger
    WHERE inst.ledger_id = sledger.id 
    AND sledger.student_id = p_student_id
    AND v_total_paid >= v_net_billed
    AND LOWER(inst.status::text) != 'paid';

END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [3] AUTHORITY HANDSHAKE: get_student_financial_node (V18.2 Signature)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    gross_billed NUMERIC,
    scholarship_amount NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER,
    unallocated_funds NUMERIC,
    next_due_date DATE,
    next_due_amount NUMERIC,
    is_active BOOLEAN,
    is_standby BOOLEAN,
    academic_cycle_id BIGINT,
    cycle_name TEXT,
    branch_id BIGINT,
    ledger_status TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_target_cycle_id BIGINT := p_cycle_id;
    v_target_cycle_name TEXT;
BEGIN
    -- 1. Auditor Execution
    PERFORM public.admin_reconcile_student_account(p_student_id);

    -- 2. Detect Operational Cycle
    IF v_target_cycle_id IS NULL THEN
        SELECT ay.id, ay.year_name INTO v_target_cycle_id, v_target_cycle_name FROM public.academic_years ay WHERE ay.is_current = true LIMIT 1;
        IF v_target_cycle_id IS NULL THEN
            SELECT ay.id, ay.year_name INTO v_target_cycle_id, v_target_cycle_name FROM public.academic_years ay ORDER BY ay.start_date DESC LIMIT 1;
        END IF;
    ELSE
        SELECT ay.year_name INTO v_target_cycle_name FROM public.academic_years ay WHERE ay.id = v_target_cycle_id;
    END IF;

    -- 3. Return Authority Node
    RETURN QUERY
    SELECT 
        prof.id::UUID,
        COALESCE(prof.display_name, prof.email)::TEXT,
        COALESCE(prof.profile_photo_url, sp.profile_photo_url)::TEXT,
        COALESCE(sp.grade, 'N/A')::TEXT,
        COALESCE(cls.name, 'UNASSIGNED')::TEXT,
        COALESCE(sacc.total_billed, 0::NUMERIC)::NUMERIC, -- net
        COALESCE(sledger.total_amount, sacc.total_billed)::NUMERIC, -- gross
        COALESCE(sledger.scholarship_amount, 0::NUMERIC) + COALESCE(sledger.discount_amount, 0::NUMERIC), -- deductions
        COALESCE(sacc.total_paid, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.outstanding_balance, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.integrity_score, 100)::INTEGER,
        COALESCE(sacc.unallocated_funds, 0::NUMERIC)::NUMERIC,
        (SELECT MIN(due_date) FROM public.installment_schedule WHERE ledger_id = sledger.id AND LOWER(status::text) = 'pending')::DATE,
        (SELECT amount FROM public.installment_schedule WHERE ledger_id = sledger.id AND LOWER(status::text) = 'pending' ORDER BY due_date ASC LIMIT 1)::NUMERIC,
        COALESCE(prof.is_active, true)::BOOLEAN,
        (sacc.student_id IS NULL OR sacc.total_billed = 0)::BOOLEAN,
        v_target_cycle_id::BIGINT,
        COALESCE(v_target_cycle_name, 'Unknown')::TEXT,
        sp.branch_id::BIGINT,
        COALESCE(sledger.status, 'ACTIVE')::TEXT
    FROM public.profiles prof
    JOIN public.student_profiles sp ON prof.id = sp.user_id
    LEFT JOIN public.school_classes cls ON sp.assigned_class_id = cls.id
    LEFT JOIN public.student_fee_accounts sacc ON prof.id = sacc.student_id
    LEFT JOIN public.student_fee_ledger sledger ON prof.id = sledger.student_id AND (sledger.academic_year_id = v_target_cycle_id OR v_target_cycle_id IS NULL)
    WHERE prof.id = p_student_id
    ORDER BY sledger.created_at DESC
    LIMIT 1;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Finance Stability V18.2 Deployed (Generated Column & Discrepancy Fixes).' as STATUS;
