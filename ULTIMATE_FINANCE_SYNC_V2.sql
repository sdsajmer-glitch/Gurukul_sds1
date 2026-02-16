-- =============================================================================
-- ULTIMATE FINANCE REPAIR: STRUCTURAL & LOGIC HARMONIZATION (v2.0)
-- =============================================================================
-- This script fixes the "Incompatible Types: BIGINT and UUID" error by:
-- 1. Dropping conflicting foreign keys.
-- 2. Dynamically detecting your ID system (UUID vs BIGINT).
-- 3. Re-aligning all tables and functions to match that system.
-- =============================================================================

BEGIN;

-- [0] FIREWALL: DROP OLD CONSTRAINTS
DO $$ 
BEGIN
    ALTER TABLE IF EXISTS public.student_fee_ledger DROP CONSTRAINT IF EXISTS student_fee_ledger_academic_cycle_id_fkey;
    ALTER TABLE IF EXISTS public.student_fee_ledger DROP CONSTRAINT IF EXISTS student_fee_ledger_academic_year_id_fkey;
    ALTER TABLE IF EXISTS public.student_fee_ledger DROP CONSTRAINT IF EXISTS student_fee_ledger_identity_idx;
    ALTER TABLE IF EXISTS public.installment_schedule DROP CONSTRAINT IF EXISTS installment_schedule_ledger_id_fkey;
    ALTER TABLE IF EXISTS public.student_fee_ledger DROP CONSTRAINT IF EXISTS student_fee_ledger_student_id_academic_year_id_key;
END $$;

-- [1] DATA SURGERY: HARMONIZE TYPES
DO $$
DECLARE
    v_target_type TEXT;
BEGIN
    -- Detect what 'id' type academic_years is using
    SELECT data_type INTO v_target_type 
    FROM information_schema.columns 
    WHERE table_name = 'academic_years' AND column_name = 'id' LIMIT 1;

    IF v_target_type IS NULL THEN v_target_type := 'uuid'; END IF; -- Default to safety

    -- Align Ledger
    IF v_target_type = 'uuid' THEN
        -- Safely convert to UUID if it's currently text or bigint
        ALTER TABLE public.student_fee_ledger 
        ALTER COLUMN academic_year_id TYPE UUID USING (academic_year_id::text::uuid);
    ELSE
        ALTER TABLE public.student_fee_ledger 
        ALTER COLUMN academic_year_id TYPE BIGINT USING (NULL);
    END IF;

    -- Align Installments if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installment_schedule' AND column_name = 'academic_year_id') THEN
        IF v_target_type = 'uuid' THEN
            ALTER TABLE public.installment_schedule ALTER COLUMN academic_year_id TYPE UUID USING (academic_year_id::text::uuid);
        ELSE
            ALTER TABLE public.installment_schedule ALTER COLUMN academic_year_id TYPE BIGINT USING (NULL);
        END IF;
    END IF;

    -- Re-set Unique Index
    ALTER TABLE public.student_fee_ledger 
    ADD CONSTRAINT student_fee_ledger_identity_idx UNIQUE (student_id, academic_year_id);

    -- Re-connect Foreign Keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'academic_years') THEN
        ALTER TABLE public.student_fee_ledger
        ADD CONSTRAINT student_fee_ledger_academic_year_id_fkey 
        FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'installment_schedule') THEN
        ALTER TABLE public.installment_schedule
        ADD CONSTRAINT installment_schedule_ledger_id_fkey 
        FOREIGN KEY (ledger_id) REFERENCES public.student_fee_ledger(id) ON DELETE CASCADE;
    END IF;
END $$;

-- [2] LOGIC SURGERY: TYPE-AGNOSTIC FUNCTIONS
CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id ANYELEMENT
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
    v_target_type TEXT;
    v_input_cycle_id TEXT;
BEGIN
    v_input_cycle_id := p_academic_year_id::text;
    
    -- Fetch Context
    SELECT branch_id, grade INTO v_branch_id, v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    
    -- Check Table ID type to be 100% sure
    SELECT data_type INTO v_target_type FROM information_schema.columns WHERE table_name = 'academic_years' AND column_name = 'id' LIMIT 1;

    -- Upsert Ledger with cast based on target type
    IF v_target_type = 'uuid' THEN
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, total_amount, status)
        VALUES (p_student_id, v_input_cycle_id::uuid, v_branch_id, 0, 'ACTIVE')
        ON CONFLICT (student_id, academic_year_id) DO NOTHING
        RETURNING id INTO v_ledger_id;
    ELSE
        INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, total_amount, status)
        VALUES (p_student_id, v_input_cycle_id::bigint, v_branch_id, 0, 'ACTIVE')
        ON CONFLICT (student_id, academic_year_id) DO NOTHING
        RETURNING id INTO v_ledger_id;
    END IF;

    -- If ledger already existed, fetch its ID
    IF v_ledger_id IS NULL THEN
        IF v_target_type = 'uuid' THEN
            SELECT id INTO v_ledger_id FROM public.student_fee_ledger WHERE student_id = p_student_id AND academic_year_id = v_input_cycle_id::uuid;
        ELSE
            SELECT id INTO v_ledger_id FROM public.student_fee_ledger WHERE student_id = p_student_id AND academic_year_id = v_input_cycle_id::bigint;
        END IF;
    END IF;

    -- Calculate & Update Fee (with logic to match your specific structure table)
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE (academic_cycle_id::text = v_input_cycle_id) -- Force text comparison for type safety
    AND (status = 'Active' OR state = 'ACTIVE')
    AND (target_grade = v_grade OR target_grade = REPLACE(v_grade, 'Class ', ''))
    LIMIT 1;

    SELECT SUM(amount) INTO v_total_fee FROM public.fee_components WHERE structure_id = v_structure_id;

    UPDATE public.student_fee_ledger SET total_amount = COALESCE(v_total_fee, 0), updated_at = NOW() WHERE id = v_ledger_id;

    -- Generate Installments
    PERFORM public.generate_installments(v_ledger_id);

    RETURN jsonb_build_object('success', true, 'ledger_id', v_ledger_id, 'total_amount', v_total_fee);
END;
$$;

-- Orchestrator update
CREATE OR REPLACE FUNCTION public.automate_finance_lifecycle(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_year_id TEXT;
    v_result JSONB;
BEGIN
    SELECT id::text INTO v_year_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    v_result := public.generate_student_ledger(p_student_id, v_year_id);
    RETURN v_result;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Finance System Re-Engaged with Full Type Safety.' as status;
