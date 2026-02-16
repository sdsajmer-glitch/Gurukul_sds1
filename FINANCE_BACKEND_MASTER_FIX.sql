-- ==========================================
-- MASTER FINANCE BACKEND FIX (v4.3)
-- Schema Alignment: Removing non-existent columns (total_amount)
-- ==========================================

BEGIN;

-- 1. Ensure Academic Year 2025-2026 Exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.academic_years WHERE year_name = '2025-2026') THEN
        INSERT INTO public.academic_years (year_name, start_date, end_date, status, is_current)
        VALUES ('2025-2026', '2025-04-01', '2026-03-31', 'upcoming', false);
    END IF;
END $$;

-- 2. Create a Fee Structure for 2025-2026
DO $$
DECLARE
    v_cycle_id BIGINT;
    v_struct_id BIGINT;
BEGIN
    SELECT id INTO v_cycle_id FROM public.academic_years WHERE year_name = '2025-2026';

    -- Create or Re-load Structure
    -- Column total_amount removed as it is calculated on-the-fly from components
    SELECT id INTO v_struct_id FROM public.fee_structures 
    WHERE name = 'Standard Grade 5 Fee (2025-26)' AND academic_cycle_id = v_cycle_id;

    IF v_struct_id IS NULL THEN
        INSERT INTO public.fee_structures (name, academic_cycle_id, description, state, created_at)
        VALUES ('Standard Grade 5 Fee (2025-26)', v_cycle_id, 'Projected Fee Structure for next year', 'ACTIVE', NOW())
        RETURNING id INTO v_struct_id;
    END IF;

    -- Clean up and refresh components
    DELETE FROM public.fee_components WHERE structure_id = v_struct_id;
    
    INSERT INTO public.fee_components (structure_id, name, amount, frequency, is_mandatory)
    VALUES 
    (v_struct_id, 'Annual Tuition Information', 85000.00, 'Annual', true),
    (v_struct_id, 'Development Fund', 25000.00, 'Annual', true),
    (v_struct_id, 'Lab & Activity', 15000.00, 'Annual', true);

END $$;

-- 3. UPDATED FINANCE DETAIL RPC (v3 -> v4 Logic)
-- Handles: Preview Mode (upcoming) vs Active Mode (Ledger)
CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v3(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_ledger_id UUID;
    v_cycle_status TEXT;
    v_summary JSONB;
    v_installments JSONB;
    v_breakdown JSONB;
    v_total_billed NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_outstanding NUMERIC := 0;
    v_struct_id BIGINT;
    v_target_cycle_id BIGINT;
BEGIN
    -- 1. Resolve Cycle ID
    IF p_cycle_id IS NULL THEN
        SELECT id, status INTO v_target_cycle_id, v_cycle_status 
        FROM public.academic_years WHERE is_current = true LIMIT 1;
    ELSE
        v_target_cycle_id := p_cycle_id;
        SELECT status INTO v_cycle_status FROM public.academic_years WHERE id = v_target_cycle_id;
    END IF;

    -- 2. Check for Existing Ledger (Real Data - Alignment with public.finance_student_fee_ledger)
    SELECT id, total_billed, total_paid, outstanding_balance
    INTO v_ledger_id, v_total_billed, v_total_paid, v_outstanding
    FROM public.finance_student_fee_ledger
    WHERE student_id = p_student_id AND academic_cycle_id = v_target_cycle_id
    LIMIT 1;

    -- SCENARIO A: Ledger Exists (Active or Past)
    IF v_ledger_id IS NOT NULL THEN
        -- Fetch Real Installments
        SELECT jsonb_agg(jsonb_build_object(
            'id', id,
            'title', title,
            'amount', amount,
            'due_date', due_date,
            'paid', paid,
            'status', status,
            'is_overdue', (due_date < CURRENT_DATE AND status != 'paid')
        ) ORDER BY due_date ASC)
        INTO v_installments
        FROM public.student_fee_installments
        WHERE ledger_id = v_ledger_id;

        -- Fetch Breakdown (from linked components)
        SELECT jsonb_agg(jsonb_build_object(
            'name', name,
            'amount', amount,
            'type', 'Standard'
        ))
        INTO v_breakdown
        FROM public.fee_components
        WHERE structure_id = (SELECT fee_structure_id FROM public.finance_student_fee_ledger WHERE id = v_ledger_id);
        
        IF v_breakdown IS NULL THEN
            v_breakdown := jsonb_build_array(jsonb_build_object('name', 'Consolidated Fee', 'amount', v_total_billed, 'type', 'General'));
        END IF;

        v_summary := jsonb_build_object(
            'total_billed', v_total_billed,
            'total_paid', v_total_paid,
            'outstanding', v_outstanding,
            'status', UPPER(COALESCE(v_cycle_status, 'UNKNOWN'))
        );

    -- SCENARIO B: No Ledger but UPCOMING (Preview Mode)
    ELSIF v_cycle_status = 'upcoming' THEN
        -- Try to find ANY active structure for this cycle to provide a preview
        SELECT id INTO v_struct_id
        FROM public.fee_structures 
        WHERE academic_cycle_id = v_target_cycle_id AND state = 'ACTIVE'
        ORDER BY id DESC LIMIT 1;

        IF v_struct_id IS NOT NULL THEN
            -- Calculate Total for Preview
            SELECT SUM(amount) INTO v_total_billed FROM public.fee_components WHERE structure_id = v_struct_id;

            v_summary := jsonb_build_object(
                'total_billed', v_total_billed,
                'total_paid', 0,
                'outstanding', 0,
                'status', 'PREVIEW'
            );

            -- Mock installments for preview (Term-based)
            v_installments := jsonb_build_array(
                jsonb_build_object('id', 'term-1', 'title', 'Term 1 (April)', 'amount', v_total_billed * 0.4, 'due_date', '2025-04-10', 'paid', 0, 'status', 'upcoming', 'is_overdue', false),
                jsonb_build_object('id', 'term-2', 'title', 'Term 2 (August)', 'amount', v_total_billed * 0.3, 'due_date', '2025-08-10', 'paid', 0, 'status', 'upcoming', 'is_overdue', false),
                jsonb_build_object('id', 'term-3', 'title', 'Term 3 (December)', 'amount', v_total_billed * 0.3, 'due_date', '2025-12-10', 'paid', 0, 'status', 'upcoming', 'is_overdue', false)
            );

            -- Components
            SELECT jsonb_agg(jsonb_build_object(
                'name', name,
                'amount', amount,
                'type', 'Standard'
            ))
            INTO v_breakdown
            FROM public.fee_components
            WHERE structure_id = v_struct_id;
        ELSE
            v_summary := jsonb_build_object('total_billed', 0, 'total_paid', 0, 'outstanding', 0, 'status', 'NOT_GENERATED');
            v_installments := '[]'::jsonb;
            v_breakdown := '[]'::jsonb;
        END IF;

    ELSE
        v_summary := jsonb_build_object('total_billed', 0, 'total_paid', 0, 'outstanding', 0, 'status', 'NOT_GENERATED');
        v_installments := '[]'::jsonb;
        v_breakdown := '[]'::jsonb;
    END IF;

    RETURN jsonb_build_object(
        'summary', v_summary,
        'installments', COALESCE(v_installments, '[]'::jsonb),
        'breakdown', COALESCE(v_breakdown, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
