-- ==============================================================================
-- FIX: ENQUIRY TIMELINE AMBIGUITY RESOLUTION
-- ==============================================================================
-- Resolves: "column reference 'id' is ambiguous"
-- This error occurs because the output table has a column 'id' which 
-- shadows table columns in WHERE clauses.
-- ==============================================================================

BEGIN;

-- 1. FIX: get_enquiry_timeline_v4
CREATE OR REPLACE FUNCTION public.get_enquiry_timeline_v4(p_enquiry_id text)
RETURNS TABLE (
    id uuid,
    item_type text,
    created_at timestamptz,
    created_by_name text,
    created_by_email text,
    sender_photo_url text,
    is_admin boolean,
    details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_enquiry_uuid uuid;
    v_user_role text;
    v_has_access boolean := false;
BEGIN
    -- [1] Identity Identification
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    -- [2] Role Resolution
    SELECT role INTO v_user_role FROM public.profiles WHERE profiles.id = auth.uid();

    -- [3] Access Validation
    IF v_user_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher') THEN
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
                OR LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE profiles.id = auth.uid())
                OR LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email')
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN;
    END IF;

    -- [4] Registry Payload Assembly
    RETURN QUERY
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, 'Authority Node') as created_by_name,
        p.email as created_by_email,
        p.profile_photo_url as sender_photo_url,
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
        'system'::text as created_by_email,
        NULL::text as sender_photo_url,
        true as is_admin,
        jsonb_build_object('status', 'Identity Decrypted', 'context', e.applicant_name) as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at ASC;
END;
$$;

-- 2. FIX: get_enquiry_timeline_v3
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
#variable_conflict use_column
DECLARE
    v_enquiry_uuid uuid;
    v_user_role text;
    v_has_access boolean := false;
BEGIN
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    SELECT role INTO v_user_role FROM public.profiles WHERE profiles.id = auth.uid();

    IF v_user_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher') THEN
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
                OR LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE profiles.id = auth.uid())
                OR LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email')
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, 'Authority Node') as created_by_name,
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
        jsonb_build_object('status', 'Identity Decrypted', 'context', e.applicant_name) as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at ASC;
END;
$$;

-- 3. FIX: send_enquiry_message_v3
CREATE OR REPLACE FUNCTION public.send_enquiry_message_v3(
    p_enquiry_id text,
    p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_enquiry_uuid uuid;
    v_is_admin boolean;
    v_has_access boolean := false;
    v_user_role text;
BEGIN
    -- [1] Identity Identification
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid identity node identifier');
    END;

    -- [2] Role Resolution
    SELECT role INTO v_user_role FROM public.profiles WHERE profiles.id = auth.uid();
    v_is_admin := v_user_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher');

    -- [3] Access Validation
    IF v_is_admin THEN
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            LEFT JOIN public.profiles p ON p.id = auth.uid()
            WHERE e.id = v_enquiry_uuid 
            AND (p.branch_id = e.branch_id OR p.role IN ('School Administration', 'Super Admin', 'Principal'))
        ) INTO v_has_access;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = auth.uid() 
                OR LOWER(e.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE profiles.id = auth.uid())
                OR LOWER(e.parent_email) = LOWER(auth.jwt() ->> 'email')
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied: Node Handshake Refused');
    END IF;

    -- [4] Payload Insertion
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

    -- [5] Pulse Update
    UPDATE public.enquiries SET updated_at = now() WHERE id = v_enquiry_uuid;

    RETURN jsonb_build_object('success', true, 'message', 'Transmission successful');
END;
$$;

COMMIT;

SELECT 'SUCCESS: Ambiguous id references resolved in messaging RPCs.' as status;
