
-- ==============================================================================
-- MISSION CRITICAL: MESSAGING ACCESS PROTOCOL (V6)
-- ==============================================================================
-- 1. Explicit Authorization Check: Prevents illegal message injection.
-- 2. Error Propagation: Uses RAISE EXCEPTION for clean frontend handling.
-- 3. Inversion Fix: Ensures parent/admin flags are correctly mapped.
-- ==============================================================================

BEGIN;

-- 1. Update send_enquiry_message_v3 with strict access checks
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
    v_is_admin boolean;
    v_has_access boolean := false;
    v_user_email text;
BEGIN
    -- A. Validate UUID
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid node identifier format.';
    END;

    -- B. Determine Role
    SELECT (role IN ('school_admin', 'admin', 'branch_admin'))
    INTO v_is_admin
    FROM public.profiles
    WHERE id = auth.uid();

    -- C. Access Authorization
    IF v_is_admin THEN
        -- Admin Access: Match by branch
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            JOIN public.profiles p ON p.branch_id = e.branch_id OR p.role = 'school_admin'
            WHERE e.id = v_enquiry_uuid AND p.id = auth.uid()
        ) INTO v_has_access;
    ELSE
        -- Parent Access: Match by ID or Handshake Email
        v_user_email := LOWER(COALESCE(
            (SELECT email FROM public.profiles WHERE id = auth.uid()),
            (SELECT auth.jwt() ->> 'email'),
            ''
        ));

        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = auth.uid() 
                OR (v_user_email <> '' AND LOWER(e.parent_email) = v_user_email)
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Access Denied: Node Handshake Refused. You do not have permission to message this record.';
    END IF;

    -- D. Commit Payload
    INSERT INTO public.enquiry_messages (
        enquiry_id,
        sender_id,
        message,
        is_admin,
        is_admin_message
    ) VALUES (
        v_enquiry_uuid,
        auth.uid(),
        p_message,
        COALESCE(v_is_admin, false),
        COALESCE(v_is_admin, false)
    );

    -- E. Register Activity Pulse
    UPDATE public.enquiries 
    SET updated_at = now() 
    WHERE id = v_enquiry_uuid;

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;

SELECT 'SUCCESS: Messaging access protocol V6 deployed.' as status;
