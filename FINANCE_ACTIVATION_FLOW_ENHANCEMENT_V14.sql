-- =============================================================================
-- FINANCE ACTIVATION FLOW ENHANCEMENT (v14.0)
-- =============================================================================
-- OBJECTIVE: Implement strict 6-step lifecycle architecture:
--   1. ENROLLMENT_COMPLETED
--   2. YEAR_ACTIVATED
--   3. FEE_CONFIGURED
--   4. LEDGER_GENERATED
--   5. INSTALLMENTS_CREATED
--   6. PAYMENTS_ENABLED
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE: check_finance_lifecycle (Enhanced State Machine)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_finance_lifecycle(
    p_student_id UUID,
    p_academic_year_id BIGINT
)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_enrollment_status TEXT;
    v_year_status TEXT;
    v_branch_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_structure_id BIGINT;
    v_ledger_id UUID;
    v_installments_exist BOOLEAN;
BEGIN
    -- 1. ENROLLMENT_COMPLETED
    SELECT enrollment_status, branch_id, grade INTO v_enrollment_status, v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_enrollment_status IS NULL OR UPPER(v_enrollment_status) NOT IN ('ACTIVE', 'ENROLLED') THEN 
        RETURN 'ENROLLMENT_PENDING'; 
    END IF;

    -- 2. YEAR_ACTIVATED
    SELECT status::text INTO v_year_status FROM public.academic_years WHERE id = p_academic_year_id;
    IF v_year_status IS NULL OR LOWER(v_year_status) NOT IN ('active', 'current') THEN
        RETURN 'YEAR_NOT_ACTIVE';
    END IF;

    -- 3. FEE_CONFIGURED
    v_normalized_grade := TRIM(REPLACE(REPLACE(COALESCE(v_grade, ''), 'Class ', ''), 'class ', ''));
    
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = p_academic_year_id 
    AND (LOWER(COALESCE(status::text, '')) = 'active' OR UPPER(COALESCE(state::text, '')) = 'ACTIVE')
    AND (
        target_grade = v_grade 
        OR target_grade = v_normalized_grade
        OR TRIM(REPLACE(REPLACE(target_grade, 'Class ', ''), 'class ', '')) = v_normalized_grade
    )
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN 'FEE_CONFIG_MISSING'; -- Friendly alias for GRADE_MAPPING_MISSING
    END IF;

    -- Check if components exist
    IF NOT EXISTS (SELECT 1 FROM public.fee_components WHERE structure_id = v_structure_id) THEN
        RETURN 'PAYMENT_PLAN_MISSING';
    END IF;

    -- 4. LEDGER_GENERATED
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND academic_year_id = p_academic_year_id;
    
    IF v_ledger_id IS NULL THEN
        RETURN 'FEE_CONFIGURED'; -- We are ready for ledger generation
    END IF;

    -- 5. INSTALLMENTS_CREATED
    SELECT EXISTS (
        SELECT 1 FROM public.installment_schedule WHERE ledger_id = v_ledger_id
    ) INTO v_installments_exist;
    
    IF NOT v_installments_exist THEN 
        RETURN 'LEDGER_GENERATED'; 
    END IF;

    -- 6. PAYMENTS_ENABLED
    RETURN 'PAYMENTS_ENABLED';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] CORE: automate_finance_lifecycle (Refined Orchestrator)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.automate_finance_lifecycle(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_year_id BIGINT;
    v_state TEXT;
    v_result JSONB;
BEGIN
    -- Get current year
    SELECT id INTO v_year_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    IF v_year_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_ACTIVE_ACADEMIC_YEAR');
    END IF;

    -- Check current state
    v_state := public.check_finance_lifecycle(p_student_id, v_year_id);

    -- State Transition Logic
    IF v_state = 'PAYMENTS_ENABLED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'ALREADY_ACTIVE');
    END IF;

    IF v_state IN ('FEE_CONFIG_MISSING', 'PAYMENT_PLAN_MISSING', 'YEAR_NOT_ACTIVE', 'ENROLLMENT_PENDING') THEN
        RETURN jsonb_build_object('success', false, 'error', v_state);
    END IF;

    -- If state is FEE_CONFIGURED (needs ledger) OR LEDGER_GENERATED (needs installments)
    -- Both generate_student_ledger and generate_installments are idempotent
    v_result := public.generate_student_ledger(p_student_id, v_year_id);
    
    RETURN v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [3] REPORTING: get_student_finance_detail_v5 (State Harmony)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v5(
    p_student_id UUID,
    p_cycle_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_summary JSONB;
    v_installments JSONB;
    v_history JSONB;
    v_breakdown JSONB;
    v_lifecycle_state TEXT;
    v_progress INTEGER := 0;
    v_ledger_id UUID;
    v_total_billed NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_structure_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_sync_phase TEXT;
BEGIN
    -- 1. Ownership Check
    IF NOT public.check_student_ownership(p_student_id) THEN
        RETURN jsonb_build_object('error', '403_ACCESS_FORBIDDEN');
    END IF;

    -- 2. Lifecycle State Audit (v14 logic)
    v_lifecycle_state := public.check_finance_lifecycle(p_student_id, p_cycle_id);
    
    v_progress := CASE 
        WHEN v_lifecycle_state = 'PAYMENTS_ENABLED' THEN 100
        WHEN v_lifecycle_state = 'LEDGER_GENERATED' THEN 75
        WHEN v_lifecycle_state = 'FEE_CONFIGURED' THEN 50
        WHEN v_lifecycle_state = 'FEE_CONFIG_MISSING' THEN 35
        WHEN v_lifecycle_state = 'YEAR_NOT_ACTIVE' THEN 15
        WHEN v_lifecycle_state = 'ENROLLMENT_PENDING' THEN 5
        ELSE 20
    END;

    v_sync_phase := CASE 
        WHEN v_lifecycle_state = 'PAYMENTS_ENABLED' THEN 'OPERATIONAL'
        WHEN v_lifecycle_state = 'LEDGER_GENERATED' THEN 'FINALIZING'
        WHEN v_lifecycle_state = 'FEE_CONFIGURED' THEN 'LEDGER_PENDING'
        WHEN v_lifecycle_state = 'FEE_CONFIG_MISSING' THEN 'CONFIG_GAPS'
        WHEN v_lifecycle_state = 'ENROLLMENT_PENDING' THEN 'ADMISSION_HOLD'
        ELSE 'VERIFICATION'
    END;

    -- 3. Fetch Ledger Data
    SELECT id, total_amount INTO v_ledger_id, v_total_billed 
    FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND academic_year_id = p_cycle_id;
    
    SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_paid 
    FROM public.installment_schedule WHERE ledger_id = v_ledger_id;

    -- 4. Installment Schedule
    SELECT jsonb_agg(row_data ORDER BY inst_no) INTO v_installments
    FROM (
        SELECT jsonb_build_object(
            'id', id, 
            'title', 'Installment ' || installment_no, 
            'amount', amount, 
            'paid', paid_amount,
            'due_date', due_date, 
            'status', status, 
            'is_overdue', (due_date < CURRENT_DATE AND LOWER(status) != 'paid')
        ) as row_data, installment_no as inst_no
        FROM public.installment_schedule 
        WHERE ledger_id = v_ledger_id 
        ORDER BY installment_no
    ) sub;

    -- 5. Payment History
    SELECT jsonb_agg(jsonb_build_object(
        'id', id, 
        'date', payment_date, 
        'amount', amount, 
        'mode', payment_method, 
        'status', status, 
        'ref_id', transaction_id
    ) ORDER BY payment_date DESC) INTO v_history 
    FROM public.fee_payments 
    WHERE student_id = p_student_id;

    -- 6. Fee Breakdown
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    v_normalized_grade := TRIM(REPLACE(REPLACE(COALESCE(v_grade, ''), 'Class ', ''), 'class ', ''));
    
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = p_cycle_id 
    AND (LOWER(COALESCE(status::text, '')) = 'active' OR UPPER(COALESCE(state::text, '')) = 'ACTIVE')
    AND (
        target_grade = v_grade 
        OR target_grade = v_normalized_grade
        OR TRIM(REPLACE(REPLACE(target_grade, 'Class ', ''), 'class ', '')) = v_normalized_grade
    )
    LIMIT 1;

    SELECT jsonb_agg(jsonb_build_object(
        'name', name,
        'amount', amount,
        'type', 'Academic Fee',
        'frequency', COALESCE(frequency, 'Annual')
    )) INTO v_breakdown
    FROM public.fee_components 
    WHERE structure_id = v_structure_id;

    -- 7. Assemble Full Payload
    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'total_billed', COALESCE(v_total_billed, 0),
            'total_paid', COALESCE(v_total_paid, 0),
            'outstanding', COALESCE(v_total_billed, 0) - COALESCE(v_total_paid, 0),
            'status', v_lifecycle_state,
            'sync_progress', v_progress,
            'sync_phase', v_sync_phase,
            'grade', v_grade,
            'academic_period', (SELECT year_name FROM public.academic_years WHERE id = p_cycle_id),
            'branch', (
                SELECT jsonb_build_object(
                    'name', name, 
                    'code', COALESCE(city, 'HQ'),
                    'address', address,
                    'city', city
                ) 
                FROM public.school_branches 
                WHERE id = (SELECT branch_id FROM public.student_profiles WHERE user_id = p_student_id)
            )
        ),
        'installments', COALESCE(v_installments, '[]'::jsonb),
        'breakdown', COALESCE(v_breakdown, '[]'::jsonb),
        'history', COALESCE(v_history, '[]'::jsonb),
        'cycle_id', p_cycle_id
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [4] AUTOMATION: Event Trigger for Enrollment Sync
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trg_auto_finance_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') OR 
       (TG_OP = 'UPDATE' AND (OLD.enrollment_status != NEW.enrollment_status OR OLD.grade != NEW.grade)) 
    THEN
        IF NEW.enrollment_status IN ('ACTIVE', 'ENROLLED') THEN
            PERFORM public.automate_finance_lifecycle(NEW.user_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_finance_sync_on_profile ON public.student_profiles;
CREATE TRIGGER trg_auto_finance_sync_on_profile
AFTER INSERT OR UPDATE ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_finance_sync();

COMMIT;
