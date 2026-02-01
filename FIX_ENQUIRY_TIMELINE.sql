-- ==============================================================================
-- FIX ENQUIRY TIMELINE & MESSAGING
-- ==============================================================================
-- Defines the missing RPC functions required by the EnquiryDetailsModal.
-- 1. get_enquiry_timeline_v3: Retrieves messages and status history.
-- 2. send_enquiry_message_v3: Allows sending messages (admin/parent).

-- ------------------------------------------------------------------------------
-- 1. GET ENQUIRY TIMELINE V3
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

    -- 2. CREATION EVENT (From Enquiry Record)
    SELECT
        e.id,
        'ENQUIRY_RECEIVED'::text as item_type,
        e.received_at as created_at,
        'System'::text as created_by_name,
        true as is_admin,
        jsonb_build_object('status', 'Received') as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at DESC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. SEND ENQUIRY MESSAGE V3
-- ------------------------------------------------------------------------------
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

    -- Determine if sender is admin
    SELECT COALESCE(is_super_admin, false) OR (role IN ('school_admin', 'admin'))
    INTO v_is_admin
    FROM public.profiles
    WHERE id = v_sender_id;

    -- Insert Message
    INSERT INTO public.enquiry_messages (
        enquiry_id,
        sender_id,
        message,
        is_admin,
        is_admin_message -- Maintain legacy column if needed
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
