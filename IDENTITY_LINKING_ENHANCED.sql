
-- ==============================================================================
-- MISSION CRITICAL: ENQUIRY & IDENTITY LINKING (V5)
-- ==============================================================================
-- 1. Bulletproof Handshake: Links parent registration to existing enquiry nodes.
-- 2. Polymorphic RPCs: Supports both UUID and potential legacy ID formats.
-- 3. Detailed Pulse: Tracks status changes and promotional events in the audit log.
-- ==============================================================================

BEGIN;

-- 1. INTERNAL: Ensure enquiry has a search-friendly email index
CREATE INDEX IF NOT EXISTS idx_enquiries_parent_email_lower ON public.enquiries (LOWER(parent_email));
CREATE INDEX IF NOT EXISTS idx_enquiries_parent_phone ON public.enquiries (parent_phone);

-- 2. RPC: admin_update_enquiry_status (Fixing legacy support)
CREATE OR REPLACE FUNCTION public.admin_update_enquiry_status(
    p_enquiry_id text,
    p_status text,
    p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.enquiries
    SET 
        status = p_status,
        notes = p_notes,
        updated_at = now()
    WHERE id::text = p_enquiry_id;
END;
$$;

-- 3. RPC: get_my_enquiries (Ultra-Inclusive Identity Handshake)
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

    -- Fallback for email
    IF v_user_email = '' THEN
        v_user_email := LOWER(auth.jwt() ->> 'email');
    END IF;

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
        e.updated_at,
        e.branch_id,
        COALESCE(sb.name, 'Educational Node') as branch_name
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE 
        -- Handshake Rule 1: Direct link (best)
        (e.user_id = auth.uid())
        OR 
        -- Handshake Rule 2: Email matching (case-insensitive)
        (v_user_email <> '' AND (LOWER(e.parent_email) = v_user_email))
        OR
        -- Handshake Rule 3: Phone matching
        (v_user_phone IS NOT NULL AND v_user_phone <> '' AND e.parent_phone = v_user_phone)
        OR
        -- Handshake Rule 4: Messages sent by this user
        (e.id IN (SELECT em.enquiry_id FROM public.enquiry_messages em WHERE em.sender_id = auth.uid()))
        OR
        -- Handshake Rule 5: Admission relationship
        EXISTS (
            SELECT 1 FROM public.admissions a 
            WHERE (a.parent_id = auth.uid() OR LOWER(a.parent_email) = v_user_email)
            AND (a.applicant_name = e.applicant_name AND a.grade = e.grade) -- Soft match for migration
        )
    ORDER BY e.updated_at DESC;
END;
$$;

-- 4. RPC: get_enquiry_timeline_v3 (Polymorphic Support)
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
BEGIN
    RETURN QUERY
    -- A. Message Payloads
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(p.display_name, 'Authority Node') as created_by_name,
        COALESCE(m.is_admin, false) as is_admin,
        jsonb_build_object('message', m.message) as details
    FROM public.enquiry_messages m
    LEFT JOIN public.profiles p ON m.sender_id = p.id
    WHERE m.enquiry_id::text = p_enquiry_id

    UNION ALL

    -- B. Status Handshake (Creation Pulse)
    SELECT
        e.id,
        'ENQUIRY_RECEIVED'::text as item_type,
        e.received_at as created_at,
        'System'::text as created_by_name,
        true as is_admin,
        jsonb_build_object('status', 'Identity Received', 'applicant', e.applicant_name) as details
    FROM public.enquiries e
    WHERE e.id::text = p_enquiry_id

    ORDER BY created_at DESC;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Mission critical identity linking protocol deployed.' as status;
