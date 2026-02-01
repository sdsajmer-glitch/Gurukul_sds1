-- ==============================================================================
-- FIX: INFINITE RECURSION IN RLS POLICIES & BACKFILL OWNERSHIP
-- ==============================================================================
-- 1. Drops recursive RLS policies immediately.
-- 2. Backfills 'created_by' column for existing codes (critical for legacy support).
-- 3. Re-enables strict, non-recursive policies.

BEGIN;

-- --------------------------------------------------------------------------------
-- STEP 1: REMOVE RECURSIVE POLICIES
-- --------------------------------------------------------------------------------
-- We drop these first to ensure the UPDATE statements below don't trigger the loop.

DROP POLICY IF EXISTS "Users can view own created codes" ON public.admission_share_codes;
DROP POLICY IF EXISTS "Users can view their codes" ON public.admission_share_codes;
DROP POLICY IF EXISTS "Users can update own created codes" ON public.admission_share_codes;

DROP POLICY IF EXISTS "Users can view own enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Parents can view their own enquiries" ON public.enquiries;

-- --------------------------------------------------------------------------------
-- STEP 2: BACKFILL 'CREATED_BY' (For Legacy Data)
-- --------------------------------------------------------------------------------
-- Existing share codes might have NULL created_by. We populate this from the linked entities.

UPDATE public.admission_share_codes sc
SET created_by = e.user_id
FROM public.enquiries e
WHERE sc.enquiry_id = e.id
AND sc.created_by IS NULL;

UPDATE public.admission_share_codes sc
SET created_by = a.parent_id
FROM public.admissions a
WHERE sc.admission_id = a.id
AND sc.created_by IS NULL;

-- --------------------------------------------------------------------------------
-- STEP 3: INSTALL CLEAN POLICIES
-- --------------------------------------------------------------------------------

-- A. Share Codes Check: Only allow access if 'created_by' matches user. 
-- No subqueries to enquiries/admissions to prevent future loops.
CREATE POLICY "Users can view own created codes" 
ON public.admission_share_codes FOR SELECT 
TO authenticated 
USING (created_by = auth.uid());

CREATE POLICY "Users can update own created codes" 
ON public.admission_share_codes FOR UPDATE 
TO authenticated 
USING (created_by = auth.uid());

-- B. Enquiries Check: Standard ownership checks only.
CREATE POLICY "Users can view own enquiries" ON public.enquiries
  FOR SELECT USING (
    user_id = auth.uid() 
    OR parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    OR parent_email = (SELECT auth.jwt() ->> 'email')
  );

COMMIT;
