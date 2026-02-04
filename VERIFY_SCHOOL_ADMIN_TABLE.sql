-- Verification Script for School Admin Profile Table
-- Run this in Supabase SQL Editor to verify table structure and RLS policies

-- 1. Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'school_admin_profiles'
ORDER BY ordinal_position;

-- 2. Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'school_admin_profiles';

-- 3. Check RLS policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'school_admin_profiles';

-- 4. Test insert with current user (run this when logged in as school admin)
-- This will show if RLS is blocking the insert
SELECT auth.uid() as current_user_id;

-- 5. Check if profile already exists
SELECT * FROM public.school_admin_profiles 
WHERE user_id = auth.uid();

-- 6. Check profiles table for current user
SELECT id, email, role, profile_completed, branch_id 
FROM public.profiles 
WHERE id = auth.uid();
