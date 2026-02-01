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
    status text, -- This should match EnquiryStatus in frontend
    updated_at timestamptz,
    branch_id bigint,
    branch_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.applicant_name,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.grade,
        -- Ensure status matches ENQUIRY_ prefix if needed by frontend
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
        (e.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
        OR
        (e.parent_email = (SELECT auth.jwt() ->> 'email'))
        OR
        (e.admission_id IN (
            SELECT a.id FROM public.admissions a 
            WHERE a.parent_id = auth.uid() 
            OR a.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
            OR a.parent_email = (SELECT auth.jwt() ->> 'email')
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
BEGIN
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
        -- Logic for recipients: if recipients is null, it's global; otherwise check if parent email is in list
        (c.recipients IS NULL)
        OR
        ((SELECT email FROM public.profiles WHERE id = auth.uid()) = ANY(c.recipients))
    ORDER BY c.sent_at DESC;
END;
$$;
