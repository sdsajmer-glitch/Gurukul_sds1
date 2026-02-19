-- ==============================================================================
-- FIX_ADMISSION_VAULT_MASTER_V13.sql
-- ==============================================================================
-- ROOT CAUSE: Parent-uploaded documents are visible in parent portal but 
-- NOT visible in admin's AdmissionDetailsModal.
--
-- DIAGNOSIS:
-- 1. Parent portal uses RPC functions (SECURITY DEFINER) which bypass RLS
-- 2. Admin modal uses direct PostgREST queries which are subject to RLS
-- 3. Multiple conflicting RLS policies exist on document_requirements & 
--    admission_documents tables from different fix scripts
-- 4. Some document_requirements rows may have enquiry_id set but NULL 
--    admission_id (from pre-promotion uploads)
-- 5. admission_documents rows may also have enquiry_id but NULL admission_id
--
-- FIX:
-- 1. Clean up ALL conflicting RLS policies and create definitive ones
-- 2. Migrate any orphaned enquiry_id-only records to use admission_id
-- 3. Ensure admin role checks cover all role name variants
-- 4. Fix the parent_initialize_vault_slots_all function
-- ==============================================================================

BEGIN;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 1: DIAGNOSTIC — Find orphaned document records    ║
-- ╚══════════════════════════════════════════════════════════╝

-- [1A] Ensure enquiry_id column exists on both tables
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_requirements' AND column_name = 'enquiry_id') THEN
        ALTER TABLE public.document_requirements ADD COLUMN enquiry_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admission_documents' AND column_name = 'enquiry_id') THEN
        ALTER TABLE public.admission_documents ADD COLUMN enquiry_id uuid;
    END IF;
END $$;

-- [1B] Migrate orphaned document_requirements: rows with enquiry_id but NULL admission_id
-- Match by finding the converted enquiry's admission_id
UPDATE public.document_requirements dr
SET admission_id = e.admission_id
FROM public.enquiries e
WHERE dr.enquiry_id = e.id
  AND dr.admission_id IS NULL
  AND e.admission_id IS NOT NULL
  AND e.conversion_state = 'CONVERTED';

-- [1C] Migrate orphaned admission_documents: rows with enquiry_id but NULL admission_id
UPDATE public.admission_documents ad
SET admission_id = e.admission_id
FROM public.enquiries e
WHERE ad.enquiry_id = e.id
  AND ad.admission_id IS NULL
  AND e.admission_id IS NOT NULL
  AND e.conversion_state = 'CONVERTED';

-- [1D] Also try to resolve through document_requirements linkage
UPDATE public.admission_documents ad
SET admission_id = dr.admission_id
FROM public.document_requirements dr
WHERE ad.requirement_id = dr.id
  AND ad.admission_id IS NULL
  AND dr.admission_id IS NOT NULL;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 2: NUKE ALL CONFLICTING RLS POLICIES             ║
-- ╚══════════════════════════════════════════════════════════╝

-- [2A] Remove ALL existing policies on document_requirements
DROP POLICY IF EXISTS "Manage requirements" ON public.document_requirements;
DROP POLICY IF EXISTS "Parents can manage requirements" ON public.document_requirements;
DROP POLICY IF EXISTS "Admins can manage requirements" ON public.document_requirements;
DROP POLICY IF EXISTS "Admins can manage all requirements" ON public.document_requirements;
DROP POLICY IF EXISTS "Parents can view their own requirements" ON public.document_requirements;
DROP POLICY IF EXISTS "Parents can view and update own requirements" ON public.document_requirements;
DROP POLICY IF EXISTS "Staff and Parents manage requirements" ON public.document_requirements;

-- [2B] Remove ALL existing policies on admission_documents
DROP POLICY IF EXISTS "Parents can manage documents" ON public.admission_documents;
DROP POLICY IF EXISTS "School Admins can view branch documents" ON public.admission_documents;
DROP POLICY IF EXISTS "Admins can manage documents" ON public.admission_documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.admission_documents;
DROP POLICY IF EXISTS "Parents can manage own documents" ON public.admission_documents;
DROP POLICY IF EXISTS "Parents can manage their own documents" ON public.admission_documents;
DROP POLICY IF EXISTS "Staff and Parents manage admission documents" ON public.admission_documents;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 3: CREATE DEFINITIVE RLS POLICIES                 ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;

