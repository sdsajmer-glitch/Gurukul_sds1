-- ==============================================================================
-- ROBUST FIX: ADMISSIONS RLS (ROW LEVEL SECURITY)
-- ==============================================================================
-- This script clears all existing policies and sets up a robust, multi-identity
-- policy for the 'admissions' table to allow registration from any authenticated
-- context while preserving security.

BEGIN;

-- 1. Ensure RLS is active
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;

-- 2. Comprehensive cleanup of all potential policy names
DROP POLICY IF EXISTS "Admissions INSERT for Parents" ON public.admissions;
DROP POLICY IF EXISTS "Admissions SELECT for Parents" ON public.admissions;
DROP POLICY IF EXISTS "Admissions UPDATE for Parents" ON public.admissions;
DROP POLICY IF EXISTS "Admissions SELECT for Staff" ON public.admissions;
DROP POLICY IF EXISTS "Admissions UPDATE for Staff" ON public.admissions;
DROP POLICY IF EXISTS "Admissions Service Role Bypass" ON public.admissions;
DROP POLICY IF EXISTS "Parents can insert their own children" ON public.admissions;
DROP POLICY IF EXISTS "Parents can view their own children" ON public.admissions;
DROP POLICY IF EXISTS "Parents can update their own children" ON public.admissions;
DROP POLICY IF EXISTS "Staff can view all admissions" ON public.admissions;
DROP POLICY IF EXISTS "Staff can update all admissions" ON public.admissions;
DROP POLICY IF EXISTS "Parents can create admissions" ON public.admissions;
DROP POLICY IF EXISTS "Parents can view own admissions" ON public.admissions;
DROP POLICY IF EXISTS "Parents can update own admissions" ON public.admissions;
DROP POLICY IF EXISTS "School Admins can view branch admissions" ON public.admissions;
DROP POLICY IF EXISTS "School Admins can update branch admissions" ON public.admissions;

-- 3. CREATE ROBUST POLICIES

-- INSERT: Allow any authenticated user to register a child IF they set themselves as the parent.
-- This works for both regular Parents AND School Admins operating in Parent context.
CREATE POLICY "Enable insert for authenticated users as parent"
ON public.admissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = parent_id
);

-- SELECT: Allow users to see records where they are the parent OR it matches their email.
CREATE POLICY "Enable select for users based on parent_id or email"
ON public.admissions
FOR SELECT
TO authenticated
USING (
  auth.uid() = parent_id 
  OR 
  parent_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- UPDATE: Allow parents to update their own records.
CREATE POLICY "Enable update for parents"
ON public.admissions
FOR UPDATE
TO authenticated
USING (auth.uid() = parent_id)
WITH CHECK (auth.uid() = parent_id);

-- STAFF: Global access for administrative roles
CREATE POLICY "Enable select for staff roles"
ON public.admissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Teacher')
  )
);

CREATE POLICY "Enable update for staff roles"
ON public.admissions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('School Administration', 'Branch Admin', 'Super Admin')
  )
);

-- SERVICE ROLE: Bypass
CREATE POLICY "Admissions Service Role Bypass"
ON public.admissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT 'SUCCESS: Robust Admissions RLS Applied.' as status;
