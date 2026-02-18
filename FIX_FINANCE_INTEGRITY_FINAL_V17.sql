-- =============================================================================
-- [FINANCE] ULTIMATE DATA INTEGRITY & RECALCULATION ENGINE (V17.0)
-- Objective: Fix the 90k vs 78k discrepancy and ensure 100% data accuracy.
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] SCHEMA ENHANCEMENT: Ledger Critical Columns
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS scholarship_amount NUMERIC DEFAULT 0;
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] CORE: RECALCULATION ENGINE (The Reconciliation Nucleus)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_gross_billed NUMERIC := 0;
    v_scholarship NUMERIC := 0;
    v_net_billed NUMERIC := 0;
    v_total_paid_legacy NUMERIC := 0;
    v_total_paid_ent NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_unallocated NUMERIC := 0;
    v_integrity INT;
    v_cycle_id BIGINT;
BEGIN
    -- 1. Fetch Scholarship/Discount from Ledger
    SELECT COALESCE(scholarship_amount, 0), COALESCE(discount_amount, 0), academic_year_id 
    INTO v_scholarship, v_net_billed, v_cycle_id -- Reusing v_net_billed as tmp for discount
    FROM public.student_fee_ledger 
    WHERE student_id = p_student_id 
    ORDER BY created_at DESC LIMIT 1;
    
    v_scholarship := v_scholarship + v_net_billed; -- Total deduction

    -- 2. Calculate Gross Liability (Sum of non-cancelled invoices)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_gross_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND status NOT IN ('Cancelled', 'cancelled');

    -- 3. Calculate Net Liability
    v_net_billed := v_gross_billed - v_scholarship;

    -- 4. Sum Legacy Settlements (fee_payments)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_legacy 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'success', 'pending');

    -- 5. Sum Enterprise Settlements (payments)
    BEGIN
        EXECUTE 'SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE student_id = $1 AND LOWER(status::text) IN (''success'', ''pending'', ''completed'')'
        INTO v_total_paid_ent
        USING p_student_id;
    EXCEPTION WHEN OTHERS THEN v_total_paid_ent := 0; END;

    v_total_paid := v_total_paid_legacy + v_total_paid_ent;

    -- 6. Identify Unallocated Magnitude
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND (invoice_id IS NULL OR invoice_id = 0) AND LOWER(status::text) IN ('completed', 'success');

    -- 7. Calculate Integrity Score (Percentage of Net dues cleared)
    v_integrity := CASE 
        WHEN v_net_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_net_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_net_billed * 100)::INT))
    END;

    -- 8. Synchronize Summary Node (student_fee_accounts)
    -- Include Next Due Date and Amount locally for stat cards
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

    -- 9. Synchronize Deep Ledger Node (student_fee_ledger)
    UPDATE public.student_fee_ledger
    SET total_amount = v_gross_billed,
        net_amount = v_net_billed,
        updated_at = NOW()
    WHERE student_id = p_student_id AND (academic_year_id = v_cycle_id OR v_cycle_id IS NULL);

    -- 10. Update Installment Sync Status (Mark installments as paid if amounts match)
    -- This is a self-healing step for the installment schedule
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
-- [3] REPAIR: get_student_financial_node (The Authority Handshake)
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
    -- 1. Sync & Reconcile (Forced authority check)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    -- 2. Detect Cycle context
    IF v_target_cycle_id IS NULL THEN
        SELECT ay.id, ay.year_name INTO v_target_cycle_id, v_target_cycle_name FROM public.academic_years ay WHERE ay.is_current = true LIMIT 1;
        IF v_target_cycle_id IS NULL THEN
            SELECT ay.id, ay.year_name INTO v_target_cycle_id, v_target_cycle_name FROM public.academic_years ay ORDER BY ay.start_date DESC LIMIT 1;
        END IF;
    ELSE
        SELECT ay.year_name INTO v_target_cycle_name FROM public.academic_years ay WHERE ay.id = v_target_cycle_id;
    END IF;

    -- 3. Return Final Precision Node
    RETURN QUERY
    SELECT 
        prof.id::UUID,
        COALESCE(prof.display_name, prof.email)::TEXT,
        COALESCE(prof.profile_photo_url, sp.profile_photo_url)::TEXT,
        COALESCE(sp.grade, 'N/A')::TEXT,
        COALESCE(cls.name, 'UNASSIGNED')::TEXT,
        
        -- billing [6] - We return NET magnitude as the primary liability (78k fix)
        COALESCE(sacc.total_billed, 0::NUMERIC)::NUMERIC,
        
        -- gross [7]
        COALESCE(sledger.total_amount, sacc.total_billed)::NUMERIC,
        
        -- scholarship [8]
        COALESCE(sledger.scholarship_amount, 0::NUMERIC)::NUMERIC,
        
        -- paid [9]
        COALESCE(sacc.total_paid, 0::NUMERIC)::NUMERIC,
        
        -- balance [10]
        COALESCE(sacc.outstanding_balance, 0::NUMERIC)::NUMERIC,
        
        -- integrity [11]
        COALESCE(sacc.integrity_score, 100)::INTEGER,
        
        COALESCE(sacc.unallocated_funds, 0::NUMERIC)::NUMERIC, -- 12
        
        -- next_due_date [13]
        (SELECT MIN(due_date) FROM public.installment_schedule WHERE ledger_id = sledger.id AND LOWER(status::text) = 'pending')::DATE,
        
        -- next_due_amount [14]
        (SELECT amount FROM public.installment_schedule WHERE ledger_id = sledger.id AND LOWER(status::text) = 'pending' ORDER BY due_date ASC LIMIT 1)::NUMERIC,
        
        COALESCE(prof.is_active, true)::BOOLEAN, -- 15
        (sacc.student_id IS NULL OR sacc.total_billed = 0)::BOOLEAN, -- 16
        v_target_cycle_id::BIGINT, -- 17
        COALESCE(v_target_cycle_name, 'Unknown')::TEXT, -- 18
        sp.branch_id::BIGINT, -- 19
        COALESCE(sledger.status, 'GLOBAL_VIEW')::TEXT -- 20
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
