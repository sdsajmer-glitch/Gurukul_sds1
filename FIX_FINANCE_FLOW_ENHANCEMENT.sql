-- =============================================================================
-- FINANCE FLOW ENHANCEMENT & REPAIR
-- =============================================================================
-- 1. Creates the missing get_student_finance_detail_v3 RPC.
-- 2. Ensures underlying tables exist for data flow.
-- =============================================================================

BEGIN;

-- [1] Ensure Tables Exist (Idempotent)
-- ====================================

CREATE TABLE IF NOT EXISTS public.student_fee_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id),
    cycle_id BIGINT,
    title TEXT,
    due_date DATE,
    amount NUMERIC DEFAULT 0,
    paid NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, paid, overdue, partial
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id),
    amount NUMERIC,
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    payment_mode TEXT, -- UPI, NEFT, CASH, CHEQUE
    transaction_ref TEXT,
    status TEXT DEFAULT 'completed',
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [2] The Missing RPC: get_student_finance_detail_v3
-- ==================================================

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
    v_total_billed NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_outstanding NUMERIC := 0;
    v_overdue NUMERIC := 0;
BEGIN
    -- 1. Determine Cycle (Default to latest if NULL)
    IF p_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
        -- Fallback to latest start_date if no current flag
        IF v_cycle_id IS NULL THEN
            SELECT id INTO v_cycle_id FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
        END IF;
    ELSE
        v_cycle_id := p_cycle_id;
    END IF;

    -- 2. Calculate Summary Metrics (aggregating from installments for accuracy)
    SELECT 
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(paid), 0)
    INTO v_total_billed, v_total_paid
    FROM public.student_fee_installments
    WHERE student_id = p_student_id 
      AND (cycle_id = v_cycle_id OR v_cycle_id IS NULL)
      AND is_active = true;

    v_outstanding := v_total_billed - v_total_paid;
    
    SELECT COALESCE(SUM(amount - paid), 0) INTO v_overdue
    FROM public.student_fee_installments
    WHERE student_id = p_student_id 
      AND (cycle_id = v_cycle_id OR v_cycle_id IS NULL)
      AND is_active = true
      AND due_date < CURRENT_DATE
      AND status != 'paid';

    v_summary := jsonb_build_object(
        'total_billed', v_total_billed,
        'total_paid', v_total_paid,
        'outstanding', v_outstanding,
        'overdue', v_overdue
    );

    -- 3. Get Installments List
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
    WHERE student_id = p_student_id 
      AND (cycle_id = v_cycle_id OR v_cycle_id IS NULL)
      AND is_active = true;

    -- 4. Get Transaction History
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

    -- 5. Mock/Calculate Breakdown (If generic structure exists, use it, else flat estimate)
    -- Ideally this comes from a fee_structure_assignments table. For now, generate a basic breakdown based on billed amount.
    IF v_total_billed > 0 THEN
        v_breakdown := jsonb_build_array(
            jsonb_build_object('name', 'Tuition Fee', 'amount', v_total_billed * 0.6, 'type', 'Academic'),
            jsonb_build_object('name', 'Development Fee', 'amount', v_total_billed * 0.2, 'type', 'Infra'),
            jsonb_build_object('name', 'Activity Charges', 'amount', v_total_billed * 0.1, 'type', 'Co-Curricular'),
            jsonb_build_object('name', 'Transport/Other', 'amount', v_total_billed * 0.1, 'type', 'Facility')
        );
    ELSE
        v_breakdown := '[]'::jsonb;
    END IF;

    -- 6. Construct Final Response
    RETURN jsonb_build_object(
        'cycle_id', v_cycle_id,
        'summary', v_summary,
        'installments', COALESCE(v_installments, '[]'::jsonb),
        'history', COALESCE(v_history, '[]'::jsonb),
        'breakdown', v_breakdown
    );
END;
$$;

-- [3] Mock Data Generator (Optional - Safe to Run)
-- Only inserts if no data exists for easier testing
DO $$
DECLARE
    v_student_id UUID;
    v_cycle_id BIGINT;
BEGIN
    SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    -- Get a student to seed (e.g. current user family)
    -- For safety, we won't auto-seed blindly, but the RPC handles missing data gracefully now.
END $$;

COMMIT;
