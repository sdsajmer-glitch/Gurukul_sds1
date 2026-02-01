
-- ==============================================================================
-- ENQUIRY MESSAGING: RLS & RPC ARCHITECTURE (V4)
-- ==============================================================================
-- Targets: enquiry_messages, enquiries
-- Logic: Secure multi-role access for parents and admins.
-- ==============================================================================

BEGIN;

-- 1. DATA ISOLATION: TABLE CONFIGURATION
ALTER TABLE public.enquiry_messages ENABLE ROW LEVEL SECURITY;

-- 2. RLS POLICIES for public.enquiry_messages
DROP POLICY IF EXISTS "Enquiry messages: Parent access" ON public.enquiry_messages;
CREATE POLICY "Enquiry messages: Parent access" ON public.enquiry_messages
FOR SELECT TO authenticated
USING (
    enquiry_id IN (
        SELECT id FROM public.enquiries 
        WHERE user_id = auth.uid() 
        OR LOWER(parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
        OR LOWER(parent_email) = (SELECT LOWER(auth.jwt() ->> 'email'))
    )
);

DROP POLICY IF EXISTS "Enquiry messages: Admin access" ON public.enquiry_messages;
CREATE POLICY "Enquiry messages: Admin access" ON public.enquiry_messages
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.enquiries e ON e.branch_id = p.branch_id
        WHERE p.id = auth.uid() 
        AND p.role IN ('school_admin', 'admin', 'branch_admin')
        AND e.id = enquiry_messages.enquiry_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.enquiries e ON e.branch_id = p.branch_id
        WHERE p.id = auth.uid() 
        AND p.role IN ('school_admin', 'admin', 'branch_admin')
        AND e.id = enquiry_messages.enquiry_id
    )
);

-- 3. RLS POLICIES for public.enquiries (Messaging overlap)
DROP POLICY IF EXISTS "Enquiries: Message sender access" ON public.enquiries;
CREATE POLICY "Enquiries: Message sender access" ON public.enquiries
FOR SELECT TO authenticated
USING (
    id IN (
        SELECT enquiry_id FROM public.enquiry_messages WHERE sender_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 4. RPC: GET ENQUIRY TIMELINE (Security Definer)
-- ------------------------------------------------------------------------------
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
    v_user_role text;
    v_has_access boolean := false;
BEGIN
    -- 1. Validate UUID
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    -- 2. Authorization Check
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

    IF v_user_role IN ('school_admin', 'admin', 'branch_admin') THEN
        -- Admin Access Check: Must match branch
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            JOIN public.profiles p ON p.branch_id = e.branch_id
            WHERE e.id = v_enquiry_uuid AND p.id = auth.uid()
        ) INTO v_has_access;
    ELSE
        -- Parent Access Check: Must own enquiry
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = auth.uid() 
                OR LOWER(e.parent_email) = LOWER(COALESCE((SELECT email FROM public.profiles WHERE id = auth.uid()), (SELECT auth.jwt() ->> 'email'), ''))
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN;
    END IF;

    RETURN QUERY
    -- A. Message Payloads
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, 'Institutional Authority') as created_by_name,
        COALESCE(m.is_admin, false) as is_admin,
        jsonb_build_object('message', m.message) as details
    FROM public.enquiry_messages m
    LEFT JOIN public.profiles p ON m.sender_id = p.id
    WHERE m.enquiry_id = v_enquiry_uuid

    UNION ALL

    -- B. Status Handshake (Creation)
    SELECT
        e.id,
        'ENQUIRY_RECEIVED'::text as item_type,
        e.received_at as created_at,
        'System'::text as created_by_name,
        true as is_admin,
        jsonb_build_object('status', 'Identity Decrypted', 'context', e.applicant_name) as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at DESC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC: SEND ENQUIRY MESSAGE (Security Definer)
-- ------------------------------------------------------------------------------
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
BEGIN
    -- 1. Validate UUID
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid node identifier');
    END;

    -- 2. Validate Identity
    SELECT (role IN ('school_admin', 'admin', 'branch_admin'))
    INTO v_is_admin
    FROM public.profiles
    WHERE id = auth.uid();

    -- 3. Access Validation
    IF v_is_admin THEN
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            JOIN public.profiles p ON p.branch_id = e.branch_id
            WHERE e.id = v_enquiry_uuid AND p.id = auth.uid()
        ) INTO v_has_access;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = auth.uid() 
                OR LOWER(e.parent_email) = LOWER(COALESCE((SELECT email FROM public.profiles WHERE id = auth.uid()), (SELECT auth.jwt() ->> 'email'), ''))
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied: Node Handshake Refused');
    END IF;

    -- 4. Commit Message
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
        v_is_admin,
        v_is_admin
    );

    -- 5. Update Enquiry Activity
    UPDATE public.enquiries 
    SET updated_at = now() 
    WHERE id = v_enquiry_uuid;

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;

SELECT 'SUCCESS: Enquiry Messaging Architecture (RLS + RPC) Deployed' as status;
