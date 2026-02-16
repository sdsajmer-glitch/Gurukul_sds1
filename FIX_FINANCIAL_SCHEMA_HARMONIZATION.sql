-- =============================================================================
-- FIX: FINANCIAL SCHEMA HARMONIZATION (v1.2)
-- =============================================================================
-- Resolution for: "column academic_year_id of relation student_fee_ledger does not exist"
-- This script ensures that the student_fee_ledger table structure matches the 
-- latest Security Policy (v10.0) requirements.
-- =============================================================================

BEGIN;

-- [0] DATA SURGERY: HARMONIZE student_fee_ledger
DO $$ 
BEGIN
    -- 1. Create the table if it doesn't exist at all
    CREATE TABLE IF NOT EXISTS public.student_fee_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL,
        academic_year_id BIGINT,
        branch_id BIGINT,
        total_amount NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(student_id, academic_year_id)
    );

    -- 2. If 'academic_cycle_id' exists instead of 'academic_year_id', rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_ledger' AND column_name = 'academic_cycle_id') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_ledger' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.student_fee_ledger RENAME COLUMN academic_cycle_id TO academic_year_id;
    END IF;

    -- 3. Ensure 'academic_year_id' exists if it was somehow skipped
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_ledger' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.student_fee_ledger ADD COLUMN academic_year_id BIGINT;
    END IF;

    -- 4. Re-establish Unique Constraint (Security Policy Requirement)
    -- Drop old one if it uses cycle_id
    ALTER TABLE public.student_fee_ledger DROP CONSTRAINT IF EXISTS student_fee_ledger_student_id_academic_cycle_id_key;
    ALTER TABLE public.student_fee_ledger DROP CONSTRAINT IF EXISTS student_fee_ledger_student_id_academic_year_id_key;
    
    -- Add the correct one
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_fee_ledger_identity_idx') THEN
        ALTER TABLE public.student_fee_ledger ADD CONSTRAINT student_fee_ledger_identity_idx UNIQUE (student_id, academic_year_id);
    END IF;
END $$;

-- [1] HARMONIZE installment_schedule
DO $$
BEGIN
    -- If 'cycle_id' exists instead of 'academic_year_id' in related tables or helper denormalization
    -- (installment_schedule doesn't have it in the base definition but some scripts added it)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'installment_schedule') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installment_schedule' AND column_name = 'cycle_id') THEN
             ALTER TABLE public.installment_schedule RENAME COLUMN cycle_id TO academic_year_id;
        END IF;
    END IF;
END $$;

-- [2] RE-GRANT PERMISSIONS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_fee_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_schedule TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_audit_logs TO authenticated;

COMMIT;