-- [3A] document_requirements: Admin access (covers ALL admin role variants)
CREATE POLICY "dr_admin_access" ON public.document_requirements
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() 
        AND (
            p.is_super_admin = true
            OR LOWER(p.role) IN (
                'school administration', 'super admin', 'principal',
                'admin', 'school_admin', 'super_admin', 'branch admin', 
                'branch_admin', 'academic coordinator', 'hr manager'
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() 
        AND (
            p.is_super_admin = true
            OR LOWER(p.role) IN (
                'school administration', 'super admin', 'principal',
                'admin', 'school_admin', 'super_admin', 'branch admin', 
                'branch_admin', 'academic coordinator', 'hr manager'
            )
        )
    )
);

-- [3B] document_requirements: Parent access (via admission OR enquiry ownership)
CREATE POLICY "dr_parent_access" ON public.document_requirements
FOR ALL TO authenticated
USING (
    -- Parent owns the admission
    EXISTS (
        SELECT 1 FROM public.admissions a
        WHERE a.id = document_requirements.admission_id
        AND (
            a.parent_id = auth.uid() 
            OR LOWER(a.parent_email) = LOWER((SELECT email FROM public.profiles WHERE id = auth.uid()))
        )
    )
    OR
    -- Parent owns the enquiry (pre-promotion docs)
    EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = document_requirements.enquiry_id
        AND (
            e.user_id = auth.uid()
            OR LOWER(e.parent_email) = LOWER((SELECT email FROM public.profiles WHERE id = auth.uid()))
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admissions a
        WHERE a.id = document_requirements.admission_id
        AND (
            a.parent_id = auth.uid() 
            OR LOWER(a.parent_email) = LOWER((SELECT email FROM public.profiles WHERE id = auth.uid()))
        )
    )
    OR
    EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = document_requirements.enquiry_id
        AND (
            e.user_id = auth.uid()
            OR LOWER(e.parent_email) = LOWER((SELECT email FROM public.profiles WHERE id = auth.uid()))
        )
    )
);

-- [3C] admission_documents: Admin access
CREATE POLICY "ad_admin_access" ON public.admission_documents
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() 
        AND (
            p.is_super_admin = true
            OR LOWER(p.role) IN (
                'school administration', 'super admin', 'principal',
                'admin', 'school_admin', 'super_admin', 'branch admin', 
                'branch_admin', 'academic coordinator', 'hr manager'
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() 
        AND (
            p.is_super_admin = true
            OR LOWER(p.role) IN (
                'school administration', 'super admin', 'principal',
                'admin', 'school_admin', 'super_admin', 'branch admin', 
                'branch_admin', 'academic coordinator', 'hr manager'
            )
        )
    )
);

-- [3D] admission_documents: Parent access
CREATE POLICY "ad_parent_access" ON public.admission_documents
FOR ALL TO authenticated
USING (
    -- Via admission ownership
    EXISTS (
        SELECT 1 FROM public.admissions a
        WHERE a.id = admission_documents.admission_id
        AND (
            a.parent_id = auth.uid() 
            OR LOWER(a.parent_email) = LOWER((SELECT email FROM public.profiles WHERE id = auth.uid()))
        )
    )
    OR
    -- Via enquiry ownership (pre-promotion docs)
    EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = admission_documents.enquiry_id
        AND (
            e.user_id = auth.uid()
            OR LOWER(e.parent_email) = LOWER((SELECT email FROM public.profiles WHERE id = auth.uid()))
        )
    )
    OR
    -- Via requirement linkage (fallback)
    EXISTS (
        SELECT 1 FROM public.document_requirements dr
        JOIN public.admissions a ON a.id = dr.admission_id
        WHERE dr.id = admission_documents.requirement_id
        AND (
            a.parent_id = auth.uid()
            OR LOWER(a.parent_email) = LOWER((SELECT email FROM public.profiles WHERE id = auth.uid()))
        )
    )
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 4: STORAGE POLICIES FOR DOCUMENT FILES            ║
-- ╚══════════════════════════════════════════════════════════╝

-- Admins can view all documents in storage bucket
DROP POLICY IF EXISTS "Admins View Documents" ON storage.objects;
CREATE POLICY "Admins View Documents" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'documents' 
    AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() 
        AND (
            p.is_super_admin = true
            OR LOWER(p.role) IN (
                'school administration', 'super admin', 'principal',
                'admin', 'school_admin', 'super_admin', 'branch admin',
                'branch_admin'
            )
        )
    )
);

-- Users can view their own uploaded files
DROP POLICY IF EXISTS "View Own Documents" ON storage.objects;
CREATE POLICY "View Own Documents" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'documents' AND auth.uid() = owner
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 5: SEED DEFAULT DOCUMENT REQUIREMENTS             ║
-- ╚══════════════════════════════════════════════════════════╝

