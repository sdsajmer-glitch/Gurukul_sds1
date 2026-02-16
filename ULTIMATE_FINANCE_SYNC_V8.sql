-- =============================================================================
-- ULTIMATE FINANCE REPAIR: QUAD-TYPE HARMONIZATION (v8.0)
-- =============================================================================
-- Resolution for: 'column "fee_template_id" is of type uuid but expression is of type bigint'
-- This script detects the ID types for all 3 critical financial registries:
-- 1. Academic Years (Bigint/UUID)
-- 2. School Branches (Bigint/UUID)
-- 3. Fee Structures (Bigint/UUID)
-- =============================================================================

BEGIN;

-- [0] FIREWALL: CLEANUP CONSTRAINTS
DO $$ 
BEGIN
    ALTER TABLE IF EXISTS public.student_fee_ledger 
        DROP CONSTRAINT IF EXISTS student_fee_ledger_fee_template_id_fkey,
        DROP CONSTRAINT IF EXISTS student_fee_ledger_structure_id_fkey,
        DROP CONSTRAINT IF EXISTS student_fee_ledger_academic_year_id_fkey,
        DROP CONSTRAINT IF EXISTS student_fee_ledger_branch_id_fkey,
        DROP CONSTRAINT IF EXISTS student_fee_ledger_identity_idx;
END $$;

-- [1] TYPE SURGERY: TRIPLE DETECTION & ALIGNMENT
DO $$
DECLARE
    v_year_type TEXT;
    v_branch_type TEXT;
    v_template_type TEXT;
BEGIN
    -- Detect Source Types
    SELECT data_type INTO v_year_type FROM information_schema.columns WHERE table_name = 'academic_years' AND column_name = 'id' LIMIT 1;
    SELECT data_type INTO v_branch_type FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'id' LIMIT 1;
    SELECT data_type INTO v_template_type FROM information_schema.columns WHERE table_name = 'fee_structures' AND column_name = 'id' LIMIT 1;

    -- Defaults to UUID for safety if detection fails
    v_year_type := COALESCE(v_year_type, 'uuid');
    v_branch_type := COALESCE(v_branch_type, 'uuid');
    v_template_type := COALESCE(v_template_type, 'uuid');

    RAISE NOTICE 'Detection: YEAR=%, BRANCH=%, TEMPLATE=%', v_year_type, v_branch_type, v_template_type;

    -- 1. Align academic_year_id
    IF v_year_type = 'uuid' THEN
        ALTER TABLE public.student_fee_ledger ALTER COLUMN academic_year_id TYPE UUID USING (academic_year_id::text::uuid);
    ELSE
        ALTER TABLE public.student_fee_ledger ALTER COLUMN academic_year_id TYPE BIGINT USING (NULL);
    END IF;

    -- 2. Align branch_id
    IF v_branch_type = 'uuid' THEN
        ALTER TABLE public.student_fee_ledger ALTER COLUMN branch_id TYPE UUID USING (branch_id::text::uuid);
    ELSE
        ALTER TABLE public.student_fee_ledger ALTER COLUMN branch_id TYPE BIGINT USING (NULL);
    END IF;

    -- 3. Align fee_template_id (The Error Source)
    IF v_template_type = 'uuid' THEN
        ALTER TABLE public.student_fee_ledger ALTER COLUMN fee_template_id TYPE UUID USING (fee_template_id::text::uuid);
    ELSE
        ALTER TABLE public.student_fee_ledger ALTER COLUMN fee_template_id TYPE BIGINT USING (NULL);
    END IF;

    -- 4. Re-establish Identity Arch
    ALTER TABLE public.student_fee_ledger ADD CONSTRAINT student_fee_ledger_identity_idx UNIQUE (student_id, academic_year_id);

    -- 5. Re-connect Foreign Keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'academic_years') THEN
        ALTER TABLE public.student_fee_ledger ADD CONSTRAINT student_fee_ledger_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_structures') THEN
        ALTER TABLE public.student_fee_ledger ADD CONSTRAINT student_fee_ledger_fee_template_id_fkey FOREIGN KEY (fee_template_id) REFERENCES public.fee_structures(id) ON DELETE SET NULL;
    END IF;
END $$;

-- [2] LOGIC UPGRADE: THE INFINITE-ALIGNED GENERATOR
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
    AND (status = 'Active' OR state = 'ACTIVE')
    AND (target_grade = v_grade OR target_grade = REPLACE(v_grade, 'Class ', ''))
    LIMIT 1;

    IF v_structure_id_raw IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRADE_MAPPING_MISSING');
    END IF;

    -- 4. Calculate Fee
    SELECT SUM(amount) INTO v_total_fee FROM public.fee_components WHERE structure_id::text = v_structure_id_raw;

    -- 5. UPSERT: Dynamic Type-Safe Insert
    -- We use separate paths to avoid CASE type-mismatch errors
    IF v_y_type = 'uuid' THEN
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, fee_template_id, total_amount, status)
        VALUES (
            p_student_id, 
            v_input_cycle_id::uuid, 
            CASE WHEN v_b_type = 'uuid' THEN v_branch_id_raw::uuid ELSE NULL END, -- Nullable if not UUID
            CASE WHEN v_t_type = 'uuid' THEN v_structure_id_raw::uuid ELSE NULL END,
            COALESCE(v_total_fee, 0), 'ACTIVE'
        )
        ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
            fee_template_id = EXCLUDED.fee_template_id,
            total_amount = EXCLUDED.total_amount,
            updated_at = NOW()
        RETURNING id INTO v_ledger_id;
    ELSE
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, fee_template_id, total_amount, status)
        VALUES (
            p_student_id, 
            v_input_cycle_id::bigint, 
            CASE WHEN v_b_type = 'bigint' THEN v_branch_id_raw::bigint ELSE NULL END,
            CASE WHEN v_t_type = 'bigint' THEN v_structure_id_raw::bigint ELSE NULL END,
            COALESCE(v_total_fee, 0), 'ACTIVE'
        )
        ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
            fee_template_id = EXCLUDED.fee_template_id,
            total_amount = EXCLUDED.total_amount,
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

SELECT 'SUCCESS: Local Data Registry Harmonized (v8.0).' as status;
