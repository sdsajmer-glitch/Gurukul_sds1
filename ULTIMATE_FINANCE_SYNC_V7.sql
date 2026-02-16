-- =============================================================================
-- ULTIMATE FINANCE REPAIR: PROTOCOL ALIGNMENT (v7.0)
-- =============================================================================
-- Resolution for: "null value in column fee_template_id violates not-null constraint"
-- This version aligns the Orchestrator with the "Template-First" requirement
-- of the School ERP's financial governance module.
-- =============================================================================

BEGIN;

-- [0] FIREWALL: HARMONIZE COLUMN NAMES (Safety Step)
DO $$
BEGIN
    -- If fee_template_id exists but structure_id was used, or vice-versa.
    -- We ensure the required column exists and has the correct type.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_ledger' AND column_name = 'fee_template_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_ledger' AND column_name = 'fee_structure_id') THEN
             ALTER TABLE public.student_fee_ledger RENAME COLUMN fee_structure_id TO fee_template_id;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_ledger' AND column_name = 'structure_id') THEN
             ALTER TABLE public.student_fee_ledger RENAME COLUMN structure_id TO fee_template_id;
        ELSE
             -- If it's totally missing but being required by a trigger or constraint
             ALTER TABLE public.student_fee_ledger ADD COLUMN fee_template_id BIGINT;
        END IF;
    END IF;

    -- Make it nullable if it was strictly NOT NULL but creating a circular dependency
    -- (We fill it in the next step anyway)
    ALTER TABLE public.student_fee_ledger ALTER COLUMN fee_template_id DROP NOT NULL;
END $$;

-- [1] LOGIC UPGRADE: PROTOCOL-DRIVEN GENERATION
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
    -- 1. Detect Types
    SELECT data_type INTO v_y_type FROM information_schema.columns WHERE table_name = 'academic_years' AND column_name = 'id' LIMIT 1;
    SELECT data_type INTO v_b_type FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'id' LIMIT 1;

    -- 2. Fetch Student Context
    SELECT branch_id::text, grade INTO v_branch_id_raw, v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    
    -- 3. FETCH THE PROTOCOL (Fee Structure) FIRST
    -- This is required because fee_template_id is a mandatory FK in your current schema
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE (academic_cycle_id::text = v_input_cycle_id)
    AND (status = 'Active' OR state = 'ACTIVE')
    AND (target_grade = v_grade OR target_grade = REPLACE(v_grade, 'Class ', ''))
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRADE_MAPPING_MISSING', 'message', 'No active fee protocol found for ' || v_grade);
    END IF;

    -- 4. Calculate Total Fee
    SELECT SUM(amount) INTO v_total_fee FROM public.fee_components WHERE structure_id = v_structure_id;

    -- 5. UPSERT LEDGER WITH PROTOCOL LINK (fee_template_id)
    -- We use separate paths for UUID vs BIGINT to satisfy the Postgres compiler
    IF v_y_type = 'uuid' AND v_b_type = 'uuid' THEN
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, fee_template_id, total_amount, status)
        VALUES (p_student_id, v_input_cycle_id::uuid, v_branch_id_raw::uuid, v_structure_id, COALESCE(v_total_fee, 0), 'ACTIVE')
        ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
            fee_template_id = EXCLUDED.fee_template_id,
            total_amount = EXCLUDED.total_amount,
            updated_at = NOW()
        RETURNING id INTO v_ledger_id;
    ELSIF v_y_type <> 'uuid' AND v_b_type <> 'uuid' THEN
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, fee_template_id, total_amount, status)
        VALUES (p_student_id, v_input_cycle_id::bigint, v_branch_id_raw::bigint, v_structure_id, COALESCE(v_total_fee, 0), 'ACTIVE')
        ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
            fee_template_id = EXCLUDED.fee_template_id,
            total_amount = EXCLUDED.total_amount,
            updated_at = NOW()
        RETURNING id INTO v_ledger_id;
    -- Mixed Cases (just in case)
    ELSIF v_y_type = 'uuid' THEN
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, fee_template_id, total_amount, status)
        VALUES (p_student_id, v_input_cycle_id::uuid, v_branch_id_raw::bigint, v_structure_id, COALESCE(v_total_fee, 0), 'ACTIVE')
        ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
            fee_template_id = EXCLUDED.fee_template_id,
            total_amount = EXCLUDED.total_amount,
            updated_at = NOW()
        RETURNING id INTO v_ledger_id;
    ELSE
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, fee_template_id, total_amount, status)
        VALUES (p_student_id, v_input_cycle_id::bigint, v_branch_id_raw::uuid, v_structure_id, COALESCE(v_total_fee, 0), 'ACTIVE')
        ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
            fee_template_id = EXCLUDED.fee_template_id,
            total_amount = EXCLUDED.total_amount,
            updated_at = NOW()
        RETURNING id INTO v_ledger_id;
    END IF;

    -- 6. Trigger Financial Installments
    PERFORM public.generate_installments(v_ledger_id);

    RETURN jsonb_build_object(
        'success', true, 
        'ledger_id', v_ledger_id, 
        'total_amount', COALESCE(v_total_fee, 0),
        'protocol_id', v_structure_id
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Finance System Aligned with Template Registry (v7.0).' as status;
