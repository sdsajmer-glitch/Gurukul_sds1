-- ==============================================================================
-- FIX: "No Unique Constraint" Error for admission_documents
-- ==============================================================================

-- 1. Remove potential duplicate records that would block the unique constraint
-- This keeps the most recently uploaded document for a given slot.
DELETE FROM public.admission_documents a USING public.admission_documents b
WHERE a.id < b.id
AND a.admission_id = b.admission_id
AND a.requirement_id = b.requirement_id;

-- 2. Create the missing Unique Index/Constraint
-- The 'ON CONFLICT (admission_id, requirement_id)' clause requires this specific unique index.
DROP INDEX IF EXISTS public.idx_admission_documents_unique_slot;

CREATE UNIQUE INDEX idx_admission_documents_unique_slot 
ON public.admission_documents (admission_id, requirement_id);

-- 3. Explicitly add the constraint (Standard practice)
ALTER TABLE public.admission_documents
DROP CONSTRAINT IF EXISTS admission_documents_admission_id_requirement_id_key;

ALTER TABLE public.admission_documents
ADD CONSTRAINT admission_documents_admission_id_requirement_id_key 
UNIQUE USING INDEX idx_admission_documents_unique_slot;

-- 4. Re-run Policy Check (Safety)
-- Ensure RLS is enabled
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;
