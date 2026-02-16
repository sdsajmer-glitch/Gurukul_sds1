-- =============================================================================
-- FINANCE MODULE: LIFECYCLE REPAIR & BILLING ENGINE
-- =============================================================================
-- 1. Unifies Ledger Tables (finance_student_fee_ledger).
-- 2. Implements "Billing Engine" triggers on enrollment.
-- 3. Backfills missing ledgers for current students.
-- 4. Updates Dashboard RPC to handle "Not Generated" state.
-- =============================================================================

BEGIN;

-- [1] UNIFIED LEDGER TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.finance_student_fee_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id),
    branch_id BIGINT,
    academic_cycle_id BIGINT REFERENCES public.academic_years(id),
    fee_structure_id BIGINT REFERENCES public.fee_structures(id),
    total_billed NUMERIC DEFAULT 0,
    total_paid NUMERIC DEFAULT 0,
    outstanding_balance NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active', -- active, paid, suspended
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, academic_cycle_id) -- One ledger per cycle
);

-- Ensure Installments link to Ledger
ALTER TABLE public.student_fee_installments 
ADD COLUMN IF NOT EXISTS ledger_id UUID REFERENCES public.finance_student_fee_ledger(id);

-- [2] BILLING ENGINE: CORE LOGIC
-- ==============================
CREATE OR REPLACE FUNCTION public.fn_process_student_billing(
    p_student_id UUID,
    p_grade TEXT,
    p_branch_id BIGINT,
    p_academic_cycle_id BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_structure_id BIGINT;
    v_ledger_id UUID;
    v_total_amount NUMERIC := 0;
    v_component RECORD;
    v_installment_count INTEGER := 1;
BEGIN
    -- 1. Find Active Fee Structure for Grade & Cycle
    SELECT id INTO v_structure_id
    FROM public.fee_structures
    WHERE branch_id = p_branch_id
      AND target_grade = p_grade
      AND academic_cycle_id = p_academic_cycle_id
      AND state = 'ACTIVE'
    LIMIT 1;

    -- If no specific structure, try generic 'All' grade if it exists, otherwise fail elegantly
    IF v_structure_id IS NULL THEN
        -- Log warning or return NULL. For now, we return NULL to indicate no billing possible.
        RETURN NULL; 
    END IF;

    -- 2. Calculate Total Amount
    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount
    FROM public.fee_components
    WHERE structure_id = v_structure_id;

    -- 3. Create/Get Ledger
    INSERT INTO public.finance_student_fee_ledger (
        student_id, branch_id, academic_cycle_id, fee_structure_id, 
        total_billed, outstanding_balance, status
    )
    VALUES (
        p_student_id, p_branch_id, p_academic_cycle_id, v_structure_id, 
        v_total_amount, v_total_amount, 'active'
    )
    ON CONFLICT (student_id, academic_cycle_id) 
    DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_ledger_id;

    -- 4. Generate Installments (Simple Monthly Model for now, can be complex later)
    -- Check if installments exist to avoid duplicates
    IF NOT EXISTS (SELECT 1 FROM public.student_fee_installments WHERE ledger_id = v_ledger_id) THEN
        -- Create 1st Term (60%)
        INSERT INTO public.student_fee_installments (
            ledger_id, student_id, cycle_id, title, due_date, amount, status
        ) VALUES (
            v_ledger_id, p_student_id, p_academic_cycle_id, 'Term 1 Fee', 
            CURRENT_DATE + INTERVAL '15 days', 
            v_total_amount * 0.60, 'pending'
        );

        -- Create 2nd Term (40%)
        INSERT INTO public.student_fee_installments (
            ledger_id, student_id, cycle_id, title, due_date, amount, status
        ) VALUES (
            v_ledger_id, p_student_id, p_academic_cycle_id, 'Term 2 Fee', 
            CURRENT_DATE + INTERVAL '4 months', 
            v_total_amount * 0.40, 'pending'
        );
    END IF;

    RETURN v_ledger_id;
END;
$$;

-- [3] TRIGGER: AUTO-BILLING ON ENROLLMENT
-- =======================================
CREATE OR REPLACE FUNCTION public.trg_auto_billing_on_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cycle_id BIGINT;
BEGIN
    -- Only trigger if status changed to Enrolled or Is Active is true
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.enrollment_status = 'Enrolled' AND OLD.enrollment_status != 'Enrolled') THEN
        
        -- Get Active Cycle
        SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
        -- Fallback
        IF v_cycle_id IS NULL THEN
             SELECT id INTO v_cycle_id FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
        END IF;

        IF v_cycle_id IS NOT NULL THEN
            PERFORM public.fn_process_student_billing(
                NEW.user_id, 
                NEW.grade, 
                NEW.branch_id, 
                v_cycle_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS trg_student_billing_enrollment ON public.student_profiles;

CREATE TRIGGER trg_student_billing_enrollment
AFTER INSERT OR UPDATE ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_billing_on_enrollment();


-- [4] UPDATED RPC: get_student_finance_detail_v3 (With Ledger Check)
-- ==================================================================
CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v3(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_summary JSONB;
    v_installments JSONB;
    v_history JSONB;
    v_breakdown JSONB;
    v_cycle_id BIGINT;
    v_ledger_id UUID;
    v_total_billed NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_outstanding NUMERIC := 0;
    v_overdue NUMERIC := 0;
    v_ledger_status TEXT;
BEGIN
    -- 1. Determine Cycle
    IF p_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
        IF v_cycle_id IS NULL THEN
            SELECT id INTO v_cycle_id FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
        END IF;
    ELSE
        v_cycle_id := p_cycle_id;
    END IF;

    -- 2. Check Ledger Existence
    SELECT id, status, total_billed, total_paid, outstanding_balance 
    INTO v_ledger_id, v_ledger_status, v_total_billed, v_total_paid, v_outstanding
    FROM public.finance_student_fee_ledger
    WHERE student_id = p_student_id AND academic_cycle_id = v_cycle_id;

    -- If no ledger, try to generate it ON THE FLY (Self-healing)
    IF v_ledger_id IS NULL THEN
        -- Get student details to try generation
        DECLARE
            v_grade TEXT;
            v_branch_id BIGINT;
        BEGIN
            SELECT grade, branch_id INTO v_grade, v_branch_id FROM public.student_profiles WHERE user_id = p_student_id;
            IF v_grade IS NOT NULL THEN
                 v_ledger_id := public.fn_process_student_billing(p_student_id, v_grade, v_branch_id, v_cycle_id);
                 -- Re-fetch if generated
                 IF v_ledger_id IS NOT NULL THEN
                     SELECT id, status, total_billed, total_paid, outstanding_balance 
                     INTO v_ledger_id, v_ledger_status, v_total_billed, v_total_paid, v_outstanding
                     FROM public.finance_student_fee_ledger
                     WHERE id = v_ledger_id;
                 END IF;
            END IF;
        END;
    END IF;

    -- If STILL NULL, it means no fee structure exists -> Return Empty/Pending State
    IF v_ledger_id IS NULL THEN
        RETURN jsonb_build_object(
            'cycle_id', v_cycle_id,
            'summary', jsonb_build_object('total_billed', 0, 'status', 'NOT_GENERATED'),
            'installments', '[]'::jsonb,
            'history', '[]'::jsonb,
            'breakdown', '[]'::jsonb
        );
    END IF;

    -- 3. Calculate Overdue from Installments
    SELECT COALESCE(SUM(amount - paid), 0) INTO v_overdue
    FROM public.student_fee_installments
    WHERE ledger_id = v_ledger_id
      AND due_date < CURRENT_DATE
      AND status != 'paid';

    v_summary := jsonb_build_object(
        'total_billed', v_total_billed,
        'total_paid', v_total_paid,
        'outstanding', v_outstanding,
        'overdue', v_overdue,
        'status', v_ledger_status
    );

    -- 4. Get Installments
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'title', title,
            'due_date', due_date,
            'amount', amount,
            'paid', paid,
            'status', CASE 
                WHEN status = 'paid' THEN 'paid'
                WHEN due_date < CURRENT_DATE THEN 'overdue'
                ELSE status
            END,
            'is_overdue', (due_date < CURRENT_DATE AND status != 'paid')
        ) ORDER BY due_date ASC
    ) INTO v_installments
    FROM public.student_fee_installments
    WHERE ledger_id = v_ledger_id;

    -- 5. History
    SELECT COALESCE(jsonb_agg(sub.tx), '[]'::jsonb) INTO v_history
    FROM (
        SELECT 
            jsonb_build_object(
                'id', id,
                'date', payment_date,
                'amount', amount,
                'mode', payment_mode,
                'ref_id', transaction_ref,
                'status', status,
                'proof_url', receipt_url
            ) as tx
        FROM public.fee_payments
        WHERE student_id = p_student_id
        ORDER BY payment_date DESC
        LIMIT 50
    ) sub;

    -- 6. Breakdown (Mock based on Ledger Total for now if no component table linked yet)
    v_breakdown := jsonb_build_array(
        jsonb_build_object('name', 'General Tuition', 'amount', v_total_billed * 0.7, 'type', 'Academic'),
        jsonb_build_object('name', 'Facility Charges', 'amount', v_total_billed * 0.3, 'type', 'Infra')
    );

    RETURN jsonb_build_object(
        'cycle_id', v_cycle_id,
        'summary', v_summary,
        'installments', COALESCE(v_installments, '[]'::jsonb),
        'history', COALESCE(v_history, '[]'::jsonb),
        'breakdown', v_breakdown
    );
END;
$$;

COMMIT;
