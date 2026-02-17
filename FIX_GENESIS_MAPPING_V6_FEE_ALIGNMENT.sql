-- ==============================================================================
-- FIX GENESIS MAPPING V6 (FEE ALIGNMENT & ORPHAN PURGE)
-- ==============================================================================
-- Problem: Student shows 90,000 billed instead of 78,000.
-- Cause: 
-- 1. Old/Duplicate invoices from previous mapping attempts are still active.
-- 2. The 'Deep Clean' logic was skipped because the student has partial payments (36% integrity).
-- 3. Core logic only adds missing invoices, never removes orphaned ones.
-- Solution:
-- 1. Selective Purge: Automatically cancel UNPAID invoices that don't belong to the current structure.
-- 2. Amount Sync: Update existing unpaid invoices if component amounts have changed.
-- 3. Total Reconciliation: Force recalculation of 'Billed Magnitude'.
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE: generate_student_ledger (The Alignment Engine)
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
    v_count_updated INTEGER := 0;
    v_count_cancelled INTEGER := 0;
    v_ledger_id UUID;
BEGIN
    -- 1. Fetch Student Context
    SELECT branch_id, grade INTO v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_branch_id IS NULL OR v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'CONTEXT_MISSING');
    END IF;

    -- 2. Academic Year Detection
    IF v_year_id IS NULL THEN
        SELECT id INTO v_year_id FROM public.academic_years 
        WHERE (branch_id = v_branch_id OR branch_id IS NULL)
        AND is_current = true AND LOWER(status::text) IN ('active', 'current')
        LIMIT 1;
        
        IF v_year_id IS NULL THEN
             SELECT id INTO v_year_id FROM public.academic_years 
             WHERE (branch_id = v_branch_id OR branch_id IS NULL)
             ORDER BY end_date DESC NULLS LAST, start_date DESC LIMIT 1;
        END IF;
    END IF;

    -- 3. Find Robust Fee Structure
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));
    
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (academic_cycle_id = v_year_id OR academic_cycle_id IS NULL)
    AND (
        LOWER(target_grade) = LOWER(v_grade)
        OR TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade
    )
    ORDER BY (CASE WHEN academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STRUCTURE_NOT_FOUND');
    END IF;

    -- 4. Sync Assignment
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    -- 5. Upsert Ledger
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger
    WHERE student_id = p_student_id AND academic_year_id = v_year_id;

    IF v_ledger_id IS NULL THEN
        INSERT INTO public.student_fee_ledger (
            student_id, academic_year_id, branch_id, total_amount, status, grade
        ) VALUES (
            p_student_id, v_year_id, v_branch_id, 0, 'active', v_grade
        ) RETURNING id INTO v_ledger_id;
    END IF;

    -- 6. [ALIGNMENT] Synchronize Invoices with Components
    FOR v_component IN SELECT * FROM public.fee_components WHERE structure_id = v_structure_id LOOP
        -- Case A: Update existing unpaid invoice amount
        UPDATE public.fee_invoices 
        SET total_amount = v_component.amount,
            updated_at = NOW()
        WHERE student_id = p_student_id 
        AND description ILIKE v_component.name || ' (INITIAL_SYNC)'
        AND status IN ('Pending', 'pending')
        AND paid_amount = 0
        AND total_amount != v_component.amount;
        
        GET DIAGNOSTICS v_count_updated = ROW_COUNT;

        -- Case B: Insert missing invoice
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
            AND description ILIKE v_component.name || '%'
            AND status != 'Cancelled'
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, branch_id, total_amount, due_date, description, status, structure_id
            ) VALUES (
                p_student_id, v_branch_id, v_component.amount, CURRENT_DATE + INTERVAL '15 days',
                v_component.name || ' (INITIAL_SYNC)', 'Pending', v_structure_id
            );
            v_count_new := v_count_new + 1;
        END IF;
    END LOOP;

    -- 7. [ALIGNMENT] Purge/Cancel Orphans (Fixes the 90,000 issue)
    -- If an invoice is UNPAID and NOT in the current structure, cancel it.
    UPDATE public.fee_invoices
    SET status = 'Cancelled',
        description = description || ' (PURGED_BY_SYNC)'
    WHERE student_id = p_student_id
    AND status IN ('Pending', 'pending')
    AND paid_amount = 0
    AND description LIKE '% (INITIAL_SYNC)'
    AND description NOT IN (
        SELECT name || ' (INITIAL_SYNC)' FROM public.fee_components WHERE structure_id = v_structure_id
    );
    
    GET DIAGNOSTICS v_count_cancelled = ROW_COUNT;

    -- 8. Final Totals
    UPDATE public.student_fee_ledger
    SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM public.fee_components WHERE structure_id = v_structure_id),
        updated_at = NOW()
    WHERE id = v_ledger_id;

    -- 9. Force Reconciliation (Refreshes the 90,000 magnitude in UI)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'actions', jsonb_build_object(
            'created', v_count_new,
            'updated', v_count_updated,
            'cancelled_orphans', v_count_cancelled
        ),
        'final_amount', (SELECT COALESCE(SUM(amount), 0) FROM public.fee_components WHERE structure_id = v_structure_id)
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Fee Alignment & Orphan Purge Deployed.' as status;
