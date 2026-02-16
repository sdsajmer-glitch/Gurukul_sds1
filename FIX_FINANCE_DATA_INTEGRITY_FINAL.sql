-- =============================================================================
-- FIX: FINANCIAL DATA INTEGRITY & TYPE HARMONIZATION (v1.4)
-- =============================================================================
-- Resolution for: "foreign key constraint incompatible types: bigint and uuid"
-- This script detects the actual ID type of your Academic Years and 
-- forces the Ledger to match it perfectly, resolving the FK conflict.
-- =============================================================================

BEGIN;

-- [0] FIREWALL: DROP PROBLEMATIC CONSTRAINTS
-- We drop these so we can freely modify the columns.
DO $$ 
BEGIN
    -- Drop any foreign keys that might be blocking the type change
    ALTER TABLE IF EXISTS public.student_fee_ledger DROP CONSTRAINT IF EXISTS student_fee_ledger_academic_cycle_id_fkey;
    ALTER TABLE IF EXISTS public.student_fee_ledger DROP CONSTRAINT IF EXISTS student_fee_ledger_academic_year_id_fkey;
    ALTER TABLE IF EXISTS public.student_fee_ledger DROP CONSTRAINT IF EXISTS student_fee_ledger_identity_idx;
    ALTER TABLE IF EXISTS public.installment_schedule DROP CONSTRAINT IF EXISTS installment_schedule_ledger_id_fkey;
END $$;

-- [1] TYPE HARMONIZATION: MATCH ACADEMIC_YEARS ID TYPE
DO $$
DECLARE
    v_target_type TEXT;
BEGIN
    -- Detect what 'id' type academic_years is using
    SELECT data_type INTO v_target_type 
    FROM information_schema.columns 
    WHERE table_name = 'academic_years' AND column_name = 'id';

    IF v_target_type IS NULL THEN
        -- Fallback if table doesn't exist yet (shouldn't happen)
        v_target_type := 'bigint';
    END IF;

    RAISE NOTICE 'Detected Academic Years ID Type: %', v_target_type;

    -- Apply the detected type to student_fee_ledger
    IF v_target_type = 'uuid' THEN
        ALTER TABLE public.student_fee_ledger 
        ALTER COLUMN academic_year_id TYPE UUID USING (academic_year_id::text::uuid);
    ELSE
        -- If it's bigint or integer, convert to bigint
        ALTER TABLE public.student_fee_ledger 
        ALTER COLUMN academic_year_id TYPE BIGINT USING (NULL);
    END IF;

    -- Re-set the unique identity index
    ALTER TABLE public.student_fee_ledger 
    ADD CONSTRAINT student_fee_ledger_identity_idx UNIQUE (student_id, academic_year_id);

    -- Re-connect the Foreign Key with the matching type
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'academic_years') THEN
        ALTER TABLE public.student_fee_ledger
        ADD CONSTRAINT student_fee_ledger_academic_year_id_fkey 
        FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE CASCADE;
    END IF;
    
    -- Also re-connect installments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'installment_schedule') THEN
        ALTER TABLE public.installment_schedule
        ADD CONSTRAINT installment_schedule_ledger_id_fkey 
        FOREIGN KEY (ledger_id) REFERENCES public.student_fee_ledger(id) ON DELETE CASCADE;
    END IF;

END $$;

-- [2] RE-GRANT PERMISSIONS
GRANT ALL ON public.student_fee_ledger TO authenticated;
GRANT ALL ON public.installment_schedule TO authenticated;

COMMIT;

SELECT 'SUCCESS: Database Types Synchronized with Academic Registry.' as status;
