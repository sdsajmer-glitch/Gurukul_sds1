
-- ==============================================================================
-- UNIVERSAL MESSAGING BRIDGE (V9) - COMMUNICATION RESTORATION
-- ==============================================================================
-- Targets: enquiry_messages, enquiries, profiles
-- Fixes: Role string mismatches, parent skeletal profiles, and RLS isolation.
-- ==============================================================================

BEGIN;

-- 1. ENQUIRIES: AUTHORITATIVE RLS (Fixed for "School Administration")
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enquiries: Auth Access" ON public.enquiries;
DROP POLICY IF EXISTS "Enquiries: Global Access Protocol" ON public.enquiries;
CREATE POLICY "Enquiries: Global Access Protocol" ON public.enquiries
FOR SELECT TO authenticated
USING (
    -- Admin Access: Match by role and branch scope
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
        AND (
            LOWER(p.role) IN ('school_admin', 'admin', 'branch_admin', 'school administration', 'super admin')
            OR p.role IN ('School Administration', 'Branch Admin', 'Admin', 'Super Admin')
        )
        AND (
            p.branch_id = enquiries.branch_id 
            OR p.role IN ('School Administration', 'Super Admin', 'school_admin') 
            OR enquiries.branch_id IS NULL
        )
    )
    OR
    -- Parent Access: Match by user_id or email
    (user_id = auth.uid())
    OR
    (LOWER(parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid()))
    OR
    (LOWER(parent_email) = LOWER(auth.jwt() ->> 'email'))
);

-- 2. ENQUIRY MESSAGES: AUTHORITATIVE RLS
ALTER TABLE public.enquiry_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enquiry Messages: Auth Access" ON public.enquiry_messages;
DROP POLICY IF EXISTS "Enquiry Messages: Global Access Protocol" ON public.enquiry_messages;
CREATE POLICY "Enquiry Messages: Global Access Protocol" ON public.enquiry_messages
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = enquiry_messages.enquiry_id
        -- Re-use the enquiry logic to ensure consistent visibility
        AND (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.id = auth.uid() 
                AND (
                    LOWER(p.role) IN ('school_admin', 'admin', 'branch_admin', 'school administration', 'super admin')
                    OR p.role IN ('School Administration', 'Branch Admin', 'Admin', 'Super Admin')
                )
                AND (p.branch_id = e.branch_id OR p.role IN ('School Administration', 'Super Admin', 'school_admin') OR e.branch_id IS NULL)
            )
            OR (e.user_id = auth.uid())
            OR (LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid()))
            OR (LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email'))
        )
    )
);

-- 3. UNIFIED RPC: SEND MESSAGE V3 (With Parent Protection)
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
    v_is_admin boolean;
    v_user_email text;
BEGIN
    -- Validate ID
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid enquiry identifier format.');
    END;

    v_sender_id := auth.uid();
    IF v_sender_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated.'); END IF;

    -- Determine Admin Status (Case Insensitive Role Match)
    SELECT (LOWER(role) IN ('school_admin', 'admin', 'branch_admin', 'school administration', 'super admin'))
    INTO v_is_admin
    FROM public.profiles
    WHERE id = v_sender_id;

    -- SKELETAL PROFILE INJECTION: Prevent FK violation if parent profile is not yet created
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_sender_id) THEN
        v_user_email := LOWER(auth.jwt() ->> 'email');
        INSERT INTO public.profiles (id, email, role, profile_completed)
        VALUES (v_sender_id, COALESCE(v_user_email, 'legacy@unspecified.node'), 'Parent/Guardian', false);
    END IF;

    -- Insert Payload
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

    -- Heartbeat Update
    UPDATE public.enquiries SET updated_at = now() WHERE id = v_enquiry_uuid;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. UNIFIED RPC: GET TIMELINE V3
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
    v_enquiry_uuid := p_enquiry_id::uuid;

    RETURN QUERY
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

COMMIT;

SELECT 'SUCCESS: Universal Messaging Bridge (V9) Deployed and Communicaton Restored.' as status;
