-- ==============================================================================
-- FIX: ADMISSION DOCUMENTS UNIQUE CONSTRAINT & UPSERT LOGIC
-- ==============================================================================
-- Resolves: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Also ensures 'parent_complete_document_upload' is robust.

BEGIN;

-- 1. CLEANUP DUPLICATES (If any exist)
-- This ensures the unique constraint can be applied without error.
DELETE FROM public.admission_documents a
USING public.admission_documents b
WHERE a.id < b.id
  AND a.admission_id = b.admission_id
  AND a.requirement_id = b.requirement_id;

-- 2. ENFORCE UNIQUE CONSTRAINT
-- We need a named constraint for ON CONFLICT (admission_id, requirement_id)
ALTER TABLE public.admission_documents 
DROP CONSTRAINT IF EXISTS admission_documents_admission_id_requirement_id_key;

-- If the constraint doesn't exist, add it.
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admission_documents_unique_pair'
    ) THEN
        ALTER TABLE public.admission_documents 
        ADD CONSTRAINT admission_documents_unique_pair UNIQUE (admission_id, requirement_id);
    END IF;
END $$;

-- 3. RE-SYNC RPC FUNCTIONS
-- Ensure parent_complete_document_upload uses the correct constraint

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
    SET status = 'Submitted', updated_at = now()
    WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
END;
$$;

-- 4. IMPROVED INITIALIZATION: Populate standardized slots for new children
CREATE OR REPLACE FUNCTION public.parent_initialize_vault_slots_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_adm record;
BEGIN
    FOR v_adm IN 
        SELECT id FROM public.admissions 
        WHERE (parent_id = auth.uid() OR parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
    LOOP
        -- Insert defaults if none exist (Total of 3 major slots)
        IF NOT EXISTS (SELECT 1 FROM public.document_requirements WHERE admission_id = v_adm.id) THEN
            INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
            VALUES 
            (v_adm.id, 'Aadhar Card / National ID', true, 'Pending'),
            (v_adm.id, 'Birth Certificate', true, 'Pending'),
            (v_adm.id, 'Student Photograph', true, 'Pending');
        END IF;
    END LOOP;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Vault constraints and upload functions synchronized.' as status;
