-- ==============================================================================
-- FIX SCHOOL ADMIN ONBOARDING FLOW ORDER
-- ==============================================================================
-- Updates the RPCs to follow the new order: Plan (Pricing) -> Profile -> Branches

-- 1. Update Initialization to start at 'pricing'
CREATE OR REPLACE FUNCTION public.initialize_school_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Update Role in Profile
  UPDATE public.profiles
  SET role = 'School Administration'
  WHERE id = v_user_id;

  -- Ensure School Admin Profile exists and set step to 'pricing'
  INSERT INTO public.school_admin_profiles (user_id, onboarding_step)
  VALUES (v_user_id, 'pricing')
  ON CONFLICT (user_id) DO UPDATE 
  SET onboarding_step = 'pricing';

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Update Plan selection to move to 'profile'
CREATE OR REPLACE FUNCTION public.update_school_plan(p_plan_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.school_admin_profiles
  SET 
    plan_id = p_plan_id,
    onboarding_step = 'profile'
  WHERE user_id = auth.uid();
END;
$$;
