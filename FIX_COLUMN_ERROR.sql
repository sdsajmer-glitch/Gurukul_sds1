-- ==============================================================================
-- CRITICAL FIX: Add missing 'uploaded_at' column to 'document_requirements'
-- This resolves the "Attribute Desync" error.
-- ==============================================================================

-- 1. Add the missing column (if it doesn't exist)
ALTER TABLE public.document_requirements
ADD COLUMN IF NOT EXISTS uploaded_at timestamp with time zone;

-- 2. Add 'rejection_reason' column if missing (proactive fix)
ALTER TABLE public.document_requirements
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 3. Ensure 'status' column exists and has a default
ALTER TABLE public.document_requirements 
ALTER COLUMN status SET DEFAULT 'Pending';

-- 4. Re-run Policy Check (Safety)
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;

-- 5. Force update the RPC function to use this column
-- (Re-defining the same function from Step 156 ensures it compiles against the NEW schema)
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
    -- THIS LINE CAUSED THE ERROR BEFORE, NOW 'uploaded_at' EXISTS
    UPDATE public.document_requirements
    SET status = 'Submitted', uploaded_at = now()
    WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
END;
$$;
