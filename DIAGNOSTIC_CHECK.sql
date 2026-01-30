-- ===============================================================================================
--  GURUKUL OS: SCHEMA INTEGRITY DIAGNOSTIC (v1.0)
--  Run this in Supabase SQL Editor to verify your database state.
-- ===============================================================================================

WITH diagnostic AS (
    SELECT 
        (SELECT count(*) FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'school_id') as has_profiles_school_id,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'branch_id') as has_profiles_branch_id,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'school_id') as has_branches_school_id
)
SELECT 
    CASE WHEN has_profiles_school_id = 1 THEN '✅ profiles.school_id EXISTS' ELSE '❌ profiles.school_id MISSING' END as profiles_school_id,
    CASE WHEN has_profiles_branch_id = 1 THEN '✅ profiles.branch_id EXISTS' ELSE '❌ profiles.branch_id MISSING' END as profiles_branch_id,
    CASE WHEN has_branches_school_id = 1 THEN '✅ school_branches.school_id EXISTS' ELSE '❌ school_branches.school_id MISSING' END as branches_school_id,
    'IF ANY CROSSES (❌) APPEAR, RUN THE ULTIMATE FIX SCRIPT BELOW.' as instructions
FROM diagnostic;

-- ===============================================================================================
--  THE ULTIMATE FIX SCRIPT (Run this if you see any ❌ above)
-- ===============================================================================================
/*
BEGIN;
    -- 1. Patch Profiles
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id BIGINT;
    
    -- 2. Patch Branches
    -- Note: We use school_admin_profiles(user_id) as the source of truth for School IDs
    ALTER TABLE public.school_branches ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.school_admin_profiles(user_id) ON DELETE CASCADE;
    
    -- 3. Refresh Cache
    NOTIFY pgrst, 'reload schema';
COMMIT;
*/
