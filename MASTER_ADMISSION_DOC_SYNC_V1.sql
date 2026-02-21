-- ============================================================================
-- MASTER_ADMISSION_DOC_SYNC_V1.sql
-- Objective: Fix Document Sync between Parent/Admin, Storage access, and RPC logic.
-- ============================================================================

BEGIN;

-- 1. [MIGRATION] Relink orphaned requirements/documents from Enquiries to Admissions
-- This ensures that when an enquiry is converted to an admission, the documents follow.
UPDATE public.document_requirements dr
SET admission_id = e.admission_id
FROM public.enquiries e
WHERE dr.enquiry_id = e.id
  AND dr.admission_id IS NULL
  AND e.admission_id IS NOT NULL;

UPDATE public.admission_documents ad
SET admission_id = e.admission_id
FROM public.enquiries e
WHERE ad.enquiry_id = e.id
  AND ad.admission_id IS NULL
  AND e.admission_id IS NOT NULL;


-- 2. [STORAGE POLICIES] Allow School Staff to view/download artifacts
-- Previously, only the owner could see their own documents, blocking admins.
DROP POLICY IF EXISTS "School Staff can view all documents" ON storage.objects;
CREATE POLICY "School Staff can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'super_admin', 'admin node')
    )
);


-- 3. [RPC] Hardened parent_complete_document_upload
-- Handles both Enquiry IDs and Admission IDs for unified parent portal experience.
CREATE OR REPLACE FUNCTION public.parent_complete_document_upload(
    p_requirement_id bigint,  
    p_admission_id uuid, -- This can be an enquiry_id OR admission_id
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
    v_real_admission_id uuid;
    v_real_enquiry_id uuid;
    v_user_email text;
BEGIN
    SELECT LOWER(email) INTO v_user_email FROM public.profiles WHERE id = auth.uid();

    -- Check if it's an Enquiry
    SELECT id, admission_id INTO v_real_enquiry_id, v_real_admission_id 
    FROM public.enquiries 
    WHERE id = p_admission_id 
      AND (user_id = auth.uid() OR LOWER(parent_email) = v_user_email);

    -- If not found as enquiry, check if it's a direct Admission
    IF v_real_enquiry_id IS NULL THEN
        SELECT id INTO v_real_admission_id 
        FROM public.admissions 
        WHERE id = p_admission_id 
          AND (parent_id = auth.uid() OR LOWER(parent_email) = v_user_email);
    END IF;

    IF v_real_admission_id IS NULL AND v_real_enquiry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Access Denied: Node not found or unauthorized.');
    END IF;

    -- Prefer linking to Admission ID if available
    IF v_real_admission_id IS NOT NULL THEN
        INSERT INTO public.admission_documents (
            admission_id, requirement_id, file_name, storage_path, 
            file_size, mime_type, uploaded_at, status, uploaded_by
        )
        VALUES (
            v_real_admission_id, p_requirement_id, p_file_name, p_storage_path, 
            p_file_size, p_mime_type, now(), 'Submitted', auth.uid()
        )
        ON CONFLICT (admission_id, requirement_id) DO UPDATE 
        SET file_name = EXCLUDED.file_name, 
            storage_path = EXCLUDED.storage_path, 
            file_size = EXCLUDED.file_size, 
            mime_type = EXCLUDED.mime_type, 
            uploaded_at = now(), 
            status = 'Submitted',
            uploaded_by = auth.uid()
        RETURNING id INTO v_doc_id;
    ELSE
        INSERT INTO public.admission_documents (
            enquiry_id, requirement_id, file_name, storage_path, 
            file_size, mime_type, uploaded_at, status, uploaded_by
        )
        VALUES (
            v_real_enquiry_id, p_requirement_id, p_file_name, p_storage_path, 
            p_file_size, p_mime_type, now(), 'Submitted', auth.uid()
        )
        ON CONFLICT (enquiry_id, requirement_id) DO UPDATE 
        SET file_name = EXCLUDED.file_name, 
            storage_path = EXCLUDED.storage_path, 
            file_size = EXCLUDED.file_size, 
            mime_type = EXCLUDED.mime_type, 
            uploaded_at = now(), 
            status = 'Submitted',
            uploaded_by = auth.uid()
        RETURNING id INTO v_doc_id;
    END IF;

    -- Synchronize status back to requirement
    UPDATE public.document_requirements
    SET status = 'Submitted', updated_at = now()
    WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
END;
$$;


-- 4. [RPC] Hardened parent_get_document_requirements
-- Ensures documents linked via Enquiry are also visible when viewing an Admission node.
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
            dr.enquiry_id,
            COALESCE(a.student_user_id, a.id, dr.enquiry_id) AS frontend_mapped_id, 
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
        LEFT JOIN public.admissions a ON dr.admission_id = a.id
        LEFT JOIN public.enquiries e ON dr.enquiry_id = e.id
        WHERE (dr.admission_id IS NOT NULL AND (a.parent_id = p_user_id OR LOWER(a.parent_email) = v_email))
           OR (dr.enquiry_id IS NOT NULL AND (e.user_id = p_user_id OR LOWER(e.parent_email) = v_email))
           OR (a.student_user_id IN (
               SELECT sp.student_id FROM public.student_parents sp WHERE sp.parent_id = p_user_id AND sp.status = 'active'
           ))
        ORDER BY dr.created_at DESC
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMIT;
