-- ==============================================================================
-- FIX: Attribute Desync - column dr.uploaded_at does not exist
-- ==============================================================================

-- 0. Ensure Unique Constraint exists for ON CONFLICT (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admission_documents_admission_id_requirement_id_key'
    ) THEN
        ALTER TABLE public.admission_documents
        ADD CONSTRAINT admission_documents_admission_id_requirement_id_key UNIQUE (admission_id, requirement_id);
    END IF;
END $$;

-- 1. Fix the Fetch RPC (parent_get_document_requirements)
-- Replace dr.uploaded_at with a subquery to admission_documents
DROP FUNCTION IF EXISTS public.parent_get_document_requirements(uuid);

CREATE OR REPLACE FUNCTION public.parent_get_document_requirements(p_user_id uuid)
RETURNS TABLE (
    id bigint,
    admission_id uuid,
    document_name text,
    is_mandatory boolean,
    status text,
    rejection_reason text,
    uploaded_at timestamptz,
    created_at timestamptz,
    admission_documents json
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        dr.id,
        dr.admission_id,
        dr.document_name,
        dr.is_mandatory,
        dr.status,
        dr.rejection_reason,
        (
            SELECT MAX(ad.uploaded_at)
            FROM public.admission_documents ad
            WHERE ad.requirement_id = dr.id
        ) as uploaded_at,
        dr.created_at,
        COALESCE(
            (
                SELECT json_agg(ad)
                FROM public.admission_documents ad
                WHERE ad.requirement_id = dr.id
            ),
            '[]'::json
        ) as admission_documents
    FROM public.document_requirements dr
    JOIN public.admissions a ON dr.admission_id = a.id
    WHERE a.parent_id = p_user_id 
       OR a.parent_email = (SELECT email FROM public.profiles WHERE id = p_user_id);
$$;

-- 2. Fix the Upload RPC (parent_complete_document_upload)
-- Ensure we don't try to update 'uploaded_at' on document_requirements since it doesn't exist.
-- Also handle the upsert carefully.

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
AS $$
DECLARE
    v_doc_id bigint;
BEGIN
    -- Verify ownership (Security Check)
    IF NOT EXISTS (
        SELECT 1 FROM public.admissions 
        WHERE id = p_admission_id 
        AND (parent_id = auth.uid() OR parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Access Denied: You do not control this admission node.');
    END IF;

    -- Upsert the document record
    -- Relies on the unique constraint added in Step 0
    INSERT INTO public.admission_documents (
        admission_id, requirement_id, file_name, storage_path, file_size, mime_type, uploaded_at, status
    )
    VALUES (
        p_admission_id, p_requirement_id, p_file_name, p_storage_path, p_file_size, p_mime_type, now(), 'Submitted'
    )
    ON CONFLICT (admission_id, requirement_id) 
    DO UPDATE SET
        file_name = EXCLUDED.file_name,
        storage_path = EXCLUDED.storage_path,
        file_size = EXCLUDED.file_size,
        mime_type = EXCLUDED.mime_type,
        uploaded_at = now(),
        status = 'Submitted'
    RETURNING id INTO v_doc_id;

    -- Update requirement status
    -- REMOVED: uploaded_at = now()
    UPDATE public.document_requirements
    SET status = 'Submitted' -- We do NOT update uploaded_at here as the column does not exist
    WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
END;
$$;
