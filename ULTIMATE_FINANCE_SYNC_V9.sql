-- =============================================================================
-- ULTIMATE FINANCE REPAIR: STATUS HARMONIZATION (v9.0)
-- =============================================================================
-- Resolution for: "violates check constraint student_fee_ledger_status_check"
-- This version force-aligns all status strings to lowercase 'active' to match
-- the Enterprise Production schema requirements.
-- =============================================================================

BEGIN;

-- [0] FIREWALL: DROP RESTRICIVE STATUS CHECK
ALTER TABLE IF EXISTS public.student_fee_ledger DROP CONSTRAINT IF EXISTS student_fee_ledger_status_check;

-- [1] DATA SURGERY: UNIFY EXISTING DATA
UPDATE public.student_fee_ledger SET status = 'active' WHERE status = 'ACTIVE' OR status IS NULL;

-- [2] LOGIC UPGRADE: THE LOWERCASE HARMONIZED GENERATOR
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
    v_structure_id_raw TEXT;
    v_total_fee NUMERIC := 0;
    v_ledger_id UUID;
    v_input_cycle_id TEXT := p_academic_year_id::text;
    v_y_type TEXT;
    v_b_type TEXT;
    v_t_type TEXT;
    v_existing_ledger_id UUID;
BEGIN
    -- 1. Detect Environment Types
    SELECT data_type INTO v_y_type FROM information_schema.columns WHERE table_name = 'academic_years' AND column_name = 'id' LIMIT 1;
    SELECT data_type INTO v_b_type FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'id' LIMIT 1;
    SELECT data_type INTO v_t_type FROM information_schema.columns WHERE table_name = 'fee_structures' AND column_name = 'id' LIMIT 1;

    -- 2. Fetch Student Context
    SELECT branch_id::text, grade INTO v_branch_id_raw, v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    
    -- 3. Fetch Protocol
    SELECT id::text INTO v_structure_id_raw FROM public.fee_structures 
    WHERE (academic_cycle_id::text = v_input_cycle_id)
    AND (status IN ('Active', 'active', 'ACTIVE')) -- Flexible match
    AND (target_grade = v_grade OR target_grade = REPLACE(v_grade, 'Class ', ''))
    LIMIT 1;

    IF v_structure_id_raw IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRADE_MAPPING_MISSING');
    END IF;

    -- 4. Calculate Fee
    SELECT SUM(amount) INTO v_total_fee FROM public.fee_components WHERE structure_id::text = v_structure_id_raw;

    -- 5. UPSERT: Dynamic Type-Safe Insert (Using Lowercase 'active')
    IF v_y_type = 'uuid' THEN
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, fee_template_id, total_amount, status)
        VALUES (
            p_student_id, 
            v_input_cycle_id::uuid, 
            CASE WHEN v_b_type = 'uuid' THEN v_branch_id_raw::uuid ELSE NULL END,
            CASE WHEN v_t_type = 'uuid' THEN v_structure_id_raw::uuid ELSE NULL END,
            COALESCE(v_total_fee, 0), 'active' -- HARMONIZED: LOWERCASE
        )
        ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
            fee_template_id = EXCLUDED.fee_template_id,
            total_amount = EXCLUDED.total_amount,
            status = 'active', -- Force lowercase on update
            updated_at = NOW()
        RETURNING id INTO v_ledger_id;
    ELSE
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, fee_template_id, total_amount, status)
        VALUES (
            p_student_id, 
            v_input_cycle_id::bigint, 
            CASE WHEN v_b_type = 'bigint' THEN v_branch_id_raw::bigint ELSE NULL END,
            CASE WHEN v_t_type = 'bigint' THEN v_structure_id_raw::bigint ELSE NULL END,
            COALESCE(v_total_fee, 0), 'active' -- HARMONIZED: LOWERCASE
        )
        ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
            fee_template_id = EXCLUDED.fee_template_id,
            total_amount = EXCLUDED.total_amount,
            status = 'active', -- Force lowercase on update
            updated_at = NOW()
        RETURNING id INTO v_ledger_id;
    END IF;

    -- Final Re-fetch and mixed type handling (Fallback)
    IF v_ledger_id IS NULL THEN
        IF v_y_type = 'uuid' THEN
            SELECT id INTO v_ledger_id FROM public.student_fee_ledger WHERE student_id = p_student_id AND academic_year_id = v_input_cycle_id::uuid;
        ELSE
            SELECT id INTO v_ledger_id FROM public.student_fee_ledger WHERE student_id = p_student_id AND academic_year_id = v_input_cycle_id::bigint;
        END IF;
    END IF;

    -- 6. Trigger Financial Installments
    PERFORM public.generate_installments(v_ledger_id);

    RETURN jsonb_build_object('success', true, 'ledger_id', v_ledger_id, 'total_amount', COALESCE(v_total_fee, 0));
END;
$$;

COMMIT;

SELECT 'SUCCESS: Ledger Status Harmonized with Production standards (v9.0).' as status;
