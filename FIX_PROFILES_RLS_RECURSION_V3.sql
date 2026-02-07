-- ============================================
-- FIX_PROFILES_RLS_RECURSION_V3.sql
-- ============================================
-- Implementation: Anti-Recursion Protection for Profile Identity
-- Objective: Resolve "infinite recursion detected" by using PL/pgSQL
-- (Prevents function inlining which causes policy recursion)
-- ============================================

BEGIN;

-- 1. Comprehensive Cleanup of problematic policies
DROP POLICY IF EXISTS "Profiles Admin Access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Faculty Access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Self Access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_manage" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_directory_view" ON public.profiles;
DROP POLICY IF EXISTS "profiles_teacher_roster_view" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_bypass" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view directory profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;

-- 2. Deploy Recursion-Proof Handshake Functions (PL/pgSQL prevents inlining)
CREATE OR REPLACE FUNCTION public.check_is_admin_v3()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Admin', 'school_admin', 'admin', 'branch_admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_teacher_v3()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role IN ('Teacher', 'teacher');
END;
$$;

-- 3. Deploy New Non-Recursive Policies

-- [Tier 1] SELF MANAGE: Primary check for own node (No subquery = No recursion)
CREATE POLICY "profiles_v3_self"
ON public.profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- [Tier 2] ADMIN DIRECTORY: Uses PL/pgSQL function to break the recursion chain
CREATE POLICY "profiles_v3_admin_view"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.check_is_admin_v3());

-- [Tier 3] FACULTY ROSTER: Teacher student-viewing
CREATE POLICY "profiles_v3_teacher_view"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.check_is_teacher_v3());

-- [Tier 4] SERVICE BYPASS
CREATE POLICY "profiles_v3_service"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Handshake Validation Log
INSERT INTO public.audit_logs (action, module, details)
VALUES ('RLS_RECURSION_FIX_V3', 'IDENTITY', '{"status": "DEPLOYED", "technology": "PLPGSQL"}');

COMMIT;
