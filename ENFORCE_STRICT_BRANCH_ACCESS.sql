-- ==============================================================================
-- STRICT BRANCH ACCESS ENFORCEMENT PROTOCOL
-- ==============================================================================
-- This script enforces strict isolation for Branch Admins at the database layer.
-- 1. Modifies 'verify_and_link_branch_admin' to enforce Email Matching.
-- 2. Modifies Branch Management RPCs to BLOCK Branch Admins from creating/editing.
-- 3. Ensures 'get_school_branches' only returns the specific branch.

BEGIN;

-- 1. STRICT EMAIL VERIFICATION IN HANDSHAKE
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

  -- ENFORCEMENT: Check if Branch has a designated Admin Email
  SELECT admin_email INTO v_branch_admin_email
  FROM public.school_branches
  WHERE id = v_invitation.branch_id;

  -- If admin_email is set on the branch, the user's email MUST match exactly (case-insensitive)
  IF v_branch_admin_email IS NOT NULL AND lower(v_branch_admin_email) != lower(v_user_email) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Access Denied: Your email does not match the registered Branch Admin email.');
  END IF;

  -- Update Invitation
  UPDATE public.school_branch_invitations
  SET redeemed_at = now(),
      redeemed_by = v_user_id
  WHERE id = v_invitation.id;

  -- Link user to branch but let them complete their personal profile details
  UPDATE public.profiles
  SET role = 'School Administration', 
      branch_id = v_invitation.branch_id,
      profile_completed = false -- Force them to complete name/phone in ProfileCreationPage
  WHERE id = v_user_id;
  
  -- Update school_branches table
  UPDATE public.school_branches
  SET branch_admin_id = v_user_id
  WHERE id = v_invitation.branch_id;

  RETURN jsonb_build_object('success', true, 'branch_id', v_invitation.branch_id);
END;
$$;


-- 2. LOCK DOWN CREATION: Branch Admins cannot create new branches
CREATE OR REPLACE FUNCTION public.create_school_branch(
    p_name text,
    p_address text,
    p_city text,
    p_state text,
    p_country text,
    p_contact_number text,
    p_is_main boolean,
    p_email text DEFAULT NULL,
    p_admin_name text DEFAULT NULL,
    p_admin_phone text DEFAULT NULL,
    p_admin_email text DEFAULT NULL
)
RETURNS SETOF public.school_branches
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch_id bigint;
    v_user_branch_id bigint;
BEGIN
    -- Check if user is already restricted to a branch
    SELECT branch_id INTO v_user_branch_id FROM public.profiles WHERE id = auth.uid();
    
    IF v_user_branch_id IS NOT NULL THEN
        RAISE EXCEPTION 'Restricted Access: Branch Admins cannot expand the institutional network.';
    END IF;

    -- Proceed with creation
    INSERT INTO public.school_branches (
        school_user_id, name, address, city, state, country, contact_number, is_main_branch,
        email, admin_name, admin_phone, admin_email, created_at
    )
    VALUES (
        auth.uid(), p_name, p_address, p_city, p_state, p_country, p_contact_number, p_is_main,
        p_email, p_admin_name, p_admin_phone, p_admin_email, now()
    )
    RETURNING id INTO v_branch_id;

    RETURN QUERY SELECT * FROM public.school_branches WHERE id = v_branch_id;
END;
$$;


-- 3. LOCK DOWN UPDATES: Ensure strictly only School Owner can update structural details
-- (Branch Admins might be allowed to update *some* details of their own branch, but for now we restrict strictly as requested)
CREATE OR REPLACE FUNCTION public.update_school_branch(
    p_branch_id bigint,
    p_name text,
    p_address text,
    p_city text,
    p_state text,
    p_country text,
    p_contact_number text,
    p_is_main boolean,
    p_email text,
    p_admin_name text,
    p_admin_phone text,
    p_admin_email text
)
RETURNS SETOF public.school_branches
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- STRICT: Only the School Owner (school_user_id) can update branch structure.
    -- Branch Admins (branch_admin_id) are READ-ONLY for the Branch Registry level.
    IF NOT EXISTS (SELECT 1 FROM public.school_branches WHERE id = p_branch_id AND school_user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Access Denied: Only Head Office can modify branch registry.';
    END IF;

    UPDATE public.school_branches
    SET 
        name = p_name,
        address = p_address,
        city = p_city,
        state = p_state,
        country = p_country,
        contact_number = p_contact_number,
        is_main_branch = p_is_main,
        email = p_email,
        admin_name = p_admin_name,
        admin_phone = p_admin_phone,
        admin_email = p_admin_email
    WHERE id = p_branch_id;

    RETURN QUERY SELECT * FROM public.school_branches WHERE id = p_branch_id;
END;
$$;

-- 4. ENSURE GET RETURNS ONLY ASSIGNED BRANCH FOR RESTRICTED USERS
CREATE OR REPLACE FUNCTION public.get_school_branches()
RETURNS SETOF public.school_branches
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_branch_id bigint;
BEGIN
    -- Check strict restriction from profile
    SELECT branch_id INTO v_user_branch_id FROM public.profiles WHERE id = auth.uid();

    IF v_user_branch_id IS NOT NULL THEN
        -- Forced Limited View
        RETURN QUERY
        SELECT *
        FROM public.school_branches
        WHERE id = v_user_branch_id;
    ELSE
        -- Head Office View (Own branches + branches they function as admin for if any mixed legacy state)
        RETURN QUERY
        SELECT *
        FROM public.school_branches
        WHERE school_user_id = auth.uid() OR branch_admin_id = auth.uid()
        ORDER BY is_main_branch DESC, created_at ASC;
    END IF;
END;
$$;


-- 5. PROTECT INITIALIZATION: Prevent Branch Admins from initializing new schools
CREATE OR REPLACE FUNCTION public.initialize_school_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_is_branch_admin boolean;
BEGIN
  v_user_id := auth.uid();
  v_user_email := (select email from auth.users where id = v_user_id);
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- CHECK ELIGIBILITY: If they match a branch admin email, they CANNOT establish a new school.
  SELECT EXISTS (
    SELECT 1 FROM public.school_branches WHERE lower(admin_email) = lower(v_user_email)
  ) INTO v_is_branch_admin;

  IF v_is_branch_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Restricted Status: Your account is designated for branch management only. Please use the Join Existing Group option.');
  END IF;

  -- Update Role in Profile
  UPDATE public.profiles
  SET role = 'School Administration'
  WHERE id = v_user_id;

  -- Ensure School Admin Profile exists
  INSERT INTO public.school_admin_profiles (user_id, onboarding_step)
  VALUES (v_user_id, 'profile')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_link_branch_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_link_branch_admin(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_school_branch(text, text, text, text, text, text, boolean, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_branches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_school_admin() TO authenticated;

COMMIT;
