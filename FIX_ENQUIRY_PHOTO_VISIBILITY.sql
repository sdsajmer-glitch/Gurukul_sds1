-- ==============================================================================
-- ENQUIRY PHOTO VISIBILITY ENHANCEMENT (ROBUST VERSION)
-- ==============================================================================

BEGIN;

-- 1. Ensure profile_photo_url exists on enquiries table
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS profile_photo_url text;

-- 2. Update get_all_enquiries_v2 to include profile_photo_url
-- We use RETURNS SETOF public.enquiries to maintain full schema compatibility
CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.enquiries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.branch_id,
        e.user_id,
        e.enquiry_code,
        e.applicant_name,
        e.grade,
        e.status,
        e.verification_status,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.notes,
        e.conversion_state,
        e.admission_id,
        e.is_archived,
        e.is_deleted,
        e.received_at,
        e.updated_at,
        e.converted_at,
        COALESCE(p.profile_photo_url, e.profile_photo_url) as profile_photo_url
    FROM public.enquiries e
    LEFT JOIN public.profiles p ON e.user_id = p.id
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE 
        (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        AND e.is_deleted = false
        AND (
            sb.school_user_id = auth.uid() 
            OR sb.branch_admin_id = auth.uid()
            OR e.branch_id IS NULL
        )
    ORDER BY e.received_at DESC;
END;
$$;

-- 3. Update get_enquiry_timeline_v4 to include sender_photo_url
CREATE OR REPLACE FUNCTION public.get_enquiry_timeline_v4(p_enquiry_id text)
RETURNS TABLE (
    id uuid,
    item_type text,
    created_at timestamptz,
    created_by_name text,
    is_admin boolean,
    details jsonb,
    sender_photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enquiry_uuid uuid;
BEGIN
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    RETURN QUERY
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, p.email, 'Unknown User') as created_by_name,
        COALESCE(m.is_admin, false) as is_admin,
        jsonb_build_object('message', m.message) as details,
        p.profile_photo_url as sender_photo_url
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
        jsonb_build_object('status', 'Received') as details,
        NULL::text as sender_photo_url
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v4(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v4(text) TO service_role;

COMMIT;
