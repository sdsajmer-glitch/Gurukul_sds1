-- Fix School Admin Profile Save Issues
-- This script ensures the table structure and RLS policies are correct

BEGIN;

-- 1. Ensure the table exists with correct structure
-- (This is idempotent - won't fail if table exists)
CREATE TABLE IF NOT EXISTS public.school_admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  school_name text,
  address text,
  city text,
  state text,
  country text DEFAULT 'India',
  admin_contact_name text,
  admin_contact_phone text,
  admin_contact_email text,
  admin_designation text DEFAULT 'Director',
  academic_board text,
  school_type text,
  academic_year_start text,
  academic_year_end text,
  grade_range_start text,
  grade_range_end text,
  onboarding_step text DEFAULT 'profile',
  plan_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.school_admin_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to recreate them
DROP POLICY IF EXISTS "Admin can manage own profile" ON public.school_admin_profiles;
DROP POLICY IF EXISTS "school_admin_insert_own" ON public.school_admin_profiles;
DROP POLICY IF EXISTS "school_admin_select_own" ON public.school_admin_profiles;
DROP POLICY IF EXISTS "school_admin_update_own" ON public.school_admin_profiles;
DROP POLICY IF EXISTS "school_admin_delete_own" ON public.school_admin_profiles;

-- 4. Create comprehensive RLS policies
-- Allow users to insert their own profile
CREATE POLICY "school_admin_insert_own" ON public.school_admin_profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Allow users to select their own profile
CREATE POLICY "school_admin_select_own" ON public.school_admin_profiles
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "school_admin_update_own" ON public.school_admin_profiles
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own profile
CREATE POLICY "school_admin_delete_own" ON public.school_admin_profiles
  FOR DELETE 
  USING (auth.uid() = user_id);

-- 5. Grant necessary permissions
GRANT ALL ON public.school_admin_profiles TO authenticated;
GRANT ALL ON public.school_admin_profiles TO service_role;

-- 6. Verify the setup
DO $$
BEGIN
  RAISE NOTICE 'School Admin Profiles table setup complete!';
  RAISE NOTICE 'RLS is enabled: %', (SELECT rowsecurity FROM pg_tables WHERE tablename = 'school_admin_profiles' AND schemaname = 'public');
  RAISE NOTICE 'Number of policies: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'school_admin_profiles' AND schemaname = 'public');
END $$;

COMMIT;
