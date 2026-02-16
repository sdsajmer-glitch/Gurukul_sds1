-- =============================================================================
-- FIX: MASTER FINANCE TYPE REALIGNMENT (RPC UPDATES)
-- =============================================================================
-- This script updates the database functions to handle the detected ID type 
-- (UUID vs BIGINT) for academic years, preventing type cast errors.
-- =============================================================================

BEGIN;

-- 1. Resolve actual ID type (We assume UUID based on the error)
-- We'll rebuild the functions to use UUID if necessary.

CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id ANYELEMENT -- Use ANYELEMENT for flexibility if supported, but UUID is safer for now
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch_id BIGINT;
    v_grade TEXT;
    v_structure_id BIGINT;
    v_total_fee NUMERIC;
    v_ledger_id UUID;
    v_readiness TEXT;
    v_year_id_internal UUID; -- Cast target
BEGIN
    -- Force cast the input to UUID for safety
    v_year_id_internal := p_academic_year_id::text::uuid;

    -- 1. Fetch Context
    SELECT branch_id, grade INTO v_branch_id, v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    
    -- 2. Validate Readiness
    v_readiness := public.validate_finance_readiness(p_student_id, v_branch_id, v_year_id_internal);
    IF v_readiness <> 'READY' THEN
        RETURN jsonb_build_object('success', false, 'error', v_readiness);
    END IF;

    -- 3. Calculate Fee
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = v_year_id_internal 
    AND (status = 'Active' OR state = 'ACTIVE')
    AND (
        target_grade = v_grade 
        OR target_grade = REPLACE(v_grade, 'Class ', '')
        OR REPLACE(target_grade, 'Class ', '') = v_grade
        OR REPLACE(target_grade, 'Class ', '') = REPLACE(v_grade, 'Class ', '')
    )
    LIMIT 1;
    
    SELECT SUM(amount) INTO v_total_fee FROM public.fee_components WHERE structure_id = v_structure_id;

    -- 4. Upsert Ledger
    INSERT INTO public.student_fee_ledger (
        student_id, academic_year_id, branch_id, total_amount, status
    )
    VALUES (
        p_student_id, v_year_id_internal, v_branch_id, v_total_fee, 'ACTIVE'
    )
    ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        updated_at = NOW()
    RETURNING id INTO v_ledger_id;

    -- 5. Generate Installments
    PERFORM public.generate_installments(v_ledger_id);

    RETURN jsonb_build_object('success', true, 'ledger_id', v_ledger_id, 'total_amount', v_total_fee);
END;
$$;

-- Update the orchestrator to handle UUID
CREATE OR REPLACE FUNCTION public.automate_finance_lifecycle(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_year_id UUID;
    v_result JSONB;
BEGIN
    SELECT id INTO v_year_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    v_result := public.generate_student_ledger(p_student_id, v_year_id);
    RETURN v_result;
END;
$$;

-- Update validation wrapper
CREATE OR REPLACE FUNCTION public.validate_finance_readiness(
    p_student_id UUID,
    p_branch_id BIGINT,
    p_academic_year_id UUID -- Explicitly UUID
)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year_status TEXT;
    v_grade TEXT;
    v_has_mapping BOOLEAN;
    v_template_active BOOLEAN;
BEGIN
    -- 1. Academic Year Validation
    SELECT status INTO v_year_status FROM public.academic_years WHERE id = p_academic_year_id;
    IF v_year_status IS NULL OR v_year_status <> 'active' THEN
        RETURN 'YEAR_NOT_ACTIVE';
    END IF;

    -- 2. Grade Fee Mapping Validation (with FUZZY MATCH)
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    
    SELECT EXISTS (
        SELECT 1 FROM public.fee_structures 
        WHERE academic_cycle_id = p_academic_year_id
        AND (
            target_grade = v_grade 
            OR target_grade = REPLACE(v_grade, 'Class ', '')
            OR REPLACE(target_grade, 'Class ', '') = v_grade
            OR REPLACE(target_grade, 'Class ', '') = REPLACE(v_grade, 'Class ', '')
        )
    ) INTO v_has_mapping;
    
    IF NOT v_has_mapping THEN
        RETURN 'GRADE_MAPPING_MISSING';
    END IF;

    RETURN 'READY';
END;
$$;

COMMIT;
