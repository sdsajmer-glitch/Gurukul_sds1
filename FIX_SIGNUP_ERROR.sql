-- ============================================
-- FIX: Database Error Saving New User
-- This script updates the handle_new_user trigger to handle cases
-- where a profile with the same email already exists (e.g. branch admin pre-allocation).
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_profile_id uuid;
BEGIN
  -- Check if a profile with this email already exists
  SELECT id INTO existing_profile_id FROM public.profiles WHERE email = new.email;

  IF existing_profile_id IS NOT NULL THEN
    -- If profile exists, we UPDATE it to match the new Auth ID.
    -- This effectively "claims" the pre-existing profile for the newly registered user.
    UPDATE public.profiles
    SET 
        id = new.id, -- Update PK to match new Auth ID
        updated_at = now(),
        -- Keep existing role/name if present, or initialize with new defaults
        display_name = COALESCE(display_name, new.raw_user_meta_data->>'full_name', new.email),
        role = COALESCE(role, new.raw_user_meta_data->>'role', 'Student')
    WHERE email = new.email;
    
  ELSE
    -- Standard Insert for new user (no existing profile)
    INSERT INTO public.profiles (id, email, display_name, role, profile_completed)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', new.email),
      COALESCE(new.raw_user_meta_data->>'role', 'Student'),
      false
    );
  END IF;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction if possible, or raise a cleaner error
  RAISE LOG 'Error in handle_new_user: %', SQLERRM;
  RAISE EXCEPTION 'Database error saving new user profile: %', SQLERRM;
END;
$$;

-- Ensure the trigger is correctly bound
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'SUCCESS: Trigger updated to handle existing email conflicts.' as status;
