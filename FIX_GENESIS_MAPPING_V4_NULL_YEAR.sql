-- ==============================================================================
-- FIX GENESIS MAPPING V4 (NULL YEAR HANDLER)
-- ==============================================================================
-- Problem: "Data Integrity Fault: Mandatory parameter missing" (Error 23502)
-- Cause: student_fee_ledger.academic_year_id has a NOT NULL constraint, but the 
--        system failed to detect a 'Current' academic year for this branch, 
--        attempting to insert NULL.
-- Solution:
-- 1. Improved Year Detection: Fallback to *any* latest academic year if 'Current' is missing.
-- 2. Explicit Validation: Returns a clear error if NO academic years exist at all.
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE: generate_student_ledger (With Fallback Year Logic)
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
    v_structure_year_id BIGINT;
    v_year_id BIGINT := p_academic_year_id;
    v_component RECORD;
    v_count INTEGER := 0;
    v_ledger_id UUID;
    v_available_structures JSONB;
BEGIN
    -- 1. Fetch Student Context
    SELECT branch_id, grade INTO v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_PROFILE_HAS_NO_GRADE');
    END IF;

    -- 2. Auto-Detect Academic Year (Logic Enhanced)
    IF v_year_id IS NULL THEN
        -- Attempt 1: Fetch 'Current' / 'Active' Year
        SELECT id INTO v_year_id FROM public.academic_years 
        WHERE (branch_id = v_branch_id OR branch_id IS NULL)
        AND is_current = true
        AND LOWER(status::text) IN ('active', 'current')
        LIMIT 1;
        
        -- Attempt 2: Fallback to Latest Year (if Setup is incomplete)
        IF v_year_id IS NULL THEN
             SELECT id INTO v_year_id FROM public.academic_years 
             WHERE (branch_id = v_branch_id OR branch_id IS NULL)
             ORDER BY end_date DESC NULLS LAST, start_date DESC 
             LIMIT 1;
        END IF;
    END IF;

    -- 3. Critical Failure if still NULL (Avoids Generic 23502 Error)
    IF v_year_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_ACADEMIC_YEAR_DEFINED', 'message', 'Please configure an Academic Year for this branch first.');
    END IF;

    -- 4. Normalize Grade
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));

    -- 5. Find Fee Structure (Robust Lookup)
    -- Note: Supports Global Structures (academic_cycle_id IS NULL) mapping to Current Year context
    SELECT id, academic_cycle_id INTO v_structure_id, v_structure_year_id
    FROM public.fee_structures 
    WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (
         (academic_cycle_id = v_year_id)     -- Exact Year Match
         OR (academic_cycle_id IS NULL)      -- Global Structure
    )
    AND (
        LOWER(target_grade) = LOWER(v_grade)
        OR 
        TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade
    )
    ORDER BY (CASE WHEN academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), created_at DESC 
    LIMIT 1;

    -- 6. Handle Missing Structure
    IF v_structure_id IS NULL THEN
        SELECT jsonb_agg(DISTINCT target_grade) INTO v_available_structures
        FROM public.fee_structures
        WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
        AND (academic_cycle_id = v_year_id OR academic_cycle_id IS NULL);

        RETURN jsonb_build_object(
            'success', false, 
            'error', 'GRADE_MAPPING_MISSING',
            'message', 'No active fee structure found for ' || v_grade || ' in Cycle ID ' || v_year_id || '. Available: ' || COALESCE(v_available_structures::text, 'None')
        );
    END IF;

    -- 7. Link Assignment
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    -- 8. Create/Update Ledger (Using Detected Valid Year ID)
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger
    WHERE student_id = p_student_id AND academic_year_id = v_year_id;

    IF v_ledger_id IS NULL THEN
        INSERT INTO public.student_fee_ledger (
            student_id, academic_year_id, total_amount, status, created_at, updated_at, grade
        ) VALUES (
            p_student_id, v_year_id, 0, 'active', NOW(), NOW(), v_grade
        ) RETURNING id INTO v_ledger_id;
    END IF;

    -- 9. Populate Invoices
    FOR v_component IN 
        SELECT * FROM public.fee_components WHERE structure_id = v_structure_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
            AND description ILIKE v_component.name || '%'
            AND status NOT IN ('Cancelled', 'cancelled')
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, total_amount, due_date, description, status, created_at, structure_id
            ) VALUES (
                p_student_id, v_component.amount, NOW() + INTERVAL '15 days',
                v_component.name || ' (INITIAL_SYNC)', 'Pending', NOW(), v_structure_id
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 10. Update Ledger Total
    UPDATE public.student_fee_ledger
    SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM public.fee_components WHERE structure_id = v_structure_id),
        updated_at = NOW()
    WHERE id = v_ledger_id;

    -- 11. Reconcile
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'invoices_created', v_count, 
        'structure_id', v_structure_id,
        'ledger_id', v_ledger_id,
        'academic_year_used', v_year_id
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Genesis Mapping V4 (Null Year Handler) Deployed.' as status;
