-- =============================================================================
-- FIX: CRITICAL LEDGER GENERATION ENGINE (v1.0)
-- =============================================================================
-- Resolution for: "function public.generate_student_ledger(uuid, bigint) does not exist"
-- =============================================================================

BEGIN;

-- [0] INFRASTRUCTURE: ENTERPRISE FINANCIAL TABLES
-- Ensure the unified billing hub exists.

CREATE TABLE IF NOT EXISTS public.student_fee_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    academic_year_id BIGINT,
    branch_id BIGINT,
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, LOCKED, ARCHIVED
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS public.installment_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID REFERENCES public.student_fee_ledger(id) ON DELETE CASCADE,
    student_id UUID, -- Denormalized for query performance
    installment_no INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, partial, paid, overdue
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    action_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [1] VALIDATION ENGINE
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

    -- 2. Grade Fee Mapping Validation
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    SELECT EXISTS (
        SELECT 1 FROM public.fee_structures 
        WHERE target_grade = v_grade 
        AND academic_cycle_id = p_academic_year_id
    ) INTO v_has_mapping;
    
    IF NOT v_has_mapping THEN
        RETURN 'GRADE_MAPPING_MISSING';
    END IF;

    -- 3. Fee Template Check
    SELECT status = 'Active' OR state = 'ACTIVE' INTO v_template_active 
    FROM public.fee_structures 
    WHERE target_grade = v_grade 
    AND academic_cycle_id = p_academic_year_id
    LIMIT 1;

    IF NOT COALESCE(v_template_active, false) THEN
        RETURN 'TEMPLATE_INACTIVE';
    END IF;

    -- 4. Payment Plan Check
    IF NOT EXISTS (
        SELECT 1 FROM public.fee_components 
        WHERE structure_id = (
            SELECT id FROM public.fee_structures 
            WHERE target_grade = v_grade 
            AND academic_cycle_id = p_academic_year_id 
            LIMIT 1
        )
    ) THEN
        RETURN 'PAYMENT_PLAN_MISSING';
    END IF;

    RETURN 'READY';
END;
$$;

-- [2] INSTALLMENT ENGINE
CREATE OR REPLACE FUNCTION public.generate_installments(p_ledger_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ledger_record RECORD;
    v_total_amount NUMERIC;
BEGIN
    SELECT * INTO v_ledger_record FROM public.student_fee_ledger WHERE id = p_ledger_id;
    v_total_amount := v_ledger_record.total_amount;

    -- Delete existing pending installments to prevent duplicates
    DELETE FROM public.installment_schedule WHERE ledger_id = p_ledger_id AND status = 'pending';

    -- Installment 1: 40% (Due in 7 days)
    INSERT INTO public.installment_schedule (ledger_id, student_id, installment_no, due_date, amount, status)
    VALUES (p_ledger_id, v_ledger_record.student_id, 1, CURRENT_DATE + INTERVAL '7 days', v_total_amount * 0.4, 'pending');

    -- Installment 2: 30% (Due in 90 days)
    INSERT INTO public.installment_schedule (ledger_id, student_id, installment_no, due_date, amount, status)
    VALUES (p_ledger_id, v_ledger_record.student_id, 2, CURRENT_DATE + INTERVAL '90 days', v_total_amount * 0.3, 'pending');

    -- Installment 3: 30% (Due in 180 days)
    INSERT INTO public.installment_schedule (ledger_id, student_id, installment_no, due_date, amount, status)
    VALUES (p_ledger_id, v_ledger_record.student_id, 3, CURRENT_DATE + INTERVAL '180 days', v_total_amount * 0.3, 'pending');

    -- Log Event
    INSERT INTO public.finance_audit_logs (actor_id, action_type, description)
    VALUES (v_ledger_record.student_id, 'INSTALLMENTS_GENERATED', 'Installment schedule created for ledger ' || p_ledger_id);
END;
$$;

-- [3] CORE LEDGER ENGINE
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
    v_total_fee NUMERIC;
    v_ledger_id UUID;
    v_readiness TEXT;
BEGIN
    -- 1. Fetch Context
    SELECT branch_id, grade INTO v_branch_id, v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    
    -- 2. Validate Readiness
    v_readiness := public.validate_finance_readiness(p_student_id, v_branch_id, p_academic_year_id);
    IF v_readiness <> 'READY' THEN
        RETURN jsonb_build_object('success', false, 'error', v_readiness);
    END IF;

    -- 3. Calculate Fee (with FUZZY MATCH)
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = p_academic_year_id 
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
        p_student_id, p_academic_year_id, v_branch_id, v_total_fee, 'ACTIVE'
    )
    ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        updated_at = NOW()
    RETURNING id INTO v_ledger_id;

    -- 5. Generate Installments
    PERFORM public.generate_installments(v_ledger_id);

    -- 6. Log & Emit
    INSERT INTO public.finance_audit_logs (actor_id, action_type, description)
    VALUES (p_student_id, 'LEDGER_GENERATED', 'Total Fee: ' || v_total_fee);

    RETURN jsonb_build_object('success', true, 'ledger_id', v_ledger_id, 'total_amount', v_total_fee);
END;
$$;

-- [4] SECURITY: PERMISSIONS
GRANT EXECUTE ON FUNCTION public.generate_student_ledger(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_installments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_finance_readiness(uuid, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.automate_finance_lifecycle(uuid) TO authenticated;

COMMIT;
