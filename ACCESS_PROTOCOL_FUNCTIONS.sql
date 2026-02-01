-- Protocol Access Management Functions
-- Defines RPCs for generating and revoking branch access keys.

-- 0. Ensure Table Exists
CREATE TABLE IF NOT EXISTS public.school_branch_invitations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint,
    code text NOT NULL UNIQUE,
    expires_at timestamp with time zone,
    is_revoked boolean DEFAULT false,
    redeemed_at timestamp with time zone,
    redeemed_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- 1. Generate Access Key
CREATE OR REPLACE FUNCTION public.generate_branch_access_key(p_branch_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_code text;
    v_expires_at timestamp with time zone;
BEGIN
    v_user_id := auth.uid();

    -- Verify ownership/access
    -- Either the user owns the branch (school_admin) OR is a super admin (add logic if needed)
    IF NOT EXISTS (SELECT 1 FROM public.school_branches WHERE id = p_branch_id AND school_user_id = v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Access Denied: You do not own this branch.');
    END IF;

    -- Generate a secure random code (simplified here, but robust enough)
    v_code := upper(encode(gen_random_bytes(6), 'hex')); -- 12 chars hex, UPPERCASE
    v_expires_at := now() + interval '7 days';

    -- Invalidate old pending invitations for this branch to enforce "Single Use Protocol"
    UPDATE public.school_branch_invitations
    SET is_revoked = true
    WHERE branch_id = p_branch_id AND redeemed_at IS NULL;

    -- Create new invitation
    INSERT INTO public.school_branch_invitations (
        branch_id,
        code,
        expires_at,
        created_by
    ) VALUES (
        p_branch_id,
        v_code,
        v_expires_at,
        v_user_id
    );

    RETURN jsonb_build_object('success', true, 'code', v_code, 'expires_at', v_expires_at);
END;
$$;

-- 2. Revoke Access Key
CREATE OR REPLACE FUNCTION public.revoke_branch_access_key(p_branch_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();

    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM public.school_branches WHERE id = p_branch_id AND school_user_id = v_user_id) THEN
         RETURN jsonb_build_object('success', false, 'message', 'Access Denied');
    END IF;

    -- Revoke all active keys
    UPDATE public.school_branch_invitations
    SET is_revoked = true
    WHERE branch_id = p_branch_id AND redeemed_at IS NULL;

    RETURN jsonb_build_object('success', true);
END;
$$;
