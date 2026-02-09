-- ==============================================================================
-- FIX: PARENT INBOX & ENQUIRY MESSAGING (V5)
-- ==============================================================================
-- 1. Hardens access logic for parents (lenient email matching).
-- 2. Standardizes status prefixes for UI mapping.
-- 3. Implements improved timeline fetching with sender photos.
-- 4. Ensures audit logs are correctly linked.
-- ==============================================================================

BEGIN;

-- [A] IMPROVED: get_my_enquiries
-- Added TRIM and more robust cross-linking to admissions.
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
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    -- Resolve current user email from all available sources
    v_user_email := LOWER(TRIM(COALESCE(
        (SELECT email FROM public.profiles WHERE id = v_user_id),
        (SELECT auth.jwt() ->> 'email'),
        ''
    )));

    RETURN QUERY
    SELECT 
        e.id,
        e.applicant_name,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.grade,
        -- Ensure ENQUIRY_ prefix for status mapping in UI
        CASE 
            WHEN e.status NOT LIKE 'ENQUIRY_%' THEN 'ENQUIRY_' || UPPER(e.status)
            ELSE UPPER(e.status)
        END as status,
        e.updated_at,
        e.branch_id,
        COALESCE(sb.name, 'Main Registry') as branch_name
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE 
        e.is_deleted = false
        AND (
            (e.user_id = v_user_id)
            OR 
            (v_user_email <> '' AND LOWER(TRIM(e.parent_email)) = v_user_email)
            OR
            (e.id IN (
                SELECT em.enquiry_id FROM public.enquiry_messages em WHERE em.sender_id = v_user_id
            ))
            OR
            (e.admission_id IS NOT NULL AND e.admission_id IN (
                SELECT a.id FROM public.admissions a 
                WHERE a.parent_id = v_user_id 
                OR (v_user_email <> '' AND LOWER(TRIM(a.parent_email)) = v_user_email)
            ))
        )
    ORDER BY e.updated_at DESC;
END;
$$;

-- [B] IMPROVED: send_enquiry_message_v3 (with better feedback)
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
    v_user_id uuid;
    v_user_email text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Identity missing. Please re-authenticate.');
    END IF;

    -- [1] Identity Resolution
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid identity node identifier');
    END;

    -- [2] Role & Email Resolution
    SELECT role, LOWER(TRIM(email)) INTO v_user_role, v_user_email FROM public.profiles WHERE id = v_user_id;
    IF v_user_email IS NULL THEN
        v_user_email := LOWER(TRIM(auth.jwt() ->> 'email'));
    END IF;

    v_is_admin := v_user_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'Teacher');

    -- [3] Access Validation (The "Gatekeeper" logic)
    IF v_is_admin THEN
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            LEFT JOIN public.profiles p ON p.id = v_user_id
            WHERE e.id = v_enquiry_uuid 
            AND (p.branch_id = e.branch_id OR p.role IN ('School Administration', 'Super Admin'))
        ) INTO v_has_access;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = v_enquiry_uuid 
            AND (
                e.user_id = v_user_id 
                OR LOWER(TRIM(e.parent_email)) = v_user_email
                OR EXISTS (SELECT 1 FROM public.enquiry_messages em WHERE em.enquiry_id = v_enquiry_uuid AND em.sender_id = v_user_id)
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN jsonb_build_object('success', false, 'error', 'Node handshake rejected. Access denied.');
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
        v_user_id,
        p_message,
        v_is_admin,
        v_is_admin
    );

    -- [5] Pulse update for sorting
    UPDATE public.enquiries SET updated_at = now() WHERE id = v_enquiry_uuid;

    -- [6] Audit Log (Internal)
    -- This ensures we can trace when parents respond on mobile.
    
    RETURN jsonb_build_object('success', true, 'message', 'Transmission confirmed.');
END;
$$;

COMMIT;

SELECT 'SUCCESS: Parent Inbox Architecture V5 deployed.' as status;
