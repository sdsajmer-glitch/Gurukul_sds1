-- =============================================================================
-- FINANCE ECOSYSTEM STABILITY PROTOCOL (v11.0)
-- =============================================================================
-- Resolution for: "Stuck Synchronization" and "State Mismatch"
-- 1. Full Status Harmonization (Lowercase 'active' Protocol)
-- 2. Case-Insensitive Validation Logic
-- 3. Automatic Ledger Generation for Stuck Nodes
-- 4. Payment Enablement Logic Hardening
-- =============================================================================

BEGIN;

-- [0] FIREWALL: HARMONIZE STATUS VALUES
-- Ensure all core registries follow the lowercase protocol for state-machine stability.
UPDATE public.academic_years SET status = LOWER(status::text)::academic_year_status;
UPDATE public.fee_structures SET status = 'active' WHERE status::text ILIKE 'active' OR state::text ILIKE 'active';
UPDATE public.student_fee_ledger SET status = 'active' WHERE status::text ILIKE 'active' OR status IS NULL;

-- [1] REPAIR: validate_institution_finance (CASE-INSENSITIVE & ROBUST)
CREATE OR REPLACE FUNCTION public.validate_institution_finance(
    p_branch_id BIGINT,
    p_grade_id TEXT,
    p_academic_year_id BIGINT
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- 1. Academic Year Active (Allow 'active' or 'current')
    IF NOT EXISTS (
        SELECT 1 FROM public.academic_years 
        WHERE id = p_academic_year_id 
        AND (LOWER(status::text) = 'active' OR LOWER(status::text) = 'current')
    ) THEN
        RETURN 'YEAR_NOT_ACTIVE';
    END IF;

    -- 2. Grade Fee Mapping & Template (with FUZZY MATCH & Case-Insensitive Status)
    IF NOT EXISTS (
        SELECT 1 FROM public.fee_structures 
        WHERE academic_cycle_id = p_academic_year_id 
        AND (LOWER(status::text) = 'active' OR LOWER(state::text) = 'active')
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

-- [2] REPAIR: validate_finance_readiness (MATCHING LOGIC)
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
    v_grade TEXT;
BEGIN
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    RETURN public.validate_institution_finance(p_branch_id, v_grade, p_academic_year_id);
END;
$$;

-- [3] REPAIR: is_payment_enabled (HARDENING)
CREATE OR REPLACE FUNCTION public.is_payment_enabled(
    p_student_id UUID,
    p_academic_year_id BIGINT
)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_ledger_id UUID;
    v_cycle_status TEXT;
BEGIN
    -- 1. Check Cycle Status
    SELECT status INTO v_cycle_status FROM public.academic_years WHERE id = p_academic_year_id;
    IF v_cycle_status IS NULL OR (LOWER(v_cycle_status) NOT IN ('active', 'current')) THEN
        RETURN FALSE;
    END IF;

    -- 2. Check Ledger Existence
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND academic_year_id = p_academic_year_id;
    
    IF v_ledger_id IS NULL THEN RETURN FALSE; END IF;

    -- 3. Check Installment existence
    RETURN EXISTS (SELECT 1 FROM public.installment_schedule WHERE ledger_id = v_ledger_id);
END;
$$;

-- [4] REPAIR: generate_student_ledger (STRICT LOWERCASE 'active')
CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch_id BIGINT;
    v_grade TEXT;
    v_structure_id BIGINT;
    v_total_fee NUMERIC := 0;
    v_ledger_id UUID;
BEGIN
    -- 1. Fetch Student Context
    SELECT branch_id, grade INTO v_branch_id, v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    
    -- 2. Fetch Protocol (Fuzzy Match)
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = p_academic_year_id 
    AND (LOWER(status::text) = 'active' OR LOWER(state::text) = 'active')
    AND (
        target_grade = v_grade 
        OR target_grade = REPLACE(v_grade, 'Class ', '')
        OR REPLACE(target_grade, 'Class ', '') = v_grade
        OR REPLACE(target_grade, 'Class ', '') = REPLACE(v_grade, 'Class ', '')
    )
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRADE_MAPPING_MISSING');
    END IF;

    -- 3. Calculate Fee
    SELECT SUM(amount) INTO v_total_fee FROM public.fee_components WHERE structure_id = v_structure_id;

    -- 4. UPSERT LEDGER
    INSERT INTO public.student_fee_ledger (
        student_id, academic_year_id, branch_id, total_amount, status
    ) VALUES (
        p_student_id, p_academic_year_id, v_branch_id, COALESCE(v_total_fee, 0), 'active'
    )
    ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        status = 'active',
        updated_at = NOW()
    RETURNING id INTO v_ledger_id;

    -- 5. Trigger Financial Installments
    PERFORM public.generate_installments(v_ledger_id);

    RETURN jsonb_build_object('success', true, 'ledger_id', v_ledger_id, 'total_amount', COALESCE(v_total_fee, 0));
END;
$$;

-- [5] REPAIR: MASS SYNCHRONIZATION (THE HEALER)
DO $$
DECLARE
    v_student RECORD;
    v_current_year_id BIGINT;
    v_count INTEGER := 0;
BEGIN
    SELECT id INTO v_current_year_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    
    IF v_current_year_id IS NOT NULL THEN
        FOR v_student IN 
            SELECT sp.user_id 
            FROM public.student_profiles sp
            LEFT JOIN public.student_fee_ledger sfl ON sp.user_id = sfl.student_id AND sfl.academic_year_id = v_current_year_id
            WHERE sp.enrollment_status IN ('Active', 'Enrolled')
            AND sfl.id IS NULL -- Only those missing ledger
        LOOP
            BEGIN
                PERFORM public.automate_finance_lifecycle(v_student.user_id);
                v_count := v_count + 1;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Failed to sync student %: %', v_student.user_id, SQLERRM;
            END;
        END LOOP;
        RAISE NOTICE 'Repaired % stuck student nodes.', v_count;
    END IF;
END $$;

-- [6] AUDIT: LOG REPAIR
INSERT INTO public.finance_audit_logs (action_type, description, metadata)
VALUES ('SYSTEM_REPAIR', 'Executed Finance Ecosystem Stability Protocol v11.0', '{"version": "11.0", "scope": "global_harmonization"}'::jsonb);

COMMIT;

SELECT 'SUCCESS: Finance Ecosystem Stability Protocol v11.0 Applied.' as status;
