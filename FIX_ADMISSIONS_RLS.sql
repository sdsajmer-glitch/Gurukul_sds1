-- ============================================
-- FIX ADMISSIONS RLS POLICY
-- Run this in Supabase SQL Editor to allow Parent Insert
-- ============================================

-- 1. Enable RLS (ensure it's on)
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Parents can insert their own children" ON public.admissions;
DROP POLICY IF EXISTS "Parents can view their own children" ON public.admissions;
DROP POLICY IF EXISTS "Parents can update their own children" ON public.admissions;
DROP POLICY IF EXISTS "Staff can view all admissions" ON public.admissions;
DROP POLICY IF EXISTS "Staff can update all admissions" ON public.admissions;

-- 3. Create INSERT Policy (Critical for Child Registration)
CREATE POLICY "Parents can insert their own children"
ON public.admissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = parent_id
);

-- 4. Create SELECT Policy
CREATE POLICY "Parents can view their own children"
ON public.admissions
FOR SELECT
TO authenticated
USING (
  auth.uid() = parent_id 
  OR parent_id IS NULL -- Allow viewing if ID not synced yet (rare)
  OR parent_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- 5. Create UPDATE Policy
CREATE POLICY "Parents can update their own children"
ON public.admissions
FOR UPDATE
TO authenticated
USING (auth.uid() = parent_id)
WITH CHECK (auth.uid() = parent_id);

-- 6. Grant Staff Access (School Admin, Teacher, etc)
CREATE POLICY "Staff can view all admissions"
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

CREATE POLICY "Staff can update all admissions"
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

-- 7. Force Schema Cache Refresh
NOTIFY pgrst, 'reload schema';

SELECT 'SUCCESS: Admissions RLS policies fixed!' as status;
