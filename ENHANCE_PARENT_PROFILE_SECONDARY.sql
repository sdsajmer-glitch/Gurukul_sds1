-- ============================================
-- ENHANCEMENT: Add Secondary Parent Support
-- ============================================

-- 1. Add new columns to parent_profiles
ALTER TABLE public.parent_profiles
ADD COLUMN IF NOT EXISTS secondary_parent_name text,
ADD COLUMN IF NOT EXISTS secondary_parent_relationship text,
ADD COLUMN IF NOT EXISTS secondary_parent_gender text,
ADD COLUMN IF NOT EXISTS secondary_parent_phone text,
ADD COLUMN IF NOT EXISTS secondary_parent_email text;

-- 2. Update the upsert function to handle these new fields
DROP FUNCTION IF EXISTS public.upsert_parent_profile(uuid, text, text, text, integer, text, text, text, text, text);

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
  p_pin_code text,
  -- New parameters
  p_secondary_parent_name text DEFAULT NULL,
  p_secondary_parent_relationship text DEFAULT NULL,
  p_secondary_parent_gender text DEFAULT NULL,
  p_secondary_parent_phone text DEFAULT NULL,
  p_secondary_parent_email text DEFAULT NULL
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
  
  -- Ensure profile exists
  INSERT INTO public.profiles (id, email, display_name, role, profile_completed)
  VALUES (p_user_id, COALESCE(v_email, ''), p_display_name, 'Parent/Guardian', false)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = 'Parent/Guardian',
    updated_at = now();

  -- Insert/Update parent_profiles
  INSERT INTO public.parent_profiles (
    user_id, 
    relationship_to_student, 
    gender, 
    number_of_children, 
    address, 
    city, 
    state, 
    country, 
    pin_code,
    secondary_parent_name,
    secondary_parent_relationship,
    secondary_parent_gender,
    secondary_parent_phone,
    secondary_parent_email
  )
  VALUES (
    p_user_id, 
    p_relationship, 
    p_gender, 
    p_num_children, 
    p_address, 
    p_city, 
    p_state, 
    p_country, 
    p_pin_code,
    p_secondary_parent_name,
    p_secondary_parent_relationship,
    p_secondary_parent_gender,
    p_secondary_parent_phone,
    p_secondary_parent_email
  )
  ON CONFLICT (user_id) DO UPDATE SET
    relationship_to_student = EXCLUDED.relationship_to_student,
    gender = EXCLUDED.gender,
    number_of_children = EXCLUDED.number_of_children,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    country = EXCLUDED.country,
    pin_code = EXCLUDED.pin_code,
    secondary_parent_name = EXCLUDED.secondary_parent_name,
    secondary_parent_relationship = EXCLUDED.secondary_parent_relationship,
    secondary_parent_gender = EXCLUDED.secondary_parent_gender,
    secondary_parent_phone = EXCLUDED.secondary_parent_phone,
    secondary_parent_email = EXCLUDED.secondary_parent_email;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Verify the changes
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'parent_profiles' AND column_name LIKE 'secondary%';
