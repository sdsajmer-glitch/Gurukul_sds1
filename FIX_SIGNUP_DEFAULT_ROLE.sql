-- ==============================================================================
-- FIX SIGNUP DEFAULT ROLE: Allow User Selection
-- ==============================================================================
-- This fix ensures that new users created via Auth do NOT get a default 'Student' role.
-- Instead, the role is set to NULL, which triggers the 'Role Selection' UI in the frontend.

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
    -- FIX: Do not default to 'Student'. Set to NULL if not provided.
    -- This enforces the Role Selection step in the onboarding flow.
    COALESCE(new.raw_user_meta_data->>'role', NULL)
  );
  RETURN new;
END;
$$;

-- Note: We do not need to drop/recreate the trigger, just replacing the function logic is sufficient.