-- [5A] Reusable idempotent seeder function  
CREATE OR REPLACE FUNCTION public.seed_default_document_requirements(p_admission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_name text;
  v_doc_names text[] := ARRAY[
    'Aadhar Card / National ID',
    'Birth Certificate',
    'Transfer Certificate',
    'Student Photograph'
  ];
BEGIN
  FOREACH v_doc_name IN ARRAY v_doc_names
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.document_requirements 
      WHERE admission_id = p_admission_id 
        AND LOWER(TRIM(document_name)) = LOWER(TRIM(v_doc_name))
    ) THEN
      INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
      VALUES (p_admission_id, v_doc_name, true, 'Pending');
    END IF;
  END LOOP;
END;
$$;

-- [5B] Seed for all existing admissions that have zero document_requirements
INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
SELECT 
    a.id, d.name, true, 'Pending'
FROM public.admissions a
CROSS JOIN (
    SELECT 'Aadhar Card / National ID' as name
    UNION ALL SELECT 'Birth Certificate'
    UNION ALL SELECT 'Transfer Certificate'
    UNION ALL SELECT 'Student Photograph'
) d
WHERE NOT EXISTS (
    SELECT 1 FROM public.document_requirements dr 
    WHERE dr.admission_id = a.id 
      AND LOWER(TRIM(dr.document_name)) = LOWER(TRIM(d.name))
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 6: FIX parent_initialize_vault_slots_all          ║
-- ╚══════════════════════════════════════════════════════════╝

-- This function is called by the parent portal on every DocumentsTab load
-- It must create slots using admission_id (not enquiry_id) for post-promotion records

CREATE OR REPLACE FUNCTION public.parent_initialize_vault_slots_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rec record;
    v_reqs text[] := ARRAY[
        'Birth Certificate', 
        'Aadhar Card / National ID', 
        'Transfer Certificate', 
        'Previous Year Marksheet', 
        'Address Proof', 
        'Parent / Guardian ID', 
        'Medical Fitness Certificate', 
        'Student Photograph',
        'ID Proof'
    ];
    v_req text;
    v_user_email text;
BEGIN
    -- Get the calling parent's email
    SELECT email INTO v_user_email FROM public.profiles WHERE id = auth.uid();

    -- Process Admissions
    FOR v_rec IN 
        SELECT a.id FROM public.admissions a
        WHERE (a.parent_id = auth.uid() OR LOWER(a.parent_email) = LOWER(v_user_email))
    LOOP
        FOREACH v_req IN ARRAY v_reqs
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.document_requirements dr 
                WHERE dr.admission_id = v_rec.id 
                  AND LOWER(TRIM(dr.document_name)) = LOWER(TRIM(v_req))
            ) THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (v_rec.id, v_req, 
                    CASE WHEN v_req IN ('Birth Certificate', 'Aadhar Card / National ID', 'Student Photograph') THEN true ELSE false END, 
                    'Pending');
            END IF;
        END LOOP;
    END LOOP;

    -- Process Enquiries (only unconverted ones)
    FOR v_rec IN 
        SELECT e.id FROM public.enquiries e
        WHERE (e.user_id = auth.uid() OR LOWER(e.parent_email) = LOWER(v_user_email))
          AND e.is_deleted = false
          AND (e.admission_id IS NULL)
          AND e.conversion_state != 'CONVERTED'
    LOOP
        FOREACH v_req IN ARRAY v_reqs
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.document_requirements dr 
                WHERE dr.enquiry_id = v_rec.id 
                  AND LOWER(TRIM(dr.document_name)) = LOWER(TRIM(v_req))
            ) THEN
                INSERT INTO public.document_requirements (enquiry_id, document_name, is_mandatory, status)
                VALUES (v_rec.id, v_req, 
                    CASE WHEN v_req IN ('Birth Certificate', 'Aadhar Card / National ID', 'Student Photograph') THEN true ELSE false END, 
                    'Pending');
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 7: FIX parent_get_document_requirements           ║
-- ╚══════════════════════════════════════════════════════════╝

-- Must return the real admission_id (not aliased with COALESCE to enquiry_id)
-- for documents that have been migrated

DROP FUNCTION IF EXISTS public.parent_get_document_requirements(uuid);

