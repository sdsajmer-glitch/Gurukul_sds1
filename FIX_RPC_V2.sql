-- ==============================================================================
-- FIX: Re-create RPC function 'parent_complete_document_upload' to matches Frontend Call
-- ==============================================================================

-- Drop the function first to ensure clean state if signature mismatch exists
DROP FUNCTION IF EXISTS public.parent_complete_document_upload;

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

    -- Update requirement status to 'Submitted'
    UPDATE public.document_requirements
    SET status = 'Submitted', uploaded_at = now()
    WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
END;
$$;
