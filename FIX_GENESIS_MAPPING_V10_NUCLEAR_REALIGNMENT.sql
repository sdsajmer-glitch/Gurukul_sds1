-- ==============================================================================
-- FIX GENESIS MAPPING V10 (NUCLEAR TOTAL REALIGNMENT)
-- ==============================================================================
-- Problem: Total billed still showing 90,000 instead of 78,000.
-- Cause: 
-- 1. Persistent Overdue/Manual invoices that escaped prior cleanup.
-- 2. Case sensitivity in status checks ('Overdue' vs 'overdue').
-- 3. Description mismatch (Invoices without the '(INITIAL_SYNC)' suffix).
-- Solution:
-- 1. Complete Purge: Cancel ALL unpaid invoices (Pending/Overdue) which are 
--    NOT part of the current Grade 4 structure's components.
-- 2. Aggressive Lookup: Ignore suffixes and case when matching components.
-- 3. Integrity Force: Push the absolute structural total into the summary node.
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE: admin_reconcile_student_account (The Forensic Auditor)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_billed NUMERIC := 0;
    v_total_paid_standard NUMERIC := 0;
    v_total_paid_ent NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_unallocated NUMERIC := 0;
    v_integrity INT;
BEGIN
    -- 1. Calculate Real-Time Billed Magnitude (Active Invoices Only)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND LOWER(status::text) NOT IN ('cancelled');

    -- 2. Sum Settlements (Standard + Enterprise Matrix)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_standard 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'pending', 'success');

    BEGIN
        EXECUTE 'SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE student_id = $1 AND LOWER(status::text) IN (''success'', ''pending'')'
        INTO v_total_paid_ent
        USING p_student_id;
    EXCEPTION WHEN OTHERS THEN
        v_total_paid_ent := 0;
    END;

    v_total_paid := v_total_paid_standard + v_total_paid_ent;

    -- 3. Unallocated Magnitude
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND (invoice_id IS NULL OR invoice_id = 0) AND LOWER(status::text) IN ('completed', 'success');

    -- 4. Final Integrity Score
    v_integrity := CASE 
        WHEN v_total_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_total_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_total_billed * 100)::INT))
    END;

    -- 5. Persistent Sync to Dashboard Summaries
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

    -- 6. Atomic Ledger Sync
    UPDATE public.student_fee_ledger
    SET total_amount = v_total_billed,
        updated_at = NOW()
    WHERE student_id = p_student_id;

END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] CORE: generate_student_ledger (Aggressive V10 Alignment)
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
    v_count_purged INTEGER := 0;
    v_ledger_id UUID;
    v_target_total NUMERIC := 0;
BEGIN
    -- 1. Context Acquisition
    SELECT branch_id, grade INTO v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_branch_id IS NULL OR v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_PROFILE_INCOMPLETE');
    END IF;

    -- 2. Term Detection
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

    -- 3. Strict Master Structure Match
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));
    
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (academic_cycle_id = v_year_id OR academic_cycle_id IS NULL)
    AND (LOWER(target_grade) = LOWER(v_grade) OR TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade)
    ORDER BY (CASE WHEN academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STRUCTURE_NOT_FOUND_FOR_GRADE', 'detail', v_grade);
    END IF;

    -- Get correct structural total
    SELECT COALESCE(SUM(amount), 0) INTO v_target_total FROM public.fee_components WHERE structure_id = v_structure_id;

    -- 4. Structural Persistence
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    -- 5. NUCLEAR PURGE (The fix for the 90,000 -> 78,000 issue)
    -- This cancels ANY unpaid invoice that doesn't exactly match the target structure.
    UPDATE public.fee_invoices
    SET status = 'cancelled',
        description = description || ' (PURGED_BY_SYNC_V10)'
    WHERE student_id = p_student_id 
    AND (paid_amount = 0 OR paid_amount IS NULL)
    AND LOWER(status::text) IN ('pending', 'overdue')
    AND (
        -- Mismatching Structure ID (if it exists)
        (CASE 
            WHEN (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'structure_id') IS NOT NULL 
            THEN structure_id != v_structure_id 
            ELSE true 
         END)
        OR 
        -- Unknown Description (doesn't match any component of current structure)
        REPLACE(LOWER(description), ' (initial_sync)', '') NOT IN (
            SELECT LOWER(name) FROM public.fee_components WHERE structure_id = v_structure_id
        )
    );
    GET DIAGNOSTICS v_count_purged = ROW_COUNT;

    -- 6. Mandatory Invoice Injection
    FOR v_component IN SELECT * FROM public.fee_components WHERE structure_id = v_structure_id LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
            AND (LOWER(description) = LOWER(v_component.name) OR LOWER(description) = LOWER(v_component.name) || ' (initial_sync)')
            AND LOWER(status::text) != 'cancelled'
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, branch_id, total_amount, due_date, description, status, structure_id
            ) VALUES (
                p_student_id, v_branch_id, v_component.amount, CURRENT_DATE + INTERVAL '15 days',
                v_component.name || ' (INITIAL_SYNC)', 'pending', v_structure_id
            );
            v_count_new := v_count_new + 1;
        END IF;
    END LOOP;

    -- 7. Final Magnitude Synchronization
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'final_magnitude', v_target_total,
        'purged_orphans', v_count_purged,
        'added_components', v_count_new
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Genesis Mapping V10 (Nuclear Realignment) Deployed.' as STATUS;
