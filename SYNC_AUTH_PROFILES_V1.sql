-- ==============================================================================
-- UNIVERSEPI OS - PROFILE SYNCHRONIZATION FIX (V1)
-- ==============================================================================
-- ISSUE: 
-- Running `reset.sql` drops the `public.profiles` table and wipes all profiles,
-- but it does not delete accounts from `auth.users`. 
-- When an existing user logs in, the application tries to fetch their profile
-- using `.single()`, which fails with "Cannot coerce the result to a single JSON object" 
-- (PGRST116) because exactly 0 rows are returned.
--
-- FIX:
-- This script synchronizes orphaned accounts in `auth.users` back into `public.profiles`.

BEGIN;

-- 1. Insert missing profiles from auth.users
INSERT INTO public.profiles (id, email, display_name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', email), 
    COALESCE(raw_user_meta_data->>'role', 'Student') -- Defaulting to Student if unknown
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- 2. Ensure the trigger exists to prevent future newly-signed-up users from missing their profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', NULL)
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
