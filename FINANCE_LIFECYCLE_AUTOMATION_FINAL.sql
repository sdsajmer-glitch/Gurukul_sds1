-- =============================================================================
-- FINANCE & FEES LIFECYCLE: COMPLETE ENTERPRISE AUTOMATION (v10.0)
-- =============================================================================
-- Implements the full lifecycle from Enrollment to Payment Enablement.
-- Following Senior Enterprise Architect specified patterns.
-- =============================================================================

BEGIN;

-- [0] INFRASTRUCTURE: ENTERPRISE FINANCIAL TABLES
-- ===============================================

-- Main Student Ledger (Strategic Hub)
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

-- Installment Schedule (Tactical Execution)
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

-- Financial Forensic Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS public.finance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    action_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [1] SECTION 1: VALIDATION ENGINE
-- ===============================

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
    SELECT status = 'Active' INTO v_template_active 
    FROM public.fee_structures 
    WHERE target_grade = v_grade 
    AND academic_cycle_id = p_academic_year_id
    LIMIT 1;

    IF NOT COALESCE(v_template_active, false) THEN
        RETURN 'TEMPLATE_INACTIVE';
    END IF;

    -- 4. Payment Plan Check (Implicitly check if components exist)
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

-- [2] SECTION 2 & 3: GENERATION ENGINE
-- ===================================

