-- ==============================================================================
-- FIX GENESIS MAPPING V8 (ENTERPRISE FUSION & NUCLEAR REPAIR)
-- ==============================================================================
-- Problem 1: Billed Magnitude shows 90,000 (Legacy Bloat) instead of 78,000.
-- Problem 2: Settled Capital shows 0 while Integrity is 36% (Data Mismatch).
-- Problem 3: Node Unmapped showing despite MAP clicks.
-- 
-- Solution:
-- 1. Unified Reconciliation: Sum payments from both Legacy and Enterprise tables.
-- 2. Forced Alignment: Recalculate Ledger Total from Structural Components.
-- 3. Aggressive Sync: Cancel orphaned Pending invoices that exceed the structural mapping.
-- 4. Visibility Fix: Ensure 'student_fee_assignments' uses the correct ID.
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE REPAIR: Unified Reconciliation (Enterprise Fusion)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_billed NUMERIC := 0;
    v_total_paid_legacy NUMERIC := 0;
    v_total_paid_ent NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_unallocated NUMERIC := 0;
    v_integrity INT;
BEGIN
    -- 1. Calculate Total Liability (Sum of non-cancelled invoices)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND status NOT IN ('Cancelled', 'cancelled');

    -- 2. Sum Legacy Settlements
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_legacy 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND status IN ('Completed', 'Pending', 'success');

    -- 3. Sum Enterprise Settlements (Dynamic check)
    BEGIN
        EXECUTE 'SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE student_id = $1 AND status IN (''success'', ''pending'')'
        INTO v_total_paid_ent
        USING p_student_id;
    EXCEPTION WHEN OTHERS THEN
        v_total_paid_ent := 0;
    END;

    v_total_paid := v_total_paid_legacy + v_total_paid_ent;

    -- 4. Unallocated Funds
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND (invoice_id IS NULL OR invoice_id = 0) AND status IN ('Completed', 'success');

    -- 5. Calculate Integrity
    v_integrity := CASE 
        WHEN v_total_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_total_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_total_billed * 100)::INT))
    END;

    -- 6. Atomic Sync to Summary Node
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_total_billed, v_total_paid, (v_total_billed - v_total_paid), 
        v_integrity, NOW(), v_unallocated
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        last_synced_at = NOW();

    -- 7. Self-Healing Ledger Amount (Force it to match the Billed Magnitude)
    UPDATE public.student_fee_ledger
    SET total_amount = v_total_billed,
        updated_at = NOW()
    WHERE student_id = p_student_id;

END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] CORE: generate_student_ledger (Aggressive V8 Cleanup)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_branch_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_structure_id BIGINT;
    v_year_id BIGINT := p_academic_year_id;
    v_component RECORD;
    v_count_new INTEGER := 0;
    v_count_cancelled INTEGER := 0;
    v_ledger_id UUID;
    v_correct_total NUMERIC := 0;
BEGIN
    -- 1. Get Context
    SELECT branch_id, grade INTO v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_branch_id IS NULL OR v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'CONTEXT_MISSING');
    END IF;

    -- 2. Detect Year
    IF v_year_id IS NULL THEN
        SELECT id INTO v_year_id FROM public.academic_years 
        WHERE (branch_id = v_branch_id OR branch_id IS NULL)
        AND is_current = true LIMIT 1;
        
        IF v_year_id IS NULL THEN
             SELECT id INTO v_year_id FROM public.academic_years 
             WHERE (branch_id = v_branch_id OR branch_id IS NULL)
             ORDER BY end_date DESC NULLS LAST LIMIT 1;
        END IF;
    END IF;

    -- 3. Match Structure
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));
    
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (academic_cycle_id = v_year_id OR academic_cycle_id IS NULL)
    AND (LOWER(target_grade) = LOWER(v_grade) OR TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade)
    ORDER BY (CASE WHEN academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STRUCTURE_NOT_FOUND');
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_correct_total FROM public.fee_components WHERE structure_id = v_structure_id;

    -- 4. FORCE ALIGNMENT: Assignments & Ledger
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    IF NOT EXISTS (SELECT 1 FROM public.student_fee_ledger WHERE student_id = p_student_id AND academic_year_id = v_year_id) THEN
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, total_amount, status, grade)
        VALUES (p_student_id, v_year_id, v_branch_id, v_correct_total, 'active', v_grade)
        RETURNING id INTO v_ledger_id;
    ELSE
        UPDATE public.student_fee_ledger 
        SET total_amount = v_correct_total, branch_id = v_branch_id, grade = v_grade, updated_at = NOW()
        WHERE student_id = p_student_id AND academic_year_id = v_year_id
        RETURNING id INTO v_ledger_id;
    END IF;

    -- 5. NUCLEAR INVOICE SYNC (Solves the 90,000 issue)
    -- Step A: Cancel ALL "Pending" initial-sync invoices that don't match the components
    UPDATE public.fee_invoices
    SET status = 'Cancelled', description = description || ' (DE-DUPLICATED)'
    WHERE student_id = p_student_id 
    AND status IN ('Pending', 'pending')
    AND (paid_amount = 0 OR paid_amount IS NULL)
    AND (
        -- Either it's from a different structure
        structure_id != v_structure_id 
        OR 
        -- Or it's a duplicate description that isn't in current components
        description NOT IN (SELECT name || ' (INITIAL_SYNC)' FROM public.fee_components WHERE structure_id = v_structure_id)
    );
    GET DIAGNOSTICS v_count_cancelled = ROW_COUNT;

    -- Step B: Ensure mandatory invoices exist
    FOR v_component IN SELECT * FROM public.fee_components WHERE structure_id = v_structure_id LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id AND description ILIKE v_component.name || '%' AND status != 'Cancelled'
        ) THEN
            INSERT INTO public.fee_invoices (student_id, branch_id, total_amount, due_date, description, status, structure_id)
            VALUES (p_student_id, v_branch_id, v_component.amount, CURRENT_DATE + INTERVAL '15 days', v_component.name || ' (INITIAL_SYNC)', 'Pending', v_structure_id);
            v_count_new := v_count_new + 1;
        END IF;
    END LOOP;

    -- 6. FINAL SYNC
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'billed_aligned_to', v_correct_total,
        'cancelled_orphans', v_count_cancelled,
        'created_new', v_count_new
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Genesis Mapping V8 (Enterprise Fusion) Deployed.' as status;
