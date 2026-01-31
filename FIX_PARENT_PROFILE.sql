-- ============================================
-- AGGRESSIVE FIX: Drop ALL versions and recreate
-- Run this FIRST in Supabase SQL Editor
-- ============================================

-- Step 1: Drop ALL versions of upsert_parent_profile (any parameter count)
DROP FUNCTION IF EXISTS public.upsert_parent_profile(uuid, text, text, text, integer, text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.upsert_parent_profile(uuid, text, text, text, integer, text, text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.upsert_parent_profile CASCADE;

-- Step 2: Recreate with correct signature (10 parameters including p_address)
CREATE OR REPLACE FUNCTION public.upsert_parent_profile(
  p_user_id uuid,
  p_display_name text,
  p_relationship text,
  p_gender text,
  p_num_children integer,
  p_address text,
  p_city text,
  p_state text,
  p_country text,
  p_pin_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  -- Fetch email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  
  -- CRITICAL: Ensure profile exists FIRST (prevents FK violation)
  INSERT INTO public.profiles (id, email, display_name, role, profile_completed)
  VALUES (p_user_id, COALESCE(v_email, ''), p_display_name, 'Parent/Guardian', false)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = 'Parent/Guardian',
    updated_at = now();

  -- Then insert into parent_profiles
  INSERT INTO public.parent_profiles (
    user_id, relationship_to_student, gender, number_of_children, address, city, state, country, pin_code
  )
  VALUES (
    p_user_id, p_relationship, p_gender, p_num_children, p_address, p_city, p_state, p_country, p_pin_code
  )
  ON CONFLICT (user_id) DO UPDATE SET
    relationship_to_student = EXCLUDED.relationship_to_student,
    gender = EXCLUDED.gender,
    number_of_children = EXCLUDED.number_of_children,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    country = EXCLUDED.country,
    pin_code = EXCLUDED.pin_code;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Step 3: Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Step 4: Verify the function exists with correct parameters
SELECT 
  p.proname as function_name,
  p.pronargs as param_count,
  pg_get_function_arguments(p.oid) as parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'upsert_parent_profile';

-- You should see:
-- function_name: upsert_parent_profile
-- param_count: 10
-- parameters: p_user_id uuid, p_display_name text, p_relationship text, p_gender text, p_num_children integer, p_address text, p_city text, p_state text, p_country text, p_pin_code text
