-- ============================================
-- FIX_PROFILES_RLS.sql
-- ============================================
-- Implementation: Robust RLS for Profile Visibility
-- Target: Profiles Table
-- Objective: Allow Admins to see student/teacher profiles for directory synchronization.
-- ============================================

BEGIN;

-- 1. Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Cleanup existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view directory profiles" ON public.profiles;

-- 3. Create Multi-Tiered Visibility Policies

-- [Tier 1] Self Access: Full visibility for own profile
CREATE POLICY "Profiles Self Access" 
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- [Tier 2] Admin Authority: Full visibility for school/branch administration
-- This allows admins to sync names and details in directories.
CREATE POLICY "Profiles Admin Access"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Admin')
  )
);

-- [Tier 3] Faculty Context: Teachers can see students
CREATE POLICY "Profiles Faculty Access"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'Teacher'
  )
);

-- 4. Update Audit Handshake
INSERT INTO public.audit_logs (action, module, details)
VALUES ('RLS_UPGRADE', 'IDENTITY', '{"table": "profiles", "status": "ADMIN_VISIBILITY_RESTORED"}');

COMMIT;
