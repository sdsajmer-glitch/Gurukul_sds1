-- ===============================================================================================
--  EMERGENCY SCHEMA PATCH
--  Description: Manually adds the missing 'school_id' columns.
--  INSTRUCTIONS: 
--  1. Copy this script.
--  2. Open Supabase Dashboard -> SQL Editor.
--  3. Paste and Run.
-- ===============================================================================================

ALTER TABLE public.school_branches ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.school_admin_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.school_branches(id);

-- Force cache refresh for Supabase schema
NOTIFY pgrst, 'reload schema';