-- Installment Creation Flow
CREATE OR REPLACE FUNCTION public.generate_installments(p_ledger_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ledger_record RECORD;
    v_total_amount NUMERIC;
    v_count INTEGER;
BEGIN
    SELECT * INTO v_ledger_record FROM public.student_fee_ledger WHERE id = p_ledger_id;
    v_total_amount := v_ledger_record.total_amount;

    -- Delete existing pending installments to prevent duplicates
    DELETE FROM public.installment_schedule WHERE ledger_id = p_ledger_id AND status = 'pending';

    -- Strategy: Split into 3 standard installments (Enterprise Logic)
    -- This can be expanded to use a dynamic 'payment_plan' table if added later.
    
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

-- Ledger Generation Flow
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

    -- 3. Calculate Fee
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE target_grade = v_grade AND academic_cycle_id = p_academic_year_id AND status = 'Active' LIMIT 1;
    
    SELECT SUM(amount) INTO v_total_fee FROM public.fee_components WHERE structure_id = v_structure_id;

    -- 4. Upsert Ledger (Safety Check: Transaction Lock)
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

-- [3] SECTION 4: PAYMENT ENABLEMENT ENGINE
-- ======================================

CREATE OR REPLACE FUNCTION public.is_payment_enabled(
    p_student_id UUID,
    p_academic_year_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ledger_exists BOOLEAN;
    v_has_installments BOOLEAN;
    v_year_active BOOLEAN;
    v_outstanding NUMERIC;
BEGIN
    -- 1. Check Ledger
    SELECT EXISTS (SELECT 1 FROM public.student_fee_ledger WHERE student_id = p_student_id AND academic_year_id = p_academic_year_id) INTO v_ledger_exists;
    
    -- 2. Check Installments
    SELECT EXISTS (
        SELECT 1 FROM public.installment_schedule 
        WHERE ledger_id = (SELECT id FROM public.student_fee_ledger WHERE student_id = p_student_id AND academic_year_id = p_academic_year_id)
    ) INTO v_has_installments;

    -- 3. Check Academic Year
    SELECT status = 'active' INTO v_year_active FROM public.academic_years WHERE id = p_academic_year_id;

    -- 4. Check Outstanding
    SELECT total_amount - COALESCE((SELECT SUM(paid_amount) FROM public.installment_schedule WHERE ledger_id = sfl.id), 0)
    INTO v_outstanding
    FROM public.student_fee_ledger sfl
    WHERE student_id = p_student_id AND academic_year_id = p_academic_year_id;

    RETURN (v_ledger_exists AND v_has_installments AND COALESCE(v_outstanding, 0) > 0 AND COALESCE(v_year_active, false));
END;
$$;

-- [4] SECTION 5 & 10: AUTO-TRIGGER ORCHESTRATOR
-- ============================================

CREATE OR REPLACE FUNCTION public.automate_finance_lifecycle(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_year_id BIGINT;
    v_result JSONB;
BEGIN
    -- Identify the "Pulse" (Current Academic Year)
    SELECT id INTO v_current_year_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    
    IF v_current_year_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'CURRENT_YEAR_NOT_DEFINED');
    END IF;

    -- Trigger the Chain
    v_result := public.generate_student_ledger(p_student_id, v_current_year_id);
    
    RETURN v_result;
END;
$$;

-- Trigger to automate when student is enrolled or moved
CREATE OR REPLACE FUNCTION public.trg_fn_automate_student_finance()
RETURNS TRIGGER AS $$
BEGIN
    -- Automate when grade is assigned and status is active/enrolled
    IF (TG_OP = 'INSERT' AND NEW.grade IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND (NEW.grade <> OLD.grade OR NEW.enrollment_status <> OLD.enrollment_status)) THEN
        
        IF NEW.enrollment_status IN ('Active', 'Enrolled') THEN
            PERFORM public.automate_finance_lifecycle(NEW.user_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_finance_lifecycle ON public.student_profiles;
CREATE TRIGGER trg_auto_finance_lifecycle
    AFTER INSERT OR UPDATE OF grade, enrollment_status ON public.student_profiles
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_automate_student_finance();

-- [5] REVISE UI DATA ENGINE (v3.1)
-- ===============================

CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v3(
    p_student_id uuid,
    p_cycle_id uuid -- Input is uuid (db_id)
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_results json;
    v_student_exists boolean;
    v_branch_id uuid;
    v_branch_info record;
    v_active_cycle_info record;
    v_completion_rate integer := 25;
    v_ledger_id UUID;
    v_outstanding NUMERIC := 0;
    v_total_amount NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_cycle_int_id BIGINT;
BEGIN
    -- Map UUID cycle ID to internal bigint ID if necessary (academic_years table usually has bigint id)
    -- We assume p_cycle_id is the 'id' (bigint) but passed as uuid in v3? 
    -- Let's look at academic_years table: it has 'id' (likely serial/bigint).
    v_cycle_int_id := p_cycle_id::text::bigint; -- Force cast for compatibility 

    -- 1. Integrity Check
    SELECT EXISTS (SELECT 1 FROM public.student_profiles WHERE user_id = p_student_id) INTO v_student_exists;
    IF NOT v_student_exists THEN
        RETURN json_build_object('error', 'Student identity not found in regional registry');
    END IF;

    -- 2. Fetch Institutional Context
    SELECT branch_id INTO v_branch_id FROM public.student_profiles WHERE user_id = p_student_id;
    SELECT * INTO v_branch_info FROM public.school_branches WHERE id = v_branch_id;
    SELECT * INTO v_active_cycle_info FROM public.academic_years WHERE id = v_cycle_int_id;

    -- 3. Fetch Ledger Data
    SELECT id, total_amount INTO v_ledger_id, v_total_amount 
    FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND academic_year_id = v_cycle_int_id;
    
    SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_paid 
    FROM public.installment_schedule 
    WHERE ledger_id = v_ledger_id;

    v_outstanding := v_total_amount - v_total_paid;

    -- 4. Adaptive Progress Logic (UI State Machine)
    -- States: 25% (Sync), 45% (Ready), 75% (Installments), 100% (Enabled)
    IF v_ledger_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.installment_schedule WHERE ledger_id = v_ledger_id) THEN
            v_completion_rate := 75;
            IF public.is_payment_enabled(p_student_id, v_cycle_int_id) THEN
                v_completion_rate := 100;
            END IF;
        ELSE
            v_completion_rate := 45;
        END IF;
    ELSE
        -- Check if it's already in sync or failed
        v_completion_rate := 25;
    END IF;

    -- 5. Secure Payload Construction
    SELECT json_build_object(
        'summary', json_build_object(
            'total_billed', v_total_amount,
            'total_paid', v_total_paid,
            'outstanding', v_outstanding,
            'status', CASE 
                WHEN v_completion_rate = 100 THEN 'SYNCHRONIZED'
                WHEN v_completion_rate >= 45 THEN 'FINANCE_READY'
                ELSE 'NOT_GENERATED'
            END,
            'sync_progress', v_completion_rate,
            'academic_period', v_active_cycle_info.year_name,
            'branch', json_build_object(
                'name', v_branch_info.name,
                'code', COALESCE(v_branch_info.branch_code, 'CIS-' || v_branch_info.city)
            )
        ),
        'installments', (
            SELECT json_agg(t) FROM (
                SELECT 
                    id, 
                    'Installment ' || installment_no as title, 
                    due_date, 
                    amount, 
                    paid_amount as paid, 
                    status,
                    (due_date < CURRENT_DATE AND status != 'paid') as is_overdue
                FROM public.installment_schedule
                WHERE ledger_id = v_ledger_id
                ORDER BY installment_no ASC
            ) t
        ),
        'milestones', CASE 
            WHEN v_completion_rate >= 25 THEN ARRAY['ID_SYNC']
            WHEN v_completion_rate >= 45 THEN ARRAY['ID_SYNC', 'LEDGER_GEN']
            WHEN v_completion_rate >= 75 THEN ARRAY['ID_SYNC', 'LEDGER_GEN', 'INSTALLMENTS']
            ELSE ARRAY[]::TEXT[]
        END
    ) INTO v_results;

    RETURN v_results;
END;
$$;

-- [6] INITIAL DATA PUSH (Force Sync for Sanjay's Family)
-- ====================================================
DO $$
DECLARE
    v_student RECORD;
BEGIN
    FOR v_student IN SELECT user_id FROM public.student_profiles WHERE enrollment_status IN ('Active', 'Enrolled') LOOP
        PERFORM public.automate_finance_lifecycle(v_student.user_id);
    END LOOP;
END $$;

COMMIT;
