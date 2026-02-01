-- ==============================================================================
-- ROLE SELECTION & ONBOARDING PROTOCOL: BRANCH ADMIN DETECTION
-- ==============================================================================
-- This script adds the capability to check if a user is eligible for Branch Admin
-- role based on their email matching a registered branch admin email.

CREATE OR REPLACE FUNCTION public.check_branch_admin_eligibility()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_email text;
    v_eligible boolean := false;
BEGIN
    v_user_email := (select email from auth.users where id = auth.uid());
    
    IF v_user_email IS NULL THEN
        RETURN jsonb_build_object('eligible', false);
    END IF;

    -- Check if email matches any branch admin email (case-insensitive)
    -- We only care about branches that don't have a branch_admin_id yet, 
    -- or perhaps all branches to be safe in case of re-linking.
    SELECT EXISTS (
        SELECT 1 FROM public.school_branches 
        WHERE lower(admin_email) = lower(v_user_email)
    ) INTO v_eligible;

    RETURN jsonb_build_object('eligible', v_eligible);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_branch_admin_eligibility() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_branch_admin_eligibility() TO service_role;
