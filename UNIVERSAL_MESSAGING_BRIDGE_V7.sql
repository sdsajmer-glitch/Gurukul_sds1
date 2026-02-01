
-- ==============================================================================
-- UNIVERSAL MESSAGING BRIDGE (V7)
-- ==============================================================================
-- 1. Full Transparency: Ensures admins see all messages for their branch.
-- 2. Security Definer Overrides: Guarantees delivery even with complex RLS.
-- 3. Branch Continuity: Handles NULL branch records for master administrators.
-- ==============================================================================

BEGIN;

-- 1. FORCE RLS POLICIES FOR ENQUIRY MESSAGES
ALTER TABLE public.enquiry_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enquiry Messages: Global Auth Access" ON public.enquiry_messages;
CREATE POLICY "Enquiry Messages: Global Auth Access" ON public.enquiry_messages
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = enquiry_messages.enquiry_id
        AND (
            -- Admin Check: Can see if it's their branch OR they are a school admin
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.id = auth.uid() 
                AND p.role IN ('school_admin', 'admin', 'branch_admin')
                AND (p.branch_id = e.branch_id OR p.role = 'school_admin' OR e.branch_id IS NULL)
            )
            OR
            -- Parent Check: Can see if it's their record
            (e.user_id = auth.uid())
            OR
            (LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid()))
            OR
            (LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email'))
        )
    )
);

-- 2. ROBUST TIMELINE FETCH (Unified for both roles)
CREATE OR REPLACE FUNCTION public.get_enquiry_timeline_v3(p_enquiry_id text)
RETURNS TABLE (
    id uuid,
    item_type text,
    created_at timestamptz,
    created_by_name text,
    is_admin boolean,
    details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enquiry_uuid uuid;
BEGIN
    -- Standardize input
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    RETURN QUERY
    -- A. Message Handshakes (Sorted by pulse)
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, CASE WHEN m.is_admin THEN 'System Authority' ELSE 'Identity Node' END) as created_by_name,
        COALESCE(m.is_admin, false) as is_admin,
        jsonb_build_object('message', m.message) as details
    FROM public.enquiry_messages m
    LEFT JOIN public.profiles p ON m.sender_id = p.id
    WHERE m.enquiry_id = v_enquiry_uuid

    UNION ALL

    -- B. System Pulse (Creation)
    SELECT
        e.id,
        'ENQUIRY_RECEIVED'::text as item_type,
        e.received_at as created_at,
        'System'::text as created_by_name,
        true as is_admin,
        jsonb_build_object('status', 'Identity Received', 'applicant', e.applicant_name) as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at DESC;
END;
$$;

-- 3. UNIFIED MESSAGE INJECTION
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
BEGIN
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid Identity Node format.');
    END;

    -- Determine Role for metadata
    SELECT (role IN ('school_admin', 'admin', 'branch_admin'))
    INTO v_is_admin
    FROM public.profiles
    WHERE id = auth.uid();

    -- Commit Payload
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

    -- Update Master Ledger Pulse
    UPDATE public.enquiries SET updated_at = now() WHERE id = v_enquiry_uuid;

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;

SELECT 'SUCCESS: Universal Messaging Bridge (V7) Deployed.' as status;
