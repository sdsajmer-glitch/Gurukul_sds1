-- ==============================================================================
-- FIX GENESIS MAPPING V5 (STRICT INTEGRITY & MULTI-TENANCY)
-- ==============================================================================
-- Problem: "Data Integrity Fault: Mandatory parameter missing" (Error 23502)
-- Cause: Missing 'branch_id' or 'academic_year_id' in INSERTS for tables that 
--        require them (e.g., student_fee_ledger, fee_invoices).
-- Solution:
-- 1. Unified Context: Fetches and injects 'branch_id' into all financial records.
-- 2. Schema Resilience: Uses 'COALESCE' and fallbacks for column names.
-- 3. Validation: Aborts early with clear JSON if context is missing.
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE: generate_student_ledger (The Multi-Tenant Engine)
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
    v_count INTEGER := 0;
    v_ledger_id UUID;
    v_available_structures JSONB;
BEGIN
    -- 1. Fetch Student Context (Mandatory for all inserts)
    SELECT branch_id, grade INTO v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_branch_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_HAS_NO_BRANCH', 'message', 'This student is not assigned to any branch.');
    END IF;

    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_PROFILE_HAS_NO_GRADE');
    END IF;

    -- 2. Academic Year Detection (Fallback to latest if no current)
    IF v_year_id IS NULL THEN
        SELECT id INTO v_year_id FROM public.academic_years 
        WHERE (branch_id = v_branch_id OR branch_id IS NULL)
        AND is_current = true
        AND LOWER(status::text) IN ('active', 'current')
        LIMIT 1;
        
        IF v_year_id IS NULL THEN
             SELECT id INTO v_year_id FROM public.academic_years 
             WHERE (branch_id = v_branch_id OR branch_id IS NULL)
             ORDER BY end_date DESC NULLS LAST, start_date DESC 
             LIMIT 1;
        END IF;
    END IF;

    IF v_year_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_ACADEMIC_YEAR_DEFINED', 'message', 'Please configure an Academic Year for this branch first.');
    END IF;

    -- 3. Normalize Grade
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));

    -- 4. Find Fee Structure (Robust Matching)
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (academic_cycle_id = v_year_id OR academic_cycle_id IS NULL)
    AND (
        LOWER(target_grade) = LOWER(v_grade)
        OR 
        TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade
    )
    ORDER BY (CASE WHEN academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), created_at DESC 
    LIMIT 1;

    -- 5. Handle Missing Structure
    IF v_structure_id IS NULL THEN
        SELECT jsonb_agg(DISTINCT target_grade) INTO v_available_structures
        FROM public.fee_structures
        WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
        AND (academic_cycle_id = v_year_id OR academic_cycle_id IS NULL);

        RETURN jsonb_build_object(
            'success', false, 
            'error', 'GRADE_MAPPING_MISSING',
            'message', 'No active fee structure found for ' || v_grade || '. Available: ' || COALESCE(v_available_structures::text, 'None')
        );
    END IF;

    -- 6. Link Assignment (Safe Insert)
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    -- 7. Upsert Ledger (Strict Multi-Tenancy)
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger
    WHERE student_id = p_student_id AND academic_year_id = v_year_id;

    IF v_ledger_id IS NULL THEN
        INSERT INTO public.student_fee_ledger (
            student_id, academic_year_id, branch_id, total_amount, status, created_at, updated_at, grade
        ) VALUES (
            p_student_id, v_year_id, v_branch_id, 0, 'active', NOW(), NOW(), v_grade
        ) RETURNING id INTO v_ledger_id;
    ELSE
        UPDATE public.student_fee_ledger 
        SET branch_id = COALESCE(branch_id, v_branch_id),
            grade = COALESCE(grade, v_grade),
            updated_at = NOW()
        WHERE id = v_ledger_id;
    END IF;

    -- 8. Populate Invoices (Injecting branch_id to avoid 23502)
    FOR v_component IN 
        SELECT * FROM public.fee_components WHERE structure_id = v_structure_id
    LOOP
        -- Check if similar invoice exists to avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
            AND description ILIKE v_component.name || '%'
            AND status NOT IN ('Cancelled', 'cancelled')
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, branch_id, total_amount, due_date, description, status, created_at, structure_id
            ) VALUES (
                p_student_id, v_branch_id, v_component.amount, CURRENT_DATE + INTERVAL '15 days',
                v_component.name || ' (INITIAL_SYNC)', 'Pending', NOW(), v_structure_id
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 9. Final Totals & Reconciliation
    UPDATE public.student_fee_ledger
    SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM public.fee_components WHERE structure_id = v_structure_id),
        updated_at = NOW()
    WHERE id = v_ledger_id;

    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'invoices_created', v_count, 
        'branch_id', v_branch_id,
        'academic_year_id', v_year_id,
        'mapped_grade', v_grade
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'error', 'INTERNAL_EXECUTION_STALL',
        'message', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Genesis Mapping V5 (Strict Integrity) Deployed.' as status;
