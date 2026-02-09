-- ==============================================================================
-- FIX PARENT PROFILE FETCH
-- ==============================================================================
-- Creates a dedicated RPC to fetch merged profile details for parents.
-- Resolves the issue where 'address' columns were being queried on 'profiles' table
-- but actually reside in 'parent_profiles'.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_current_parent_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_parent_profile RECORD;
BEGIN
    -- 1. Fetch Basic Identity
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    
    IF v_profile IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    -- 2. Fetch Extended Residential Details
    SELECT * INTO v_parent_profile FROM public.parent_profiles WHERE user_id = p_user_id;

    -- 3. Merge & Return
    RETURN jsonb_build_object(
        'found', true,
        'id', v_profile.id,
        'display_name', v_profile.display_name,
        'email', v_profile.email,
        'phone', v_profile.phone,
        'branch_id', v_profile.branch_id,
        -- Residential Fields from Parent Profile (or null if not set)
        'address', COALESCE(v_parent_profile.address, ''),
        'city', COALESCE(v_parent_profile.city, ''),
        'state', COALESCE(v_parent_profile.state, ''),
        'country', COALESCE(v_parent_profile.country, ''),
        'pin_code', COALESCE(v_parent_profile.pin_code, '')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_parent_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_parent_details(uuid) TO service_role;
