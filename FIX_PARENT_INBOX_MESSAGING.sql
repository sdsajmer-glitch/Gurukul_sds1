-- ==============================================================================
-- MASTER FIX: PARENT INBOX & ENQUIRY MESSAGING (V5)
-- ==============================================================================
-- Resolves: 
-- 1. Parents unable to send/receive messages due to restrictive/broken RLS.
-- 2. Admins blocked from messaging parents due to mismatched role names.
-- 3. Inbox "Channel Standby" stuck state.
-- ==============================================================================

BEGIN;

-- 1. IDENTIFY ROLES (Normalization)
-- We will use the authoritative roles from types.ts
-- 'School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher', 'Parent/Guardian'

-- 2. ENQUIRY MESSAGES: TABLE REINFORCEMENT
ALTER TABLE public.enquiry_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES: enquiry_messages
DROP POLICY IF EXISTS "Enquiry messages: Parent access" ON public.enquiry_messages;
DROP POLICY IF EXISTS "Enquiry messages: Admin access" ON public.enquiry_messages;
DROP POLICY IF EXISTS "Enquiry Messages: Auth Access" ON public.enquiry_messages;

-- Policy for SELECT: Allow access if you have access to the parent enquiry
CREATE POLICY "Enquiry messages: SELECT for Auth Users" ON public.enquiry_messages
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = enquiry_messages.enquiry_id
        AND (
            -- Admin Path
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.id = auth.uid() 
                AND p.role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher')
                AND (p.branch_id = e.branch_id OR p.role IN ('School Administration', 'Super Admin'))
            )
            OR
            -- Parent Path
            (e.user_id = auth.uid())
            OR
            (LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid()))
            OR
            (LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email'))
        )
    )
);

-- Policy for INSERT (Standard RLS)
-- Note: Function is SECURITY DEFINER, but RLS on table is good for safety if we use direct Supabase calls
CREATE POLICY "Enquiry messages: INSERT for Auth Users" ON public.enquiry_messages
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = enquiry_messages.enquiry_id
        AND (
            -- Admin
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.id = auth.uid() 
                AND p.role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal')
            )
            OR
            -- Parent
            (e.user_id = auth.uid())
            OR
            (LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid()))
        )
    )
);

-- 4. RPC: get_my_enquiries (Enhanced for Parent Inbox)
CREATE OR REPLACE FUNCTION public.get_my_enquiries()
RETURNS TABLE (
    id uuid,
    applicant_name text,
    parent_name text,
    parent_email text,
    parent_phone text,
    grade text,
    status text, 
    updated_at timestamptz,
    branch_id bigint,
    branch_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_email text;
    v_user_phone text;
BEGIN
    -- Resolve current user identity
    SELECT 
        LOWER(COALESCE(p.email, auth.jwt() ->> 'email', '')),
        p.phone
    INTO v_user_email, v_user_phone
    FROM public.profiles p
    WHERE p.id = auth.uid();

    RETURN QUERY
    SELECT DISTINCT
        e.id,
        e.applicant_name,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.grade,
        CASE 
            WHEN e.status NOT LIKE 'ENQUIRY_%' THEN 'ENQUIRY_' || e.status
            ELSE e.status
        END as status,
        COALESCE(e.updated_at, e.received_at) as updated_at,
        e.branch_id,
        COALESCE(sb.name, 'Educational Node') as branch_name
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE 
        (e.user_id = auth.uid())
        OR 
        (v_user_email <> '' AND (LOWER(e.parent_email) = v_user_email))
        OR
        (v_user_phone IS NOT NULL AND v_user_phone <> '' AND e.parent_phone = v_user_phone)
        OR
        (e.id IN (SELECT em.enquiry_id FROM public.enquiry_messages em WHERE em.sender_id = auth.uid()))
    ORDER BY updated_at DESC;
END;
$$;

-- 5. RPC: get_enquiry_timeline_v3 (Resilient Identity Resolution)
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
    -- [A] ID Resolution
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    -- [B] Authorization Check (Strict but Inclusive)
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

    IF v_user_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher') THEN
        -- Admin Access Check: Must match branch or be Global Admin
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            LEFT JOIN public.profiles p ON p.id = auth.uid()
            WHERE e.id = v_enquiry_uuid 
            AND (p.branch_id = e.branch_id OR p.role IN ('School Administration', 'Super Admin'))
        ) INTO v_has_access;
    ELSE
        -- Parent Access Check: Must own enquiry or match email
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = auth.uid() 
                OR LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
                OR LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email')
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN;
    END IF;

    RETURN QUERY
    -- 1. Message Stream
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

    -- 2. Registry Event (Creation)
    SELECT
        e.id,
        'ENQUIRY_RECEIVED'::text as item_type,
        e.received_at as created_at,
        'System'::text as created_by_name,
        true as is_admin,
        jsonb_build_object('status', 'Identity Decrypted', 'context', e.applicant_name) as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at ASC; -- Sorted Oldest -> Newest for correct chat flow
END;
$$;

-- 6. RPC: send_enquiry_message_v3 (Secure Handshake Commit)
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
    v_user_role text;
BEGIN
    -- [A] Identity Identification
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid identity node identifier');
    END;

    -- [B] Role Resolution
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    v_is_admin := v_user_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher');

    -- [C] Access Validation
    IF v_is_admin THEN
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            LEFT JOIN public.profiles p ON p.id = auth.uid()
            WHERE e.id = v_enquiry_uuid 
            AND (p.branch_id = e.branch_id OR p.role IN ('School Administration', 'Super Admin'))
        ) INTO v_has_access;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = auth.uid() 
                OR LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
                OR LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email')
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Identity Handshake Denied');
    END IF;

    -- [D] Payload Insertion
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

    -- [E] Pulse Update
    UPDATE public.enquiries SET updated_at = now() WHERE id = v_enquiry_uuid;

    RETURN jsonb_build_object('success', true, 'message', 'Transmission successful');
END;
$$;

-- 7. GRANTS
GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v3(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_enquiry_message_v3(text, text) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Parent Inbox & Enquiry Messaging Protocol V5 Deployed.' as status;
