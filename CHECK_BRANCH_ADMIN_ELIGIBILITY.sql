-- ==============================================================================
-- ROLE SELECTION & ONBOARDING PROTOCOL: ADMIN DETECTION ENHANCEMENT
-- ==============================================================================
-- Updated to check both school_admin_profiles and school_branches for email match.

CREATE OR REPLACE FUNCTION public.check_branch_admin_eligibility()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_email text;
    v_eligible boolean := false;
    v_is_school_admin boolean := false;
BEGIN
    v_user_email := (select email from auth.users where id = auth.uid());
    
    IF v_user_email IS NULL THEN
        RETURN jsonb_build_object('eligible', false, 'is_school_admin', false);
    END IF;

    -- Check if email matches any branch admin email (case-insensitive)
    SELECT EXISTS (
        SELECT 1 FROM public.school_branches 
        WHERE lower(admin_email) = lower(v_user_email)
    ) INTO v_eligible;
    
    -- Also check if email matches any school admin profile email (case-insensitive)
    SELECT EXISTS (
        SELECT 1 FROM public.school_admin_profiles 
        WHERE lower(admin_contact_email) = lower(v_user_email)
    ) INTO v_is_school_admin;

    RETURN jsonb_build_object(
        'eligible', v_eligible OR v_is_school_admin,
        'is_school_admin', v_is_school_admin
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_branch_admin_eligibility() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_branch_admin_eligibility() TO service_role;
