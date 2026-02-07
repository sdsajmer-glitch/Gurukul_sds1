-- ============================================
-- FIX_PROFILES_RLS_RECURSION.sql
-- ============================================
-- Implementation: Recursion-Safe RLS for Profiles
-- Locality: Identity Layer
-- Objective: Resolve "infinite recursion detected" error in profiles policy.
-- ============================================

BEGIN;

-- 1. Clean up existing recursive policies
DROP POLICY IF EXISTS "Profiles Admin Access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Faculty Access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Self Access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view directory profiles" ON public.profiles;

-- 2. Deploy Identity Handshake Functions (SECURITY DEFINER)
-- These bypass RLS because they execute with the permissions of the function owner (superuser).
-- This prevents the policy from calling itself.

CREATE OR REPLACE FUNCTION public.is_admin_v2()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (
      role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Admin')
      OR role IN ('school_admin', 'admin', 'branch_admin')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_v2()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'Teacher' OR role = 'teacher')
  );
$$;

-- 3. Deploy Secure, Non-Recursive Policies

-- [A] SELF ACCESS: Every user can manage their own identity node.
-- (Non-recursive because it doesn't select from profiles)
CREATE POLICY "profiles_self_manage"
ON public.profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- [B] ADMINISTRATIVE VISIBILITY: Admins can see all nodes for directory sync.
-- (Non-recursive because it calls a SECURITY DEFINER function)
CREATE POLICY "profiles_admin_directory_view"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_v2());

-- [C] FACULTY VISIBILITY: Teachers can see student nodes.
CREATE POLICY "profiles_teacher_roster_view"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_teacher_v2());

-- [D] SYSTEM BYPASS
CREATE POLICY "profiles_service_role_bypass"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Registry Update
INSERT INTO public.audit_logs (action, module, details)
VALUES ('RLS_RECURSION_FIX', 'IDENTITY', '{"status": "SUCCESS", "version": "v2.1"}');

COMMIT;
