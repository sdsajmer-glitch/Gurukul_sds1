-- ==============================================================================
-- FIX BRANCH KEYS: Case-Insensitivity & Generation
-- ==============================================================================
-- 1. Updates `generate_branch_access_key` to generate UPPERCASE keys.
-- 2. Updates `verify_and_link_branch_admin` to match keys case-insensitively.
-- This resolves the "Invalid or expired access key" error caused by case mismatches.

BEGIN;

-- 1. UPDATE GENERATION LOGIC (Store Uppercase)
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
    IF NOT EXISTS (SELECT 1 FROM public.school_branches WHERE id = p_branch_id AND school_user_id = v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Access Denied: You do not own this branch.');
    END IF;

    -- Generate a secure random code (UPPERCASE)
    v_code := upper(encode(gen_random_bytes(6), 'hex')); 
    v_expires_at := now() + interval '7 days';

    -- Invalidate old pending invitations via Single Use Protocol
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


-- 2. UPDATE VERIFICATION LOGIC (Case-Insensitive Match)
CREATE OR REPLACE FUNCTION public.verify_and_link_branch_admin(p_invitation_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_invitation record;
  v_branch_admin_email text;
BEGIN
  v_user_id := auth.uid();
  v_user_email := (select email from auth.users where id = v_user_id);
  
  IF v_user_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Find valid invitation (CASE INSENSITIVE MATCH)
  SELECT * INTO v_invitation
  FROM public.school_branch_invitations
  WHERE upper(code) = upper(p_invitation_code)
    AND expires_at > now()
    AND is_revoked = false
    AND redeemed_at IS NULL;

  IF v_invitation IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired access key');
  END IF;

  -- ENFORCEMENT: Check if Branch has a designated Admin Email
  SELECT admin_email INTO v_branch_admin_email
  FROM public.school_branches
  WHERE id = v_invitation.branch_id;

  -- If admin_email is set, user email MUST match exactly (case-insensitive)
  IF v_branch_admin_email IS NOT NULL AND lower(v_branch_admin_email) != lower(v_user_email) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Access Denied: Your email does not match the registered Branch Admin email.');
  END IF;

  -- Update Invitation
  UPDATE public.school_branch_invitations
  SET redeemed_at = now(),
      redeemed_by = v_user_id
  WHERE id = v_invitation.id;

  -- Link user to branch
  UPDATE public.profiles
  SET role = 'School Administration', 
      branch_id = v_invitation.branch_id,
      profile_completed = false
  WHERE id = v_user_id;
  
  -- Update school_branches table owner
  UPDATE public.school_branches
  SET branch_admin_id = v_user_id
  WHERE id = v_invitation.branch_id;

  RETURN jsonb_build_object('success', true, 'branch_id', v_invitation.branch_id);
END;
$$;

COMMIT;