CREATE OR REPLACE FUNCTION public.parent_get_document_requirements(p_user_id uuid)
RETURNS TABLE (
    id bigint,
    admission_id uuid,
    document_name text,
    is_mandatory boolean,
    status text,
    rejection_reason text,
    uploaded_at timestamp with time zone,
    created_at timestamp with time zone,
    admission_documents jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email text;
BEGIN
    SELECT email INTO v_user_email FROM public.profiles WHERE id = p_user_id;

    RETURN QUERY
    SELECT 
        dr.id,
        COALESCE(dr.admission_id, dr.enquiry_id) AS admission_id,
        dr.document_name,
        dr.is_mandatory,
        dr.status,
        dr.rejection_reason,
        dr.uploaded_at,
        dr.created_at,
        (
            SELECT jsonb_agg(jsonb_build_object(
                'id', ad.id,
                'file_name', ad.file_name,
                'storage_path', ad.storage_path,
                'file_size', ad.file_size,
                'mime_type', ad.mime_type,
                'status', ad.status,
                'uploaded_at', ad.uploaded_at
            ))
            FROM public.admission_documents ad
            WHERE ad.requirement_id = dr.id
        ) AS admission_documents
    FROM public.document_requirements dr
    LEFT JOIN public.admissions a ON dr.admission_id = a.id
    LEFT JOIN public.enquiries e ON dr.enquiry_id = e.id
    WHERE 
        (a.parent_id = p_user_id OR LOWER(a.parent_email) = LOWER(v_user_email))
        OR
        (e.user_id = p_user_id OR LOWER(e.parent_email) = LOWER(v_user_email))
    ORDER BY dr.is_mandatory DESC, dr.document_name ASC;
END;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 8: FIX parent_complete_document_upload             ║
-- ╚══════════════════════════════════════════════════════════╝

-- Ensures uploaded docs are linked to admission_id when possible

DROP FUNCTION IF EXISTS public.parent_complete_document_upload(bigint, uuid, text, text, bigint, text);

CREATE OR REPLACE FUNCTION public.parent_complete_document_upload(
    p_requirement_id bigint,  
    p_admission_id uuid,
    p_file_name text,
    p_storage_path text,
    p_file_size bigint,
    p_mime_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_doc_id bigint;
    v_is_admission boolean := false;
    v_is_enquiry boolean := false;
    v_user_email text;
BEGIN
    SELECT email INTO v_user_email FROM public.profiles WHERE id = auth.uid();

    -- Check if it's an admission
    SELECT EXISTS(
        SELECT 1 FROM public.admissions a 
        WHERE a.id = p_admission_id 
          AND (a.parent_id = auth.uid() OR LOWER(a.parent_email) = LOWER(v_user_email))
    ) INTO v_is_admission;
    
    IF NOT v_is_admission THEN
        SELECT EXISTS(
            SELECT 1 FROM public.enquiries e 
            WHERE e.id = p_admission_id 
              AND (e.user_id = auth.uid() OR LOWER(e.parent_email) = LOWER(v_user_email))
        ) INTO v_is_enquiry;
    END IF;

    IF NOT (v_is_admission OR v_is_enquiry) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Access Denied: You do not control this node.');
    END IF;

    -- Upsert (ensure unique constraint exists)
    IF v_is_admission THEN
        INSERT INTO public.admission_documents (admission_id, requirement_id, file_name, storage_path, file_size, mime_type, uploaded_at, status)
        VALUES (p_admission_id, p_requirement_id, p_file_name, p_storage_path, p_file_size, p_mime_type, now(), 'Submitted')
        ON CONFLICT (admission_id, requirement_id) DO UPDATE 
        SET file_name = EXCLUDED.file_name, storage_path = EXCLUDED.storage_path, file_size = EXCLUDED.file_size, 
            mime_type = EXCLUDED.mime_type, uploaded_at = now(), status = 'Submitted'
        RETURNING id INTO v_doc_id;
    ELSE
        INSERT INTO public.admission_documents (enquiry_id, requirement_id, file_name, storage_path, file_size, mime_type, uploaded_at, status)
        VALUES (p_admission_id, p_requirement_id, p_file_name, p_storage_path, p_file_size, p_mime_type, now(), 'Submitted')
        ON CONFLICT (enquiry_id, requirement_id) DO UPDATE 
        SET file_name = EXCLUDED.file_name, storage_path = EXCLUDED.storage_path, file_size = EXCLUDED.file_size, 
            mime_type = EXCLUDED.mime_type, uploaded_at = now(), status = 'Submitted'
        RETURNING id INTO v_doc_id;
    END IF;

    -- Update requirement status
    UPDATE public.document_requirements
    SET status = 'Submitted', uploaded_at = now()
    WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
END;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 9: GRANTS                                         ║
-- ╚══════════════════════════════════════════════════════════╝

GRANT EXECUTE ON FUNCTION public.seed_default_document_requirements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_document_requirements(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.parent_initialize_vault_slots_all() TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_get_document_requirements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_complete_document_upload(bigint, uuid, text, text, bigint, text) TO authenticated;

COMMIT;

SELECT 'SUCCESS: V13 Master Vault Fix deployed. RLS unified, orphaned docs migrated, seeder enhanced.' as status;
