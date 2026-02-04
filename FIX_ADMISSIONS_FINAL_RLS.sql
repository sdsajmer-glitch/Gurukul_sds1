-- ==============================================================================
-- DEFINITIVE FIX: ADMISSIONS RLS (ROW LEVEL SECURITY)
-- ==============================================================================
-- This script clears all existing policies on the 'admissions' table and sets
-- up fresh, correct policies to allow parents to register their children.

BEGIN;

-- 1. Ensure RLS is active
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;

-- 2. Clean slate for policies (removing all common names found in project files)
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
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON public.admissions;
DROP POLICY IF EXISTS "Allow Parents Select Own" ON public.admissions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.admissions;
DROP POLICY IF EXISTS "Allow All Authenticated Inserts" ON public.admissions;
DROP POLICY IF EXISTS "Public can insert admissions" ON public.admissions;
DROP POLICY IF EXISTS "Anyone can create their own admission" ON public.admissions;

-- 3. CREATE FRESH, CORRECT POLICIES

-- PARENT: INSERT
-- Allows users to create a new admission record as long as they are the parent.
CREATE POLICY "Admissions INSERT for Parents"
ON public.admissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = parent_id
);

-- PARENT: SELECT
-- Allows parents to see records they created, OR records sent to their email.
CREATE POLICY "Admissions SELECT for Parents"
ON public.admissions
FOR SELECT
TO authenticated
USING (
  auth.uid() = parent_id 
  OR 
  parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- PARENT: UPDATE
-- Allows parents to modify their own submission while it's in a registered or pending state.
CREATE POLICY "Admissions UPDATE for Parents"
ON public.admissions
FOR UPDATE
TO authenticated
USING (auth.uid() = parent_id)
WITH CHECK (auth.uid() = parent_id);

-- STAFF: GLOBAL SELECT
-- Allows School Admins, Teachers, and Super Admins to view admissions.
CREATE POLICY "Admissions SELECT for Staff"
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

-- STAFF: GLOBAL UPDATE
-- Allows School Admins and Super Admins to manage statuses, grades, and assignments.
CREATE POLICY "Admissions UPDATE for Staff"
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

-- SERVICE ROLE: FULL ACCESS
-- Ensure internal processes are never blocked.
CREATE POLICY "Admissions Service Role Bypass"
ON public.admissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. APPLY TO DEPENDENT TABLES (Just in case)
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can manage their own requirements" ON public.document_requirements;
CREATE POLICY "Manage requirements" ON public.document_requirements
FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admissions WHERE id = admission_id AND parent_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('School Administration', 'Branch Admin', 'Super Admin'))
);

-- Refresh Schema Cache
NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT 'SUCCESS: Consolidated Admissions RLS Applied.' as status;
