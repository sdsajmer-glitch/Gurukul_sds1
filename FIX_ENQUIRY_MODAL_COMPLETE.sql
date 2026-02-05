-- ==============================================================================
-- FIX ENQUIRY DETAILS MODAL (TIMELINE & MESSAGING)
-- ==============================================================================
-- Resolves the "Unable to show enquiry details modal" issue.
-- Recreates the specific V3 RPCs required by the frontend component.

BEGIN;

-- 1. Ensure Messages Table Exists
CREATE TABLE IF NOT EXISTS public.enquiry_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    enquiry_id uuid NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES auth.users(id),
    message text NOT NULL,
    is_admin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    is_read boolean DEFAULT false,
    -- Legacy support
    is_admin_message boolean DEFAULT false
);

-- 2. GET ENUIRY TIMELINE V3
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
AS $$
DECLARE
    v_enquiry_uuid uuid;
BEGIN
    -- Safe cast to UUID
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN; -- Invalid ID, return empty
    END;

    RETURN QUERY
    
    -- 1. MESSAGES
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, 'Unknown User') as created_by_name,
        COALESCE(m.is_admin, false) as is_admin,
        jsonb_build_object('message', m.message) as details
    FROM public.enquiry_messages m
    LEFT JOIN public.profiles p ON m.sender_id = p.id
    WHERE m.enquiry_id = v_enquiry_uuid

    UNION ALL

    -- 2. ENQUIRY CREATION EVENT
    SELECT
        e.id,
        'ENQUIRY_RECEIVED'::text as item_type,
        e.received_at as created_at,
        'System'::text as created_by_name,
        true as is_admin,
        jsonb_build_object('status', 'Received') as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at ASC; -- Frontend sorts it, but ASC is logical
END;
$$;


-- 3. SEND ENQUIRY MESSAGE V3
CREATE OR REPLACE FUNCTION public.send_enquiry_message_v3(
    p_enquiry_id text,
    p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_enquiry_uuid uuid;
    v_sender_id uuid;
    v_is_admin boolean;
BEGIN
    v_sender_id := auth.uid();
    
    -- Validate ID
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid ID format');
    END;

    -- Determine if sender is admin (simplified check)
    -- You can adjust the role check as per your exact role names
    SELECT EXISTS (
        SELECT 1 FROM public.school_branches sb WHERE sb.school_user_id = v_sender_id OR sb.branch_admin_id = v_sender_id
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_sender_id AND role IN ('School Administration', 'Branch Admin', 'Super Admin')
    )
    INTO v_is_admin;

    -- Insert Message
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
        v_is_admin,
        v_is_admin
    );

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 4. GRANT PERMISSIONS
GRANT SELECT, INSERT ON public.enquiry_messages TO authenticated;
GRANT SELECT, INSERT ON public.enquiry_messages TO service_role;

GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v3(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v3(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.send_enquiry_message_v3(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_enquiry_message_v3(text, text) TO service_role;

COMMIT;
