-- ===============================================================================================
--  FINAL FIX: MISSING COLUMNS PATCH
--  Description: This script manually adds the missing 'school_id' and 'branch_id' columns
--               to the 'profiles' and 'school_branches' tables.
--               This fixes the "Attribute Desync" error.
--  INSTRUCTIONS:
--  1. Copy ALL text in this file.
--  2. Open Supabase Dashboard (https://supabase.com/dashboard).
--  3. Go to the "SQL Editor" tab (icon on the left).
--  4. Paste this code and click "RUN".
-- ===============================================================================================

BEGIN;

-- 1. Fix 'profiles' table (Critical for Login & Dashboard)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS school_id UUID,
ADD COLUMN IF NOT EXISTS branch_id BIGINT;

-- 2. Fix 'school_branches' table (Critical for Branch Registry)
ALTER TABLE public.school_branches 
ADD COLUMN IF NOT EXISTS school_id UUID;

-- 3. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ===============================================================================================
--  VERIFICATION CHECK
--  If the script ran successfully, you will see "Success" in the results below.
-- ===============================================================================================
SELECT 
    column_name, 
    table_name 
FROM information_schema.columns 
WHERE table_name IN ('profiles', 'school_branches') 
AND column_name IN ('school_id', 'branch_id');
