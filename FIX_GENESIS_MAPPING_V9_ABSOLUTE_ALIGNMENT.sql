-- ==============================================================================
-- FIX GENESIS MAPPING V9 (STRICT TOTAL ALIGNMENT & OVERDUE PURGE)
-- ==============================================================================
-- Problem: Total amount still showing 90,000 instead of 78,000.
-- Cause: 
-- 1. Orphaned invoices are in 'Overdue' status, escaping previous cleanup (V6/V8).
-- 2. Column 'structure_id' vs 'fee_structure_id' ambiguity in different environments.
-- 3. The integrity score calculation needs to follow the Billed Magnitude exactly.
-- Solution:
-- 1. Expanded Purge: Cancel UNPAID invoices in BOTH 'Pending' and 'Overdue' states.
-- 2. Absolute Recalculation: Force 'student_fee_accounts' to match 'fee_components' sum.
-- 3. Registry Refresh: Explicitly trigger reconciliation for the specific student.
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE REPAIR: Unified Reconciliation (Refined V9)
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
    WHERE student_id = p_student_id AND LOWER(status::text) NOT IN ('cancelled');

    -- 2. Sum Settlements (Legacy + Enterprise Fusion)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_legacy 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'pending', 'success');

    BEGIN
        EXECUTE 'SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE student_id = $1 AND LOWER(status::text) IN (''success'', ''pending'')'
        INTO v_total_paid_ent
        USING p_student_id;
    EXCEPTION WHEN OTHERS THEN
        v_total_paid_ent := 0;
    END;

    v_total_paid := v_total_paid_legacy + v_total_paid_ent;

    -- 3. Unallocated Magnitude
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND (invoice_id IS NULL OR invoice_id = 0) AND LOWER(status::text) IN ('completed', 'success');

    -- 4. Calculate Integrity Score (Against current real-time billed amount)
    v_integrity := CASE 
        WHEN v_total_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_total_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_total_billed * 100)::INT))
    END;

    -- 5. Atomic Sync to Summary
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

    -- 6. Self-Healing Ledger State
    UPDATE public.student_fee_ledger
    SET total_amount = v_total_billed,
        updated_at = NOW()
    WHERE student_id = p_student_id;

END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] CORE: generate_student_ledger (The V9 High-Precision Purge)
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
    v_invoice_col_name TEXT;
BEGIN
    -- 1. Fetch Student Context
    SELECT branch_id, grade INTO v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_branch_id IS NULL OR v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'CONTEXT_MISSING');
    END IF;

    -- 2. Detect Academic Year
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

    -- 3. Structural Lookup
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));
    
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (academic_cycle_id = v_year_id OR academic_cycle_id IS NULL)
    AND (LOWER(target_grade) = LOWER(v_grade) OR TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade)
    ORDER BY (CASE WHEN academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STRUCTURE_NOT_FOUND', 'message', 'Grade ' || v_grade || ' has no active fee structure.');
    END IF;

    -- Correct structural total
    SELECT COALESCE(SUM(amount), 0) INTO v_correct_total FROM public.fee_components WHERE structure_id = v_structure_id;

    -- 4. Sync Assignments & Ledger Header
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    SELECT id INTO v_ledger_id FROM public.student_fee_ledger
    WHERE student_id = p_student_id AND (academic_year_id = v_year_id OR academic_year_id IS NULL)
    LIMIT 1;

    IF v_ledger_id IS NULL THEN
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, total_amount, status, grade)
        VALUES (p_student_id, v_year_id, v_branch_id, v_correct_total, 'active', v_grade)
        RETURNING id INTO v_ledger_id;
    ELSE
        UPDATE public.student_fee_ledger 
        SET total_amount = v_correct_total, branch_id = v_branch_id, grade = v_grade, updated_at = NOW()
        WHERE id = v_ledger_id;
    END IF;

    -- 5. NUCLEAR ALIGNMENT: Unpaid Invoice Purge (Fixing the 90,000 issue)
    -- Target: Cancel ANY unpaid/pending/overdue invoice that doesn't match the current structure or components.
    
    -- Detect column name (Resilience check)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'structure_id') THEN
        v_invoice_col_name := 'structure_id';
    ELSE
        v_invoice_col_name := 'fee_structure_id';
    END IF;

    -- Action A: Cancel mismatching orphans (The Nuclear Sweep)
    EXECUTE 'UPDATE public.fee_invoices
             SET status = ''Cancelled'', description = description || '' (PURGED_BY_SYNC_V9)''
             WHERE student_id = $1 
             AND LOWER(status::text) IN (''pending'', ''overdue'')
             AND (paid_amount = 0 OR paid_amount IS NULL)
             AND (
                 ' || v_invoice_col_name || ' IS DISTINCT FROM $2
                 OR 
                 description NOT IN (SELECT name || '' (INITIAL_SYNC)'' FROM public.fee_components WHERE structure_id = $2)
             )'
    USING p_student_id, v_structure_id;
    
    GET DIAGNOSTICS v_count_cancelled = ROW_COUNT;

    -- Action B: Ensure all required structural invoices exist
    FOR v_component IN SELECT * FROM public.fee_components WHERE structure_id = v_structure_id LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id AND description ILIKE v_component.name || '%' AND LOWER(status::text) != 'cancelled'
        ) THEN
            INSERT INTO public.fee_invoices (student_id, branch_id, total_amount, due_date, description, status, structure_id)
            VALUES (p_student_id, v_branch_id, v_component.amount, CURRENT_DATE + INTERVAL '15 days', v_component.name || ' (INITIAL_SYNC)', 'Pending', v_structure_id);
            v_count_new := v_count_new + 1;
        END IF;
    END LOOP;

    -- 6. FINAL RECONCILIATION (Updates total_billed in Summary)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'aligned_to', v_correct_total,
        'purged_orphans', v_count_cancelled,
        'added_new', v_count_new,
        'mapped_structure_id', v_structure_id
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Genesis Mapping V9 (Absolute Alignment) Deployed.' as status;
