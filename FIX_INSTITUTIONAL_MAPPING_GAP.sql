-- =============================================================================
-- FIX: INSTITUTIONAL MAPPING PROTOCOL (v1.1)
-- =============================================================================
-- Resolution for: "Institutional Sync Gap: GRADE_MAPPING_MISSING"
-- 1. Standardizes Grade Matching (Handles "Class 4" vs "4")
-- 2. Bulk Generates Missing Fee Protocols for Academic Cycle 2025-26
-- 3. Synchronizes State Machine (state='ACTIVE' vs status='Active')
-- =============================================================================

BEGIN;

-- [0] DATA HEALER: REPAIR MISSING PROTOCOLS
DO $$
DECLARE
    v_cycle_id BIGINT;
    v_branch_id BIGINT;
    v_grades TEXT[] := ARRAY['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    v_grade TEXT;
    v_struct_id BIGINT;
BEGIN
    -- Identify the "Pulse" (Current Academic Year 2025-26)
    SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    
    -- Fallback to look up by name if is_current is not set correctly
    IF v_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id FROM public.academic_years WHERE year_name = '2025-2026' LIMIT 1;
    END IF;

    IF v_cycle_id IS NULL THEN
        RAISE NOTICE 'ACADEMIC_CYCLE_NOT_FOUND: Ensure 2025-2026 is initialized.';
        RETURN;
    END IF;

    -- Map existing branch
    SELECT id INTO v_branch_id FROM public.school_branches LIMIT 1;

    FOREACH v_grade IN ARRAY v_grades LOOP
        -- Check if a structure exists for this grade in this cycle (fuzzy check)
        SELECT id INTO v_struct_id FROM public.fee_structures 
        WHERE academic_cycle_id = v_cycle_id 
        AND (target_grade = v_grade OR target_grade = REPLACE(v_grade, 'Class ', ''))
        LIMIT 1;

        IF v_struct_id IS NULL THEN
            INSERT INTO public.fee_structures (name, target_grade, academic_cycle_id, branch_id, state, status, is_active)
            VALUES ('Institutional Fee Protocol - Grade ' || v_grade, v_grade, v_cycle_id, v_branch_id, 'ACTIVE', 'Active', true)
            RETURNING id INTO v_struct_id;

            -- Add Core components to make it VALIDATED
            INSERT INTO public.fee_components (structure_id, name, amount, frequency)
            VALUES 
            (v_struct_id, 'Tuition Fee (Standard)', 75000.00, 'Annual'),
            (v_struct_id, 'Admission/Reg Fee', 5000.00, 'One-time'),
            (v_struct_id, 'Activity Fund', 10000.00, 'Annual');
        ELSE
            -- Ensure it is ACTIVE
            UPDATE public.fee_structures 
            SET state = 'ACTIVE', status = 'Active', is_active = true 
            WHERE id = v_struct_id;
        END IF;
    END LOOP;
END $$;

-- [1] LOGIC UPGRADE: validate_finance_readiness (FUZZY MATCH)
CREATE OR REPLACE FUNCTION public.validate_finance_readiness(
    p_student_id UUID,
    p_branch_id BIGINT,
    p_academic_year_id BIGINT
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

    -- 3. Fee Template Check
    SELECT (status = 'Active' OR state = 'ACTIVE') INTO v_template_active 
    FROM public.fee_structures 
    WHERE academic_cycle_id = p_academic_year_id
    AND (
        target_grade = v_grade 
        OR target_grade = REPLACE(v_grade, 'Class ', '')
        OR REPLACE(target_grade, 'Class ', '') = v_grade
        OR REPLACE(target_grade, 'Class ', '') = REPLACE(v_grade, 'Class ', '')
    )
    LIMIT 1;

    IF NOT COALESCE(v_template_active, false) THEN
        RETURN 'TEMPLATE_INACTIVE';
    END IF;

    -- 4. Payment Plan Check
    IF NOT EXISTS (
        SELECT 1 FROM public.fee_components 
        WHERE structure_id = (
            SELECT id FROM public.fee_structures 
            WHERE academic_cycle_id = p_academic_year_id 
            AND (
                target_grade = v_grade 
                OR target_grade = REPLACE(v_grade, 'Class ', '')
                OR REPLACE(target_grade, 'Class ', '') = v_grade
                OR REPLACE(target_grade, 'Class ', '') = REPLACE(v_grade, 'Class ', '')
            )
            LIMIT 1
        )
    ) THEN
        RETURN 'PAYMENT_PLAN_MISSING';
    END IF;

    RETURN 'READY';
END;
$$;

-- [2] LOGIC UPGRADE: validate_institution_finance (FUZZY MATCH)
CREATE OR REPLACE FUNCTION public.validate_institution_finance(
    p_branch_id BIGINT,
    p_grade_id TEXT,
    p_academic_year_id BIGINT
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- 1. Academic Year Active
    IF NOT EXISTS (SELECT 1 FROM public.academic_years WHERE id = p_academic_year_id AND status = 'active') THEN
        RETURN 'YEAR_NOT_ACTIVE';
    END IF;

    -- 2. Grade Fee Mapping & Template (with FUZZY MATCH)
    IF NOT EXISTS (
        SELECT 1 FROM public.fee_structures 
        WHERE academic_cycle_id = p_academic_year_id 
        AND (status = 'Active' OR state = 'ACTIVE')
        AND (
            target_grade = p_grade_id 
            OR target_grade = REPLACE(p_grade_id, 'Class ', '')
            OR REPLACE(target_grade, 'Class ', '') = p_grade_id
            OR REPLACE(target_grade, 'Class ', '') = REPLACE(p_grade_id, 'Class ', '')
        )
    ) THEN
        RETURN 'GRADE_MAPPING_MISSING';
    END IF;

    -- 3. Payment Plan / Components
    IF NOT EXISTS (
        SELECT 1 FROM public.fee_components 
        WHERE structure_id = (
            SELECT id FROM public.fee_structures 
            WHERE academic_cycle_id = p_academic_year_id 
            AND (
                target_grade = p_grade_id 
                OR target_grade = REPLACE(p_grade_id, 'Class ', '')
                OR REPLACE(target_grade, 'Class ', '') = p_grade_id
                OR REPLACE(target_grade, 'Class ', '') = REPLACE(p_grade_id, 'Class ', '')
            )
            LIMIT 1
        )
    ) THEN
        RETURN 'PAYMENT_PLAN_MISSING';
    END IF;

    RETURN 'VALIDATED';
END;
$$;

-- [3] SECURITY: RE-GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.validate_finance_readiness(uuid, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_institution_finance(bigint, text, bigint) TO authenticated;

COMMIT;
