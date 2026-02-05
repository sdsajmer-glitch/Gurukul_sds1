-- ==============================================================================
-- DATABASE REFRACTOR: AMBIGUOUS REFERENCE FIX (PARENT PORTAL)
-- ==============================================================================
-- This script fixes the "column reference 'id' is ambiguous" errors across the 
-- Parent Portal by ensuring all subqueries and join targets are fully qualified.
-- This affects Children Dashboard, Vault (Documents), Access Protocols, and Messaging.

BEGIN;

-- 1. UTILITY: Resolve Email safely
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text AS $$
BEGIN
    RETURN LOWER(COALESCE(
        (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()),
        (SELECT auth.jwt() ->> 'email'),
        ''
    ));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 2. FIX: parent_get_document_requirements
CREATE OR REPLACE FUNCTION public.parent_get_document_requirements(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email text;
    v_result jsonb;
BEGIN
    -- Get user email safely by qualifying profile.id
    SELECT p.email INTO v_email FROM public.profiles p WHERE p.id = p_user_id;

    SELECT jsonb_agg(sub) INTO v_result
    FROM (
        SELECT 
            dr.id,
            dr.admission_id,
            dr.document_name,
            dr.is_mandatory,
            dr.status,
            dr.rejection_reason,
            dr.uploaded_at,
            dr.created_at,
            dr.notes_for_parent,
            (
                SELECT jsonb_agg(ad)
                FROM public.admission_documents ad
                WHERE ad.requirement_id = dr.id
            ) as admission_documents
        FROM public.document_requirements dr
        INNER JOIN public.admissions a ON dr.admission_id = a.id
        WHERE a.parent_id = p_user_id 
           OR LOWER(a.parent_email) = LOWER(v_email)
        ORDER BY dr.created_at DESC
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 3. FIX: get_my_children_profiles (Unified Identity Node Ledger)
DROP FUNCTION IF EXISTS public.get_my_children_profiles();
CREATE OR REPLACE FUNCTION public.get_my_children_profiles()
RETURNS TABLE (
    id uuid,
    applicant_name text,
    parent_name text,
    parent_email text,
    parent_phone text,
    grade text,
    status text,
    date_of_birth date,
    gender text,
    profile_photo_url text,
    branch_id integer,
    submitted_at timestamptz,
    student_user_id uuid,
    emergency_contact text,
    medical_info text,
    source_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_my_id uuid;
    v_my_email text;
BEGIN
    v_my_id := auth.uid();
    v_my_email := public.get_current_user_email();

    RETURN QUERY
    -- First, fetch genuine Admissions
    SELECT 
        a.id,
        a.applicant_name,
        a.parent_name,
        a.parent_email,
        a.parent_phone,
        a.grade,
        a.status,
        a.date_of_birth,
        a.gender,
        a.profile_photo_url,
        a.branch_id,
        a.submitted_at,
        a.student_user_id,
        a.emergency_contact,
        a.medical_info,
        'Admission'::text as source_type
    FROM public.admissions a
    WHERE a.parent_id = v_my_id
       OR (v_my_email <> '' AND LOWER(a.parent_email) = v_my_email)

    UNION ALL

    -- Second, fetch Enquiries that haven't been converted to Admissions yet
    SELECT 
        e.id,
        e.applicant_name,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.grade,
        e.status,
        e.date_of_birth,
        e.gender,
        e.profile_photo_url,
        e.branch_id::integer,
        e.received_at as submitted_at,
        NULL::uuid as student_user_id,
        e.emergency_contact,
        e.medical_info,
        'Enquiry'::text as source_type
    FROM public.enquiries e
    WHERE (e.user_id = v_my_id OR (v_my_email <> '' AND LOWER(e.parent_email) = v_my_email))
      AND (e.admission_id IS NULL OR e.conversion_state != 'CONVERTED')
      AND e.is_deleted = false;
END;
$$;

-- 4. FIX: get_my_enquiries (Messaging Inbox)
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
SET search_path = public
AS $$
DECLARE
    v_user_email text;
BEGIN
    v_user_email := public.get_current_user_email();

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
    ORDER BY e.updated_at DESC;
END;
$$;

-- 5. FIX: get_my_messages (Broadcasts)
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
SET search_path = public
AS $$
DECLARE
    v_user_email text;
BEGIN
    v_user_email := public.get_current_user_email();

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
        (c.recipients IS NULL OR array_length(c.recipients, 1) IS NULL)
        OR
        (v_user_email <> '' AND v_user_email = ANY(
            SELECT LOWER(r) FROM unnest(c.recipients) r
        ))
    ORDER BY c.sent_at DESC;
END;
$$;

-- 6. FIX: parent_initialize_vault_slots_all
CREATE OR REPLACE FUNCTION public.parent_initialize_vault_slots_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_adm record;
    v_email text;
BEGIN
    v_email := public.get_current_user_email();

    FOR v_adm IN 
        SELECT a.id FROM public.admissions a 
        WHERE (a.parent_id = auth.uid() OR (v_email <> '' AND LOWER(a.parent_email) = v_email))
    LOOP
        -- Insert defaults if none exist
        IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_adm.id) THEN
            INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
            VALUES 
            (v_adm.id, 'Birth Certificate', true, 'Pending'),
            (v_adm.id, 'Transfer Certificate', false, 'Pending'),
            (v_adm.id, 'Passport Photo', true, 'Pending');
        END IF;
    END LOOP;
END;
$$;

-- 7. FIX: get_enquiry_timeline_v3
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
DECLARE
    v_enquiry_uuid uuid;
    v_user_role text;
    v_has_access boolean := false;
    v_email text;
BEGIN
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    SELECT prof.role INTO v_user_role FROM public.profiles prof WHERE prof.id = auth.uid();
    v_email := public.get_current_user_email();

    IF v_user_role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Teacher') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries enq
            JOIN public.profiles prof ON prof.branch_id = enq.branch_id
            WHERE enq.id = v_enquiry_uuid AND prof.id = auth.uid()
        ) INTO v_has_access;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.enquiries enq
            WHERE enq.id = v_enquiry_uuid 
            AND (
                enq.user_id = auth.uid() 
                OR (v_email <> '' AND LOWER(enq.parent_email) = v_email)
            )
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        m.id,
        'MESSAGE'::text as item_type,
        m.created_at,
        COALESCE(prof.display_name, 'Institutional Authority') as created_by_name,
        COALESCE(m.is_admin, false) as is_admin,
        jsonb_build_object('message', m.message) as details
    FROM public.enquiry_messages m
    LEFT JOIN public.profiles prof ON m.sender_id = prof.id
    WHERE m.enquiry_id = v_enquiry_uuid

    UNION ALL

    SELECT
        e.id,
        'ENQUIRY_RECEIVED'::text as item_type,
        e.received_at as created_at,
        'System'::text as created_by_name,
        true as is_admin,
        jsonb_build_object('status', 'Identity Decrypted', 'context', e.applicant_name) as details
    FROM public.enquiries e
    WHERE e.id = v_enquiry_uuid

    ORDER BY created_at DESC;
END;
$$;

-- 8. FIX RLS POLICIES (Consolidated & Qualified)

-- ADMISSIONS
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admissions SELECT for Parents" ON public.admissions;
DROP POLICY IF EXISTS "Enable select for users based on parent_id or email" ON public.admissions;

CREATE POLICY "Admissions SELECT for Parents"
ON public.admissions FOR SELECT TO authenticated
USING (
  parent_id = auth.uid() 
  OR 
  parent_email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
);

-- DOCUMENT REQUIREMENTS
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Parental access to requirements" ON public.document_requirements;
DROP POLICY IF EXISTS "Manage requirements" ON public.document_requirements;

CREATE POLICY "Parental access to requirements"
ON public.document_requirements FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admissions adm 
        WHERE adm.id = document_requirements.admission_id 
        AND (adm.parent_id = auth.uid() OR LOWER(adm.parent_email) = (SELECT LOWER(p.email) FROM public.profiles p WHERE p.id = auth.uid()))
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles prof
        WHERE prof.id = auth.uid() 
        AND prof.role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Teacher')
    )
);

-- SHARE CODES
ALTER TABLE public.admission_share_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own created codes" ON public.admission_share_codes;

CREATE POLICY "Users can view own created codes" 
ON public.admission_share_codes FOR SELECT TO authenticated 
USING (
    created_by = auth.uid() 
    OR 
    admission_id IN (SELECT adm.id FROM public.admissions adm WHERE adm.parent_id = auth.uid())
    OR
    enquiry_id IN (SELECT enq.id FROM public.enquiries enq WHERE enq.user_id = auth.uid())
);

-- MESSAGES
ALTER TABLE public.enquiry_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enquiry messages: Parent access" ON public.enquiry_messages;

CREATE POLICY "Enquiry messages: Parent access" ON public.enquiry_messages
FOR SELECT TO authenticated
USING (
    enquiry_id IN (
        SELECT enq.id FROM public.enquiries enq 
        WHERE enq.user_id = auth.uid() 
        OR LOWER(enq.parent_email) = (SELECT LOWER(p.email) FROM public.profiles p WHERE p.id = auth.uid())
        OR LOWER(enq.parent_email) = (SELECT LOWER(auth.jwt() ->> 'email'))
    )
);

-- RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

COMMIT;
