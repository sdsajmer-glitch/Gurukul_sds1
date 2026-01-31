-- FIX: Update verify_and_link_branch_admin to mark profile as completed
-- This ensures Branch Admins skip the "Create School" onboarding flow and go straight to the Dashboard.

CREATE OR REPLACE FUNCTION public.verify_and_link_branch_admin(p_invitation_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_invitation record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Find valid invitation
  SELECT * INTO v_invitation
  FROM public.school_branch_invitations
  WHERE code = p_invitation_code
    AND expires_at > now()
    AND is_revoked = false
    AND redeemed_at IS NULL;

  IF v_invitation IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired access key');
  END IF;

  -- Update Invitation
  UPDATE public.school_branch_invitations
  SET redeemed_at = now(),
      redeemed_by = v_user_id
  WHERE id = v_invitation.id;

  -- Link user to branch AND Mark Profile Completed
  UPDATE public.profiles
  SET role = 'School Administration', 
      branch_id = v_invitation.branch_id,
      profile_completed = true  -- <--- CRITICAL FIX
  WHERE id = v_user_id;
  
  -- Update school_branches table
  UPDATE public.school_branches
  SET branch_admin_id = v_user_id
  WHERE id = v_invitation.branch_id;

  RETURN jsonb_build_object('success', true, 'branch_id', v_invitation.branch_id);
END;
$$;
