-- ==============================================================================
-- FIX INSTALLMENT SCHEDULE SCHEMA
-- ==============================================================================
-- Diagnostic: The installment_schedule table is missing the 'paid_amount' column
-- which is required by V13 finance logic. This script patches the schema.
-- ==============================================================================

BEGIN;

-- 1. Ensure public.installment_schedule has the required columns
CREATE TABLE IF NOT EXISTS public.installment_schedule (
    id BIGSERIAL PRIMARY KEY,
    ledger_id UUID NOT NULL,
    student_id UUID, -- Optional denormalization
    installment_no INT NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add 'paid_amount' if it is missing (Safe Alter)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'installment_schedule' 
        AND column_name = 'paid_amount'
    ) THEN
        ALTER TABLE public.installment_schedule ADD COLUMN paid_amount NUMERIC DEFAULT 0;
    END IF;
END $$;

-- 3. Ensure 'amount' exists (Just in case)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'installment_schedule' 
        AND column_name = 'amount'
    ) THEN
        ALTER TABLE public.installment_schedule ADD COLUMN amount NUMERIC DEFAULT 0;
    END IF;
END $$;

COMMIT;

SELECT 'SUCCESS: installment_schedule schema patched.' as status;
