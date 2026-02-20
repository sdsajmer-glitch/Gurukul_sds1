-- =============================================================================
-- 🛠️ FINANCE V44: STRUCTURE SCHEMA HOTFIX 🛠️
-- =============================================================================
-- Date: 2026-02-20
-- Objective: Fix "Could not find 'updated_at' column" error in FeeStructureWizard.
-- =============================================================================

BEGIN;

DO $$
BEGIN
    -- 1. Ensure updated_at exists on finance_fee_structures
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'finance_fee_structures' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE public.finance_fee_structures ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at to finance_fee_structures';
    END IF;

    -- 2. Ensure created_at exists (as a safety measure)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'finance_fee_structures' 
                   AND column_name = 'created_at') THEN
        ALTER TABLE public.finance_fee_structures ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added created_at to finance_fee_structures';
    END IF;

    -- 3. Ensure updated_at exists on finance_fee_components (also often used)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'finance_fee_components' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE public.finance_fee_components ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at to finance_fee_components';
    END IF;

END $$;

COMMIT;

SELECT 'SUCCESS: Finance V44 Structure Hotfix deployed. updated_at columns synchronized.' AS status;
