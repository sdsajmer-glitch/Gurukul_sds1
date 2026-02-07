
-- ==============================================================================
-- MISSION CRITICAL: MESSAGING ACCESS PROTOCOL (V7)
-- ==============================================================================
-- 1. Unified Role Mapping: Supports snake_case and Title Case roles.
-- 2. Authorization Handshake: Ensures global admins can access all nodes.
-- 3. Exception Handling: Maintains RAISE EXCEPTION for clean frontend alerts.
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
#variable_conflict use_column
DECLARE
    v_enquiry_uuid uuid;
    v_is_admin boolean;
    v_has_access boolean := false;
    v_user_role text;
    v_user_email text;
BEGIN
    -- [1] Validate UUID
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid identity node identifier format.';
    END;

    -- [2] Role Resolution
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    
    v_is_admin := v_user_role IN (
        'School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Admin', 
        'Teacher', 'Academic Coordinator', 'HR Manager',
        'school_admin', 'admin', 'branch_admin', 'principal', 'teacher'
    );

    -- [3] Access Validation
    IF v_is_admin THEN
        -- Admin Access: Global admins (School Admin/Super Admin/Principal) see all. Others match by branch.
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            LEFT JOIN public.profiles p ON p.id = auth.uid()
            WHERE e.id = v_enquiry_uuid 
            AND (
                p.branch_id = e.branch_id 
                OR p.role IN ('School Administration', 'Super Admin', 'Principal', 'school_admin', 'super_admin', 'principal')
            )
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
        RAISE EXCEPTION 'Access Denied: Node Handshake Refused. You do not have permission to message this record. (Role identified: %)', COALESCE(v_user_role, 'Unknown');
    END IF;

    -- [4] Commit Payload
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

    -- [5] Pulse update
    UPDATE public.enquiries 
    SET updated_at = now() 
    WHERE id = v_enquiry_uuid;

    RETURN jsonb_build_object('success', true);
END;
$$;

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
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

    -- [3] Access Validation
    IF v_user_role IN (
        'School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Admin', 
        'Teacher', 'Academic Coordinator', 'HR Manager',
        'school_admin', 'admin', 'branch_admin', 'principal', 'teacher'
    ) THEN
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            LEFT JOIN public.profiles p ON p.id = auth.uid()
            WHERE e.id = v_enquiry_uuid 
            AND (
                p.branch_id = e.branch_id 
                OR p.role IN ('School Administration', 'Super Admin', 'Principal', 'school_admin', 'super_admin', 'principal')
            )
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

COMMIT;

SELECT 'SUCCESS: Messaging access protocol V7 deployed (RAISE EXCEPTION logic maintained).' as status;
