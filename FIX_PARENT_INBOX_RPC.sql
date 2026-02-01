-- ==============================================================================
-- FIX PARENT INBOX RPC
-- ==============================================================================
-- Defines the missing RPC functions used in the Parent Portal MessagesTab.
-- 1. get_my_enquiries: Returns enquiries linked to the parent.
-- 2. get_my_messages: Returns broadcasts/announcements (communications) for the parent.

-- ------------------------------------------------------------------------------
-- 1. GET MY ENQUIRIES
-- ------------------------------------------------------------------------------
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
BEGIN
    -- Resolve current user email from all available sources
    v_user_email := LOWER(COALESCE(
        (SELECT email FROM public.profiles WHERE id = auth.uid()),
        (SELECT auth.jwt() ->> 'email'),
        ''
    ));

    RETURN QUERY
    SELECT 
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
        COALESCE(sb.name, 'Main Branch') as branch_name
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE 
        (e.user_id = auth.uid())
        OR 
        (v_user_email <> '' AND LOWER(e.parent_email) = v_user_email)
        OR
        (e.id IN (
            SELECT em.enquiry_id FROM public.enquiry_messages em WHERE em.sender_id = auth.uid()
        ))
        OR
        (e.admission_id IN (
            SELECT a.id FROM public.admissions a 
            WHERE a.parent_id = auth.uid() 
            OR (v_user_email <> '' AND LOWER(a.parent_email) = v_user_email)
        ))
    ORDER BY e.updated_at DESC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. GET MY MESSAGES (Broadcasts)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_messages()
RETURNS TABLE (
    id bigint,
    subject text,
    body text,
    sent_at timestamptz,
    sender_name text,
    status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_email text;
BEGIN
    v_user_email := LOWER(COALESCE(
        (SELECT email FROM public.profiles WHERE id = auth.uid()),
        (SELECT auth.jwt() ->> 'email'),
        ''
    ));

    RETURN QUERY
    SELECT 
        c.id,
        c.subject,
        c.body,
        c.sent_at,
        c.sender_name,
        c.status
    FROM public.communications c
    WHERE 
        -- Logic: if recipients is null or empty, it's global; otherwise check if parent email matches
        (c.recipients IS NULL OR array_length(c.recipients, 1) IS NULL)
        OR
        (v_user_email <> '' AND v_user_email = ANY(
            SELECT LOWER(r) FROM unnest(c.recipients) r
        ))
    ORDER BY c.sent_at DESC;
END;
$$;
