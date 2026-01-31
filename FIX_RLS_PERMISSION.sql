-- ============================================
-- FIX PERMISSION DENIED ERROR
-- The previous RLS policy tried to access auth.users directly, which is forbidden.
-- This script fixes it by using public.profiles instead.
-- ============================================

-- 1. Drop the problematic admission policies
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON public.admissions;
DROP POLICY IF EXISTS "Allow Parents Select Own" ON public.admissions;

-- 2. Create the CORRECT select policy (Using public.profiles instead of auth.users)
CREATE POLICY "Parents can view their own children"
ON public.admissions FOR SELECT
TO authenticated
USING (
  auth.uid() = parent_id 
  OR 
  parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- 3. Ensure INSERT policy is still correct
DROP POLICY IF EXISTS "Parents can insert their own children" ON public.admissions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.admissions;
DROP POLICY IF EXISTS "Allow All Authenticated Inserts" ON public.admissions;

CREATE POLICY "Parents can insert their own children"
ON public.admissions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = parent_id
);

-- 4. Storage Policy Fix (Just in case)
-- Ensure storage policies don't reference auth.users unnecessarily
-- (The previously provided storage policies were safe, but just to be sure)

SELECT 'SUCCESS: RLS Permission violation fixed. Please reload and try again.' as status;
