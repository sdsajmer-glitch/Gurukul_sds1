
-- ==============================================================================
-- FIX: ENHANCED MESSAGING FLOW V3
-- ==============================================================================
-- 1. Updates get_my_enquiries to be more inclusive of related identities.
-- 2. Updates get_my_messages to include broadcasts for linked children.
-- ==============================================================================

-- 1. ENHANCED GET MY ENQUIRIES
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
    -- 1. Resolve current user identity
    SELECT 
        LOWER(COALESCE(email, auth.jwt() ->> 'email', '')),
        phone
    INTO v_user_email, v_user_phone
    FROM public.profiles 
    WHERE id = auth.uid();

    -- Fallback for email if profile not fully loaded
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
        COALESCE(sb.name, 'Main Branch') as branch_name
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE 
        -- Direct link
        (e.user_id = auth.uid())
        OR 
        -- Email handshake
        (v_user_email <> '' AND LOWER(e.parent_email) = v_user_email)
        OR
        -- Phone handshake (if available)
        (v_user_phone IS NOT NULL AND v_user_phone <> '' AND e.parent_phone = v_user_phone)
        OR
        -- Message history link
        (e.id IN (
            SELECT em.enquiry_id FROM public.enquiry_messages em WHERE em.sender_id = auth.uid()
        ))
        OR
        -- Admission relationship link
        (e.admission_id IN (
            SELECT a.id FROM public.admissions a 
            WHERE a.parent_id = auth.uid() 
            OR (v_user_email <> '' AND LOWER(a.parent_email) = v_user_email)
        ))
    ORDER BY e.updated_at DESC;
END;
$$;

-- 2. ENHANCED GET MY MESSAGES (Broadcasts)
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
    v_child_emails text[];
BEGIN
    -- 1. Get parent email
    v_user_email := LOWER(COALESCE(
        (SELECT email FROM public.profiles WHERE id = auth.uid()),
        (SELECT auth.jwt() ->> 'email'),
        ''
    ));

    -- 2. Get children emails
    v_child_emails := ARRAY(
        SELECT LOWER(parent_email) FROM public.admissions 
        WHERE parent_id = auth.uid()
        UNION
        SELECT LOWER(student_user_id::text) FROM public.admissions -- In case they use IDs in recipients
        WHERE parent_id = auth.uid()
        UNION
        -- Also check enquiries emails just in case
        SELECT LOWER(parent_email) FROM public.enquiries
        WHERE user_id = auth.uid()
    );

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
        -- Rule A: Global broadcasts (null or empty recipients)
        (c.recipients IS NULL OR array_length(c.recipients, 1) IS NULL)
        OR
        -- Rule B: Direct to parent
        (v_user_email <> '' AND v_user_email = ANY(SELECT LOWER(r) FROM unnest(c.recipients) r))
        OR
        -- Rule C: Related to parent's registered children/enquiries
        EXISTS (
            SELECT 1 FROM unnest(c.recipients) r 
            WHERE LOWER(r) = ANY(v_child_emails)
        )
    ORDER BY c.sent_at DESC;
END;
$$;

SELECT 'SUCCESS: Messaging flow enhanced with secondary identity matching.' as status;
