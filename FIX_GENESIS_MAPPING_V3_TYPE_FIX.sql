-- ==============================================================================
-- FIX GENESIS MAPPING V3 (TYPE CASTING FIX)
-- ==============================================================================
-- Problem: "could not determine polymorphic type because input has type unknown"
-- Cause: Passing untyped 'NULL' to generate_student_ledger() created ambiguity.
-- Solution:
-- 1. Explicitly cast NULLs (NULL::BIGINT) or use Default Arguments.
-- 2. Preserve strictly typed logic for Postgres function resolution.
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE: generate_student_ledger (Logic Unchanged from V2, just re-declaring)
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
    v_total_fee NUMERIC := 0;
    v_available_structures JSONB;
BEGIN
    -- 1. Fetch Student Context
    SELECT branch_id, grade INTO v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_PROFILE_HAS_NO_GRADE');
    END IF;

    -- 2. Auto-Detect Academic Year if NULL
    IF v_year_id IS NULL THEN
        SELECT id INTO v_year_id FROM public.academic_years 
        WHERE (branch_id = v_branch_id OR branch_id IS NULL)
        AND is_current = true
        AND LOWER(status::text) IN ('active', 'current')
        LIMIT 1;
    END IF;

    -- 3. Normalize Grade
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));

    -- 4. Find Fee Structure (Robust Lookup)
    SELECT id, academic_cycle_id INTO v_structure_id, v_structure_year_id
    FROM public.fee_structures 
    WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (
         (v_year_id IS NOT NULL AND academic_cycle_id = v_year_id)
         OR academic_cycle_id IS NULL
    )
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
            'message', 'No active fee structure found for ' || v_grade || '. Available Configs: ' || COALESCE(v_available_structures::text, 'None')
        );
    END IF;

    -- 6. Link Assignment
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    -- 7. Create/Update Ledger
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger
    WHERE student_id = p_student_id AND (academic_year_id = v_year_id OR (v_year_id IS NULL AND academic_year_id IS NULL));

    IF v_ledger_id IS NULL THEN
        INSERT INTO public.student_fee_ledger (
            student_id, academic_year_id, total_amount, status, created_at, updated_at, grade
        ) VALUES (
            p_student_id, v_year_id, 0, 'active', NOW(), NOW(), v_grade
        ) RETURNING id INTO v_ledger_id;
    END IF;

    -- 8. Populate Invoices
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

    -- 9. Update Ledger Total
    UPDATE public.student_fee_ledger
    SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM public.fee_components WHERE structure_id = v_structure_id),
        updated_at = NOW()
    WHERE id = v_ledger_id;

    -- 10. Reconcile
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'invoices_created', v_count, 
        'structure_id', v_structure_id,
        'ledger_id', v_ledger_id,
        'mapped_grade', v_grade
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] WRAPPER: admin_sync_student_billing (FIX: Type Safety)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- FIX: Removed explicit NULL parameter to avoid "input has type unknown" error.
    -- The default parameter in generate_student_ledger will handle it.
    RETURN public.generate_student_ledger(p_student_id);
END;
$$;

-- Alias wrapper (also fixed)
CREATE OR REPLACE FUNCTION public.generate_student_ledger_for_student(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN public.generate_student_ledger(p_student_id);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [3] STATUS: check_finance_lifecycle (Unchanged, ensures consistency)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_finance_lifecycle(
    p_student_id UUID,
    p_academic_year_id BIGINT
)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_status TEXT;
    v_structure_id BIGINT;
    v_ledger_id UUID;
    v_installments_exist BOOLEAN;
    v_branch_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
BEGIN
    SELECT enrollment_status, branch_id, grade INTO v_status, v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_status IS NULL OR UPPER(v_status) NOT IN ('ACTIVE', 'ENROLLED') THEN 
        RETURN 'ENROLLMENT_PENDING'; 
    END IF;

    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));
    
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (
         (p_academic_year_id IS NOT NULL AND academic_cycle_id = p_academic_year_id)
         OR academic_cycle_id IS NULL
    )
    AND (
        LOWER(target_grade) = LOWER(v_grade)
        OR TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade
    )
    LIMIT 1;

    IF v_structure_id IS NULL THEN 
        RETURN 'GRADE_MAPPING_MISSING'; 
    END IF;

    SELECT id INTO v_ledger_id FROM public.student_fee_ledger 
    WHERE student_id = p_student_id 
    AND (academic_year_id = p_academic_year_id OR (p_academic_year_id IS NULL AND academic_year_id IS NULL));
    
    IF v_ledger_id IS NULL THEN 
        RETURN 'FINANCE_SYNC_REQUIRED'; 
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.installment_schedule WHERE ledger_id = v_ledger_id
    ) INTO v_installments_exist;
    
    IF NOT v_installments_exist THEN 
        RETURN 'LEDGER_GENERATED'; 
    END IF;

    RETURN 'PAYMENTS_ENABLED';
END;
$$;

COMMIT;

SELECT 'SUCCESS: Genesis Mapping V3 (Type Safety Patch) Deployed.' as status;
