-- Fix Branch Verification Logic
-- 1. Makes code comparison case-insensitive (Frontend sends Uppercase, valid hex is lowercase)
-- 2. Adds Email Verification (User must be logged in with the email assigned to the branch admin)

CREATE OR REPLACE FUNCTION public.verify_and_link_branch_admin(p_invitation_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_invitation record;
  v_branch record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;
  
  -- Get current user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Find valid invitation (Case Insensitive)
  SELECT * INTO v_invitation
  FROM public.school_branch_invitations
  WHERE upper(code) = upper(p_invitation_code)
    AND expires_at > now()
    AND is_revoked = false
    AND redeemed_at IS NULL;

  IF v_invitation IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired access key');
  END IF;

  -- Check Branch Admin Email Restriction
  SELECT * INTO v_branch FROM public.school_branches WHERE id = v_invitation.branch_id;
  
  -- If the branch has a designated admin email, enforce it
  IF v_branch.admin_email IS NOT NULL AND lower(v_branch.admin_email) != lower(v_user_email) THEN
      RETURN jsonb_build_object(
          'success', false, 
          'message', format('Access Denied: This key is reserved for %s. You are logged in as %s.', v_branch.admin_email, v_user_email)
      );
  END IF;

  -- Update Invitation
  UPDATE public.school_branch_invitations
  SET redeemed_at = now(),
      redeemed_by = v_user_id
  WHERE id = v_invitation.id;

  -- Link user to branch
  UPDATE public.profiles
  SET role = 'School Administration', 
      branch_id = v_invitation.branch_id
  WHERE id = v_user_id;
  
  -- Update school_branches table
  UPDATE public.school_branches
  SET branch_admin_id = v_user_id
  WHERE id = v_invitation.branch_id;

  RETURN jsonb_build_object('success', true, 'branch_id', v_invitation.branch_id);
END;
$$;
