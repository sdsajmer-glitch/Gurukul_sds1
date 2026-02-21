-- ============================================================================
-- VAULT_ULTIMATE_RESTORE_V62.sql
-- Objective: Fix Attribute Desync for student_parents.status and profile_photo_url.
-- Also hardens the Vault retrieval logic for both parents and admins.
-- ============================================================================

BEGIN;

-- 1. Ensure student_parents has the status column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='student_parents' AND column_name='status') THEN
        ALTER TABLE public.student_parents ADD COLUMN status text DEFAULT 'active';
    END IF;
END $$;

-- 2. Ensure student_profiles has profile_photo_url to prevent Attribute Desync
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='student_profiles' AND column_name='profile_photo_url') THEN
        ALTER TABLE public.student_profiles ADD COLUMN profile_photo_url text;
    END IF;
END $$;

-- [RLS REINFORCEMENT] Ensure School Staff can see all document requirements
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage all document requirements" ON public.document_requirements;
CREATE POLICY "Staff can manage all document requirements"
ON public.document_requirements FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'super_admin', 'admin node')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'super_admin', 'admin node')
    )
);

-- Parents can see their own
DROP POLICY IF EXISTS "Parents can view their own document requirements" ON public.document_requirements;
CREATE POLICY "Parents can view their own document requirements"
ON public.document_requirements FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admissions a
        WHERE a.id = admission_id
        AND (a.parent_id = auth.uid() OR LOWER(a.parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid()))
    )
);

-- [RLS REINFORCEMENT] Ensure School Staff can see all admission documents
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage all admission documents" ON public.admission_documents;
CREATE POLICY "Staff can manage all admission documents"
ON public.admission_documents FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'super_admin', 'admin node')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'super_admin', 'admin node')
    )
);

-- 3. FIX: parent_get_document_requirements (Hardened with correct mapping)
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
    SELECT LOWER(p.email) INTO v_email FROM public.profiles p WHERE p.id = p_user_id;

    SELECT jsonb_agg(sub) INTO v_result
    FROM (
        SELECT 
            dr.id AS requirement_id,
            dr.id,
            dr.admission_id,
            COALESCE(a.student_user_id, a.id) AS frontend_mapped_id, 
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
           OR LOWER(a.parent_email) = v_email
           OR a.student_user_id IN (
               SELECT sp.student_id FROM public.student_parents sp WHERE sp.parent_id = p_user_id AND sp.status = 'active'
           )
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
    source_type text,
    student_id_number text,
    school_name text,
    class_name text,
    address text
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
    SELECT LOWER(p.email) INTO v_my_email FROM public.profiles p WHERE p.id = v_my_id;

    RETURN QUERY
    -- A. Fetch genuine Admissions
    SELECT 
        a.id::uuid,
        a.applicant_name::text,
        a.parent_name::text,
        a.parent_email::text,
        a.parent_phone::text,
        a.grade::text,
        a.status::text,
        a.date_of_birth::date,
        a.gender::text,
        a.profile_photo_url::text,
        a.branch_id::integer,
        a.submitted_at::timestamptz,
        a.student_user_id::uuid,
        a.emergency_contact::text,
        a.medical_info::text,
        'Admission'::text as source_type,
        a.student_id_number::text,
        sb.name::text as school_name,
        sc.name::text as class_name,
        a.address::text
    FROM public.admissions a
    LEFT JOIN public.school_branches sb ON a.branch_id = sb.id
    LEFT JOIN public.student_profiles sp ON a.student_user_id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE a.parent_id = v_my_id
       OR (v_my_email IS NOT NULL AND v_my_email <> '' AND LOWER(a.parent_email) = v_my_email)

    UNION ALL

    -- B. Fetch Enquiries
    SELECT 
        e.id::uuid,
        e.applicant_name::text,
        e.parent_name::text,
        e.parent_email::text,
        e.parent_phone::text,
        e.grade::text,
        e.status::text,
        e.date_of_birth::date,
        e.gender::text,
        e.profile_photo_url::text,
        e.branch_id::integer,
        e.received_at::timestamptz as submitted_at,
        NULL::uuid as student_user_id,
        e.emergency_contact::text,
        e.medical_info::text,
        'Enquiry'::text as source_type,
        NULL::text as student_id_number,
        sb.name::text as school_name,
        NULL::text as class_name,
        e.address::text
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE (e.user_id = v_my_id OR (v_my_email IS NOT NULL AND v_my_email <> '' AND LOWER(e.parent_email) = v_my_email))
      AND (e.admission_id IS NULL OR e.conversion_state != 'CONVERTED')
      AND e.is_deleted = false

    UNION ALL

    -- C. Fetch via student_parents (Hardened mapping)
    SELECT 
        psm.student_id::uuid as id,
        s.display_name::text as applicant_name,
        NULL::text as parent_name,
        s.email::text as parent_email,
        NULL::text as parent_phone,
        sp.grade::text,
        sp.enrollment_status::text as status,
        NULL::date as date_of_birth,
        NULL::text as gender,
        s.profile_photo_url::text as profile_photo_url,  -- Unified photo source
        sp.branch_id::integer,
        psm.created_at::timestamptz as submitted_at,
        psm.student_id::uuid as student_user_id,
        NULL::text as emergency_contact,
        NULL::text as medical_info,
        'STUDENT'::text as source_type,
        sp.student_id_number::text,
        sb.name::text as school_name,
        COALESCE(sc.name, 'Unassigned')::text as class_name,
        sp.address::text
    FROM public.student_parents psm
    JOIN public.profiles s ON psm.student_id = s.id
    LEFT JOIN public.student_profiles sp ON s.id = sp.user_id
    LEFT JOIN public.school_branches sb ON sp.branch_id = sb.id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE psm.parent_id = v_my_id AND psm.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM public.admissions a WHERE a.student_user_id = psm.student_id AND a.parent_id = v_my_id);
END;
$$;

-- 4. FIX: parent_initialize_vault_slots_all (Comprehensive loop)
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
    SELECT LOWER(email) INTO v_email FROM public.profiles WHERE id = auth.uid();

    -- Initialize for Admissions linked to parent (Direct or Email)
    FOR v_adm IN 
        SELECT a.id FROM public.admissions a 
        WHERE (a.parent_id = auth.uid() OR (v_email IS NOT NULL AND v_email <> '' AND LOWER(a.parent_email) = v_email))
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_adm.id) THEN
            INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
            VALUES 
            (v_adm.id, 'Aadhar Card / National ID', true, 'Pending'),
            (v_adm.id, 'Birth Certificate', true, 'Pending'),
            (v_adm.id, 'Transfer Certificate', true, 'Pending'),
            (v_adm.id, 'Student Photograph', true, 'Pending');
        END IF;
    END LOOP;

    -- Initialize for Student Nodes linked via student_parents
    FOR v_adm IN 
        SELECT a.id FROM public.admissions a
        JOIN public.student_parents sp ON a.student_user_id = sp.student_id
        WHERE sp.parent_id = auth.uid() AND sp.status = 'active'
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_adm.id) THEN
            INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
            VALUES 
            (v_adm.id, 'Aadhar Card / National ID', true, 'Pending'),
            (v_adm.id, 'Birth Certificate', true, 'Pending'),
            (v_adm.id, 'Transfer Certificate', true, 'Pending'),
            (v_adm.id, 'Student Photograph', true, 'Pending');
        END IF;
    END LOOP;
END;
$$;

COMMIT;
