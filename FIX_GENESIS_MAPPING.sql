-- ==============================================================================
-- FIX GENESIS MAPPING (FEE STRUCTURE LOOKUP)
-- ==============================================================================
-- Problem: "No active fee structure found for Grade 4" error when mapping protocol.
-- Cause: The lookup logic was strict on case ('Active') and exact grade string match.
-- Solution: Implement robust, case-insensitive, fuzzy-matching logic for fee structures.
-- ==============================================================================

BEGIN;

-- 1. RE-IMPLEMENT: generate_student_ledger_for_student (Robust Version)
CREATE OR REPLACE FUNCTION public.generate_student_ledger_for_student(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_structure_id BIGINT;
    v_component RECORD;
    v_count INT := 0;
    v_year_id BIGINT;
    v_branch_id BIGINT;
    v_ledger_id UUID;
    v_existing_ledger_id UUID;
BEGIN
    -- 1. Get Context
    SELECT grade, branch_id INTO v_grade, v_branch_id 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Grade context not initialized.');
    END IF;

    -- 2. Determine Current Academic Year (Best Effort)
    SELECT id INTO v_year_id FROM public.academic_years 
    WHERE (branch_id = v_branch_id OR branch_id IS NULL)
    AND is_current = true
    AND LOWER(status::text) IN ('active', 'current')
    LIMIT 1;

    -- 3. Normalize Grade (e.g. "Grade 4" -> "4", "Class 4" -> "4")
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));

    -- 4. Find Fee Structure (Robust Search)
    SELECT id INTO v_structure_id 
    FROM public.fee_structures 
    WHERE (
        -- Match Academic Year if we found one
        (v_year_id IS NOT NULL AND academic_cycle_id = v_year_id)
        OR 
        (v_year_id IS NULL AND (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE'))
    )
    AND (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (
        -- Exact Match
        LOWER(target_grade) = LOWER(v_grade)
        OR 
        -- Normalized Match (Database "4" vs Input "Grade 4")
        TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade
    )
    ORDER BY created_at DESC 
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active fee structure found for Grade ' || v_grade || ' (Year ID: ' || COALESCE(v_year_id::text, 'Unknown') || ')');
    END IF;

    -- 5. Link Student to Fee Structure
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    -- 6. Generate/Update Ledger (The V13 way preferred, but keeping fallback)
    -- Check if ledger exists
    SELECT id INTO v_existing_ledger_id FROM public.student_fee_ledger 
    WHERE student_id = p_student_id 
    AND (v_year_id IS NULL OR academic_year_id = v_year_id);

    IF v_existing_ledger_id IS NULL THEN
        -- Create new ledger
        INSERT INTO public.student_fee_ledger (
            student_id, academic_year_id, total_amount, status, created_at, updated_at, grade
        ) VALUES (
            p_student_id, v_year_id, 0, 'active', NOW(), NOW(), v_grade
        ) RETURNING id INTO v_existing_ledger_id;
    END IF;

    -- 7. Populate Invoices / Ledger (Hybrid Approach for Compatibility)
    FOR v_component IN 
        SELECT * FROM public.fee_components WHERE structure_id = v_structure_id
    LOOP
        -- A: Create Invoice (Old System Compatibility)
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

    -- 8. Recalculate Ledger Total (V13 Requirement)
    UPDATE public.student_fee_ledger
    SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM public.fee_components WHERE structure_id = v_structure_id)
    WHERE id = v_existing_ledger_id;

    -- 9. Reconcile Final State
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'invoices_created', v_count, 'structure_id', v_structure_id);
END;
$$;


-- 2. RE-IMPLEMENT: check_finance_lifecycle (Ensuring consistency with new lookup)
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

    -- Fuzzy Lookup for Structure
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));
    
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = p_academic_year_id 
    AND (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (
        LOWER(target_grade) = LOWER(v_grade)
        OR TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade
    )
    LIMIT 1;

    IF v_structure_id IS NULL THEN 
        RETURN 'GRADE_MAPPING_MISSING'; 
    END IF;

    -- Check Ledger
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND academic_year_id = p_academic_year_id;
    
    IF v_ledger_id IS NULL THEN 
        RETURN 'FINANCE_SYNC_REQUIRED'; 
    END IF;

    -- Check Installments (using paid_amount safely if possible, but just checking existence here)
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

SELECT 'SUCCESS: Genesis Mapping protocols upgraded to fuzzy-match.' as status;
