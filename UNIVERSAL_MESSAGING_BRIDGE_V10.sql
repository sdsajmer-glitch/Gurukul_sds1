
-- ==============================================================================
-- UNIVERSAL MESSAGING BRIDGE (V10) - THE CRITICAL ROLE SYNC FIX
-- ==============================================================================
-- This script fixes the "Node Handshake Refused" error by aligning role strings
-- and ensuring Head Office Admins have global messaging authority.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.send_enquiry_message_v3(
    p_enquiry_id text,
    p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enquiry_uuid uuid;
    v_sender_id uuid;
    v_is_admin boolean := false;
    v_has_access boolean := false;
    v_user_role text;
    v_user_email text;
    v_enquiry_branch_id bigint;
    v_sender_branch_id bigint;
BEGIN
    -- 1. Identity Verification
    v_sender_id := auth.uid();
    IF v_sender_id IS NULL THEN
        RAISE EXCEPTION 'Identity Node Offline: Authentication Required.';
    END IF;

    -- 2. Payload Validation
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid Node Identifier: UUID format violation.';
    END;

    -- 3. Resolve Sender Authority
    -- We use LOWER() and check for multiple variations to be bulletproof.
    SELECT 
        role, 
        branch_id,
        (LOWER(role) IN ('school administration', 'branch admin', 'school_admin', 'admin', 'super admin', 'principal'))
    INTO v_user_role, v_sender_branch_id, v_is_admin
    FROM public.profiles
    WHERE id = v_sender_id;

    -- SKELETAL PROTECTION: If profile is missing, create a temporary parent node to allow messaging
    IF v_user_role IS NULL THEN
        v_user_email := LOWER(auth.jwt() ->> 'email');
        INSERT INTO public.profiles (id, email, role, profile_completed)
        VALUES (v_sender_id, COALESCE(v_user_email, 'unknown@node.system'), 'Parent/Guardian', false);
        v_user_role := 'Parent/Guardian';
        v_is_admin := false;
    END IF;

    -- 4. Access Authorization Handshake
    IF v_is_admin THEN
        -- ADMINISTRATOR PROTOCOL
        -- Head Office / School Administration has global access
        IF LOWER(v_user_role) IN ('school administration', 'school_admin', 'super admin') THEN
            v_has_access := true;
        ELSE
            -- Branch Admin must match the enquiry's branch
            SELECT branch_id INTO v_enquiry_branch_id FROM public.enquiries WHERE id = v_enquiry_uuid;
            IF v_enquiry_branch_id = v_sender_branch_id OR v_enquiry_branch_id IS NULL THEN
                v_has_access := true;
            END IF;
        END IF;
    ELSE
        -- PARENT/GUARDIAN PROTOCOL
        v_user_email := LOWER(COALESCE(
            (SELECT email FROM public.profiles WHERE id = v_sender_id),
            (SELECT auth.jwt() ->> 'email'),
            ''
        ));

        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = v_sender_id 
                OR (v_user_email <> '' AND LOWER(e.parent_email) = v_user_email)
            )
        ) INTO v_has_access;
    END IF;

    -- 5. Permission Enforcement
    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Access Denied: Node Handshake Refused. You do not have permission to message this record.';
    END IF;

    -- 6. Commit Payload
    INSERT INTO public.enquiry_messages (
        enquiry_id,
        sender_id,
        message,
        is_admin,
        is_admin_message
    ) VALUES (
        v_enquiry_uuid,
        v_sender_id,
        p_message,
        COALESCE(v_is_admin, false),
        COALESCE(v_is_admin, false)
    );

    -- 7. Heartbeat Update
    UPDATE public.enquiries 
    SET updated_at = now() 
    WHERE id = v_enquiry_uuid;

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;

SELECT 'SUCCESS: Universal Messaging Bridge (V10) - Role Sync Deployed.' as status;
