-- ==============================================================================
-- CONSOLIDATED FIX: ENQUIRY DESK & ADMISSION VAULT SYNC
-- ==============================================================================
-- Resolves: 
-- 1. "column e.profile_photo_url does not exist" in Enquiry Desk
-- 2. "Could not find the function public.get_admissions_v2" in Admission Vault
-- 3. Ensures consistent RPC signatures and permissions

BEGIN;

-- Part 1: Enquiry Infrastructure & Registry Sync
--------------------------------------------------------------------------------

-- Ensure profile_photo_url exists on public.enquiries
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS profile_photo_url text;

-- Sync get_all_enquiries_v2
DROP FUNCTION IF EXISTS public.get_all_enquiries_v2(bigint);
DROP FUNCTION IF EXISTS public.get_all_enquiries_v2(integer);

CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id bigint DEFAULT NULL)
RETURNS TABLE (
    id uuid,
    updated_at timestamp with time zone,
    admission_id uuid,
    user_id uuid,
    applicant_name text,
    parent_name text,
    parent_email text,
    parent_phone text,
    grade text,
    branch_id bigint,
    status text,
    notes text,
    received_at timestamp with time zone,
    profile_photo_url text,
    conversion_state text,
    enquiry_code text,
    verification_status text,
    is_archived boolean,
    is_deleted boolean,
    converted_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.updated_at,
        e.admission_id,
        e.user_id,
        e.applicant_name,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.grade,
        e.branch_id,
        e.status,
        e.notes,
        e.received_at,
        COALESCE(a.profile_photo_url, e.profile_photo_url) as profile_photo_url,
        e.conversion_state,
        e.enquiry_code,
        e.verification_status,
        e.is_archived,
        e.is_deleted,
        e.converted_at
    FROM public.enquiries e
    LEFT JOIN public.admissions a ON e.admission_id = a.id
    WHERE 
        (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        AND e.is_deleted = false
    ORDER BY e.updated_at DESC;
END;
$$;

-- Part 2: Admission Vault Sync
--------------------------------------------------------------------------------

-- Sync get_admissions_v2
DROP FUNCTION IF EXISTS public.get_admissions_v2(bigint);
DROP FUNCTION IF EXISTS public.get_admissions_v2(integer);

CREATE OR REPLACE FUNCTION public.get_admissions_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.admissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT a.*
    FROM public.admissions a
    WHERE 
        (p_branch_id IS NULL OR a.branch_id = p_branch_id)
    ORDER BY a.submitted_at DESC;
END;
$$;

-- Part 3: Enquiry Timeline Sync
--------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_enquiry_timeline_v4(text);

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
    -- UUID Safety Handshake
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

-- Part 4: Permissions & Global Refresh
--------------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admissions_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admissions_v2(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v4(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enquiry_timeline_v4(text) TO service_role;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT 'SUCCESS: Enrollment modules synchronization complete.' as status;
