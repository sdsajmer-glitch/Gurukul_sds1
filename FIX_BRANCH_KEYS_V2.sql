-- ==============================================================================
-- FIX BRANCH KEYS V2: Super Admin Access & Case-Insensitivity
-- ==============================================================================
-- This script updates the access key functions to allow Super Admins to manage 
-- keys for any branch, not just those they "own" in the database.

BEGIN;

-- 1. UPDATE GENERATION LOGIC (Allow Super Admins + Uppercase)
CREATE OR REPLACE FUNCTION public.generate_branch_access_key(p_branch_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_user_role text;
    v_code text;
    v_expires_at timestamp with time zone;
BEGIN
    v_user_id := auth.uid();
    
    -- Get caller's role from profiles
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    -- Verify access: Either owner OR Super Admin
    IF NOT EXISTS (
        SELECT 1 FROM public.school_branches 
        WHERE id = p_branch_id 
        AND (school_user_id = v_user_id OR v_user_role = 'Super Admin')
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Access Denied: Insufficient permissions to provision this node.');
    END IF;

    -- Generate a secure random code (UPPERCASE)
    v_code := upper(encode(gen_random_bytes(6), 'hex')); 
    v_expires_at := now() + interval '7 days';

    -- Invalidate old pending invitations (Single Use Protocol)
    UPDATE public.school_branch_invitations
    SET is_revoked = true
    WHERE branch_id = p_branch_id AND redeemed_at IS NULL;

    -- Create new invitation
    INSERT INTO public.school_branch_invitations (
        branch_id, code, expires_at, created_by
    ) VALUES (
        p_branch_id, v_code, v_expires_at, v_user_id
    );

    RETURN jsonb_build_object('success', true, 'code', v_code, 'expires_at', v_expires_at);
END;
$$;

-- 2. UPDATE REVOKE LOGIC (Allow Super Admins)
CREATE OR REPLACE FUNCTION public.revoke_branch_access_key(p_branch_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_user_role text;
BEGIN
    v_user_id := auth.uid();
    
    -- Get caller's role
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    -- Verify access
    IF NOT EXISTS (
        SELECT 1 FROM public.school_branches 
        WHERE id = p_branch_id 
        AND (school_user_id = v_user_id OR v_user_role = 'Super Admin')
    ) THEN
         RETURN jsonb_build_object('success', false, 'message', 'Access Denied');
    END IF;

    -- Revoke all active keys
    UPDATE public.school_branch_invitations
    SET is_revoked = true
    WHERE branch_id = p_branch_id AND redeemed_at IS NULL;

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;
