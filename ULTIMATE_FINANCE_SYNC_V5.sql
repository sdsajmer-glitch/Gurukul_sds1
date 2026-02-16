-- =============================================================================
-- ULTIMATE FINANCE REPAIR: ROBUST LEDGER ORCHESTRATION (v5.0)
-- =============================================================================
-- Resolution for: "null value in column ledger_id violates not-null constraint"
-- This version implements a bulletproof Upsert pattern to ensure the Ledger ID
-- is ALWAYS captured before installment generation.
-- =============================================================================

BEGIN;

-- [0] FIREWALL: RE-FORCE SCHEMA INTEGRITY
DO $$ 
BEGIN
    -- Ensure columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installment_schedule' AND column_name = 'student_id') THEN
        ALTER TABLE public.installment_schedule ADD COLUMN student_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installment_schedule' AND column_name = 'academic_year_id') THEN
        -- Detect type from academic_years
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'academic_years' AND column_name = 'id' LIMIT 1) = 'uuid' THEN
            ALTER TABLE public.installment_schedule ADD COLUMN academic_year_id UUID;
        ELSE
            ALTER TABLE public.installment_schedule ADD COLUMN academic_year_id BIGINT;
        END IF;
    END IF;
END $$;

-- [1] LOGIC UPGRADE: ROBUST INSTALLMENT ENGINE
CREATE OR REPLACE FUNCTION public.generate_installments(p_ledger_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ledger_record RECORD;
    v_total_amount NUMERIC;
BEGIN
    -- Safety Check
    IF p_ledger_id IS NULL THEN 
        RETURN; 
    END IF;

    SELECT * INTO v_ledger_record FROM public.student_fee_ledger WHERE id = p_ledger_id;
    
    -- If ledger Record not found, abort
    IF NOT FOUND THEN RETURN; END IF;
    
    v_total_amount := COALESCE(v_ledger_record.total_amount, 0);

    -- Wipe existing pending to refresh
    DELETE FROM public.installment_schedule WHERE ledger_id = p_ledger_id AND status = 'pending';

    -- Generate fresh 3-Term split
    INSERT INTO public.installment_schedule (ledger_id, student_id, academic_year_id, installment_no, due_date, amount, status)
    VALUES 
    (p_ledger_id, v_ledger_record.student_id, v_ledger_record.academic_year_id, 1, CURRENT_DATE + INTERVAL '7 days', v_total_amount * 0.4, 'pending'),
    (p_ledger_id, v_ledger_record.student_id, v_ledger_record.academic_year_id, 2, CURRENT_DATE + INTERVAL '90 days', v_total_amount * 0.3, 'pending'),
    (p_ledger_id, v_ledger_record.student_id, v_ledger_record.academic_year_id, 3, CURRENT_DATE + INTERVAL '180 days', v_total_amount * 0.3, 'pending');
END;
$$;

-- [2] LOGIC UPGRADE: BULLETPROOF LEDGER UPSERT
CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id ANYELEMENT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch_id_raw TEXT;
    v_grade TEXT;
    v_structure_id BIGINT;
    v_total_fee NUMERIC := 0;
    v_ledger_id UUID;
    v_input_cycle_id TEXT := p_academic_year_id::text;
    v_y_type TEXT;
    v_b_type TEXT;
BEGIN
    -- 1. Detect Environment Types
    SELECT data_type INTO v_y_type FROM information_schema.columns WHERE table_name = 'academic_years' AND column_name = 'id' LIMIT 1;
    SELECT data_type INTO v_b_type FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'id' LIMIT 1;

    -- 2. Fetch Student Analytics
    SELECT branch_id::text, grade INTO v_branch_id_raw, v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    
    -- 3. BULLETPROOF UPSERT: Captures ID safely even on concurrent conflict
    LOOP
        -- Try Update first to capture existing ID
        IF v_y_type = 'uuid' THEN
            UPDATE public.student_fee_ledger SET updated_at = NOW() 
            WHERE student_id = p_student_id AND academic_year_id = v_input_cycle_id::uuid
            RETURNING id INTO v_ledger_id;
        ELSE
            UPDATE public.student_fee_ledger SET updated_at = NOW() 
            WHERE student_id = p_student_id AND academic_year_id = v_input_cycle_id::bigint
            RETURNING id INTO v_ledger_id;
        END IF;

        EXIT WHEN v_ledger_id IS NOT NULL;

        -- Try Insert if not exists
        BEGIN
            INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, total_amount, status)
            VALUES (
                p_student_id, 
                CASE WHEN v_y_type = 'uuid' THEN v_input_cycle_id::uuid ELSE v_input_cycle_id::bigint END,
                CASE WHEN v_b_type = 'uuid' THEN v_branch_id_raw::uuid ELSE v_branch_id_raw::bigint END,
                0, 
                'ACTIVE'
            )
            RETURNING id INTO v_ledger_id;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            -- Do nothing, loop will pick it up on next update attempt
        END;
    END LOOP;

    -- 4. Calculate Fee Structure (Fuzzy Matching)
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE (academic_cycle_id::text = v_input_cycle_id)
    AND (status = 'Active' OR state = 'ACTIVE')
    AND (target_grade = v_grade OR target_grade = REPLACE(v_grade, 'Class ', ''))
    LIMIT 1;

    SELECT SUM(amount) INTO v_total_fee FROM public.fee_components WHERE structure_id = v_structure_id;

    -- 5. Finalize State
    UPDATE public.student_fee_ledger SET total_amount = COALESCE(v_total_fee, 0), updated_at = NOW() WHERE id = v_ledger_id;
    
    -- 6. Execute Installment Protocol
    PERFORM public.generate_installments(v_ledger_id);

    RETURN jsonb_build_object(
        'success', true, 
        'ledger_id', v_ledger_id, 
        'total_amount', COALESCE(v_total_fee, 0),
        'message', 'Ledger Synchronized Successfully.'
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Ledger Integrity Protocol Re-Initialized (v5.0).' as status;
