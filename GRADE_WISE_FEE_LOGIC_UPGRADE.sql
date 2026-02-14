-- ==============================================================================
-- GRADE-WISE FEE STRUCTURE: ENTERPRISE LOGIC UPGRADE (V2)
-- ==============================================================================
-- Description: Upgrades legacy fee_structures to support Enterprise State Machine,
--              Versioning, and Automated Ledger Generation.
-- ==============================================================================

BEGIN;

-- [1] EXTENDING THE CORE FEE STRUCTURE PROTOCOL
-- Purpose: Support State Machine, Versioning, and Academic Cycle IDs.

ALTER TABLE public.fee_structures 
ADD COLUMN IF NOT EXISTS state TEXT CHECK (state IN ('DRAFT', 'VALIDATED', 'ACTIVE', 'LOCKED', 'ARCHIVED')) DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS version_label TEXT DEFAULT 'v1.0',
ADD COLUMN IF NOT EXISTS is_active_version BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validation_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS academic_cycle_id BIGINT REFERENCES public.academic_years(id),
ADD COLUMN IF NOT EXISTS integrity_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS projected_revenue NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_exposure_percent INTEGER DEFAULT 0;

-- Migrate existing status to state where possible
UPDATE public.fee_structures SET state = 'ACTIVE' WHERE status = 'Active' AND state = 'DRAFT';
UPDATE public.fee_structures SET state = 'DRAFT' WHERE status = 'Draft' AND state = 'DRAFT';

-- [2] VALIDATION ENGINE: INSTITUTIONAL COMPLIANCE CHECK
-- Purpose: Prevent activation of templates that don't meet foundational requirements.

CREATE OR REPLACE FUNCTION public.fn_validate_institutional_fee_structure(p_structure_id BIGINT)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    v_structure RECORD;
    v_has_components BOOLEAN;
    v_missing_nodes TEXT[] := ARRAY[]::TEXT[];
    v_is_valid BOOLEAN := TRUE;
    v_revenue NUMERIC(15,2) := 0;
BEGIN
    SELECT * INTO v_structure FROM public.fee_structures WHERE id = p_structure_id;

    -- 1. Check Fundamental Components
    SELECT EXISTS(SELECT 1 FROM public.fee_components WHERE structure_id = p_structure_id) INTO v_has_components;
    IF NOT v_has_components THEN 
        v_missing_nodes := array_append(v_missing_nodes, 'Fee Components (Base Tuition, etc.)'); 
        v_is_valid := FALSE;
    END IF;

    -- 2. Check Academic Cycle Binding
    IF v_structure.academic_cycle_id IS NULL THEN
        v_missing_nodes := array_append(v_missing_nodes, 'Active Academic Cycle Mapping');
        v_is_valid := FALSE;
    END IF;

    -- 3. Calculate Projected Revenue (Simulation)
    -- Formula: (Total Component Sum) * (Students in target grade)
    SELECT SUM(amount) INTO v_revenue FROM public.fee_components WHERE structure_id = p_structure_id;
    
    -- Update Metadata
    UPDATE public.fee_structures 
    SET state = CASE WHEN v_is_valid THEN 'VALIDATED'::text ELSE 'DRAFT'::text END,
        validation_metadata = jsonb_build_object(
            'is_valid', v_is_valid,
            'missing_nodes', v_missing_nodes,
            'simulated_revenue', v_revenue,
            'checked_at', NOW()
        ),
        projected_revenue = COALESCE(v_revenue, 0),
        last_validated_at = NOW()
    WHERE id = p_structure_id;

    RETURN jsonb_build_object('success', v_is_valid, 'missing', v_missing_nodes, 'projected_revenue', v_revenue);
END;
$$;

-- [3] AUTOMATED LEDGER GENERATOR (OPERATIONAL ENGINE)
-- Purpose: Atomic generation of student accounts based on institutional protocols.

CREATE OR REPLACE FUNCTION public.fn_generate_student_ledgers_v2(p_structure_id BIGINT)
RETURNS INTEGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    v_struct RECORD;
    v_student RECORD;
    v_total_amount NUMERIC(15,2);
    v_count INTEGER := 0;
BEGIN
    SELECT * INTO v_struct FROM public.fee_structures WHERE id = p_structure_id;
    SELECT SUM(amount) INTO v_total_amount FROM public.fee_components WHERE structure_id = p_structure_id;

    -- Target Students: Active students in the mapped grade who don't have a ledger for this cycle
    FOR v_student IN 
        SELECT user_id, branch_id 
        FROM public.student_profiles 
        WHERE grade::text = v_struct.target_grade::text
        AND enrollment_status = 'Enrolled'
        AND is_active = true
        AND NOT EXISTS (
            -- This check is cycle-based (legacy check was structure-based)
            -- We'll use student_fee_accounts if it exists, or finance_student_fee_ledger
            SELECT 1 FROM public.finance_student_fee_ledger 
            WHERE student_id = user_id 
            AND academic_cycle_id = v_struct.academic_cycle_id
        )
    LOOP
        -- Insert into enterprise ledger (Unified Billing Node)
        INSERT INTO public.finance_student_fee_ledger (
            branch_id, academic_cycle_id, student_id, fee_template_id, 
            total_amount, net_amount, status
        )
        VALUES (
            v_struct.branch_id, v_struct.academic_cycle_id, v_student.user_id, NULL, -- mapping is grade-based now
            v_total_amount, v_total_amount, 'active'
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- [4] ACTIVATION COMMAND
-- Purpose: Transitions a structure to ACTIVE state and triggers mass billing.

CREATE OR REPLACE FUNCTION public.fn_activate_institutional_protocol(p_structure_id BIGINT)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    v_validation JSONB;
    v_batch_count INTEGER;
    v_branch_id BIGINT;
    v_grade TEXT;
    v_cycle_id BIGINT;
BEGIN
    SELECT branch_id, target_grade, academic_cycle_id INTO v_branch_id, v_grade, v_cycle_id 
    FROM public.fee_structures WHERE id = p_structure_id;

    -- 1. Enterprise Validation Check
    SELECT public.fn_validate_institutional_fee_structure(p_structure_id) INTO v_validation;
    
    IF NOT (v_validation->>'success')::BOOLEAN THEN
        RETURN v_validation;
    END IF;

    -- 2. Enforce "One Active Template Per Grade Per Cycle" Policy
    UPDATE public.fee_structures 
    SET state = 'ARCHIVED',
        is_active_version = FALSE,
        is_active = FALSE
    WHERE branch_id = v_branch_id 
    AND target_grade = v_grade 
    AND academic_cycle_id = v_cycle_id
    AND id <> p_structure_id;

    -- 3. Promote to ACTIVE State
    UPDATE public.fee_structures 
    SET state = 'ACTIVE',
        is_active = TRUE,
        is_active_version = TRUE,
        updated_at = NOW()
    WHERE id = p_structure_id;

    -- 4. Trigger Mass Ledger Generation
    SELECT public.fn_generate_student_ledgers_v2(p_structure_id) INTO v_batch_count;

    RETURN jsonb_build_object(
        'success', true,
        'final_state', 'ACTIVE',
        'operational_ledgers_created', v_batch_count,
        'policy_enforced', 'SINGLE_ACTIVE_NODE_PER_GRADE'
    );
END;
$$;

COMMIT;
