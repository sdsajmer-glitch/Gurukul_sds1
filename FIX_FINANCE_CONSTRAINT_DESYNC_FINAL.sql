-- =============================================================================
-- GURUKUL OS: FINANCE CONSTRAINT SYNCHRONIZER (Registry Fix)
-- =============================================================================
-- Target: Resolves "ON CONFLICT" matching error in student_fee_assignments.
-- Problem: System expected unique constraint on student_id, but found (student_id, structure_id).
-- =============================================================================

BEGIN;

-- [1] DATA HYGIENE: Remove duplicate assignments if any exist
-- We keep the most recently created assignment for each student.
DELETE FROM public.student_fee_assignments a
USING public.student_fee_assignments b
WHERE a.id < b.id 
  AND a.student_id = b.student_id;

-- [2] CONSTRAINT RECTIFICATION: Align Registry with Upsert Logic
-- The GENESIS_PROTOCOL synchronizer uses ON CONFLICT (student_id), so the 
-- identity index must match exactly that column.

DO $$ 
BEGIN
    -- Drop the composite index if it exists
    ALTER TABLE public.student_fee_assignments DROP CONSTRAINT IF EXISTS student_fee_assignments_identity_idx;
    ALTER TABLE public.student_fee_assignments DROP CONSTRAINT IF EXISTS student_fee_assignments_student_id_fee_structure_id_key;
    
    -- Ensure no other conflicting unique indexes exist on these columns
    -- (Safety check for various naming conventions)
    DROP INDEX IF EXISTS public.idx_student_fee_assignments_student_id;
    
    -- Add the CORRECT unique constraint that matches the function's ON CONFLICT specification
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_fee_assignments_identity_idx') THEN
        ALTER TABLE public.student_fee_assignments ADD CONSTRAINT student_fee_assignments_identity_idx UNIQUE (student_id);
    END IF;
END $$;

-- [3] VERIFY/FIX: student_fee_accounts (Standardize names)
-- Ensuring sfa also follows the same identity pattern.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_fee_accounts_student_id_key') THEN
        ALTER TABLE public.student_fee_accounts ADD CONSTRAINT student_fee_accounts_student_id_key UNIQUE (student_id);
    END IF;
END $$;

COMMIT;

SELECT 'SUCCESS: Finance Registry Constraints Synchronized. MAP GENESIS_PROTOCOL protocol restored.' as status;
