-- ==============================================================================
-- COMPREHENSIVE ENQUIRY SYSTEM FIX
-- ==============================================================================
-- Re-establishes all required RPCs for the Enquiry Tab & Modal.

BEGIN;

-- 1. FIX: Update Enquiry Status RPC
CREATE OR REPLACE FUNCTION public.admin_update_enquiry_status(
    p_enquiry_id text,
    p_status text,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
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
        RETURN jsonb_build_object('success', false, 'error', 'Invalid Enquiry ID format');
    END;

    UPDATE public.enquiries
    SET 
        status = p_status,
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = v_enquiry_uuid;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Enquiry record not found');
    END IF;

    -- Log the change if needed
    -- (Add logging here if you have an audit table)

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. ENSURE: Timeline V3 supports more event types and returns robust names
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
        RETURN; 
    END;

    RETURN QUERY
    
    -- Messages
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, 'School Official') as created_by_name,
        COALESCE(m.is_admin, false) as is_admin,
        jsonb_build_object('message', m.message) as details
    FROM public.enquiry_messages m
    LEFT JOIN public.profiles p ON m.sender_id = p.id
    WHERE m.enquiry_id = v_enquiry_uuid

    UNION ALL

    -- Reception Event
    SELECT
        e.id,
        'ENQUIRY_RECEIVED'::text as item_type,
        e.received_at as created_at,
        'Identity Node'::text as created_by_name,
        false as is_admin,
        jsonb_build_object('status', e.status) as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at ASC;
END;
$$;

-- 3. GRANTS
GRANT EXECUTE ON FUNCTION public.admin_update_enquiry_status(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_enquiry_status(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v3(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v3(text) TO service_role;

COMMIT;
