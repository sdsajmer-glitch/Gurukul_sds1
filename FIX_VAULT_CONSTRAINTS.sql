-- ==============================================================================
-- FIX: ADD MISSING UNIQUE CONSTRAINTS FOR VAULT UPLOADS
-- ==============================================================================
-- This script adds the necessary UNIQUE constraints to the admission_documents table
-- enabling the ON CONFLICT clauses to work correctly for both Admissions and Enquiries.

BEGIN;

-- 1. Deduplicate admission_documents for Admissions (keep latest)
DELETE FROM public.admission_documents a
USING public.admission_documents b
WHERE a.id < b.id
  AND a.admission_id = b.admission_id
  AND a.requirement_id = b.requirement_id
  AND a.admission_id IS NOT NULL;

-- 2. Add Unique Constraint for Admission Documents
ALTER TABLE public.admission_documents
DROP CONSTRAINT IF EXISTS admission_documents_admission_id_requirement_id_key;

ALTER TABLE public.admission_documents
ADD CONSTRAINT admission_documents_admission_id_requirement_id_key UNIQUE (admission_id, requirement_id);

-- 3. Deduplicate admission_documents for Enquiries (keep latest)
DELETE FROM public.admission_documents a
USING public.admission_documents b
WHERE a.id < b.id
  AND a.enquiry_id = b.enquiry_id
  AND a.requirement_id = b.requirement_id
  AND a.enquiry_id IS NOT NULL;

-- 4. Add Unique Constraint for Enquiry Documents
ALTER TABLE public.admission_documents
DROP CONSTRAINT IF EXISTS admission_documents_enquiry_id_requirement_id_key;

ALTER TABLE public.admission_documents
ADD CONSTRAINT admission_documents_enquiry_id_requirement_id_key UNIQUE (enquiry_id, requirement_id);

-- 5. Update the upload function to use ON CONFLICT for Enquiries too
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
    v_is_enquiry boolean := false;
    v_is_admission boolean := false;
BEGIN
    -- Determine Record Type & Verify Access
    SELECT EXISTS(
        SELECT 1 FROM public.admissions a 
        WHERE a.id = p_admission_id 
          AND (a.parent_id = auth.uid() OR a.parent_email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
    ) INTO v_is_admission;
    
    IF NOT v_is_admission THEN
        SELECT EXISTS(
            SELECT 1 FROM public.enquiries e 
            WHERE e.id = p_admission_id 
              AND (e.user_id = auth.uid() OR e.parent_email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
        ) INTO v_is_enquiry;
    END IF;

    IF NOT (v_is_admission OR v_is_enquiry) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Access Denied: You do not control this node.');
    END IF;

    -- Upsert Record
    IF v_is_admission THEN
        INSERT INTO public.admission_documents (admission_id, requirement_id, file_name, storage_path, file_size, mime_type, uploaded_at, status)
        VALUES (p_admission_id, p_requirement_id, p_file_name, p_storage_path, p_file_size, p_mime_type, now(), 'Submitted')
        ON CONFLICT (admission_id, requirement_id) DO UPDATE 
        SET file_name = EXCLUDED.file_name, storage_path = EXCLUDED.storage_path, file_size = EXCLUDED.file_size, mime_type = EXCLUDED.mime_type, uploaded_at = now(), status = 'Submitted'
        RETURNING id INTO v_doc_id;
    ELSE
        -- USE ON CONFLICT FOR ENQUIRIES TOO
        INSERT INTO public.admission_documents (enquiry_id, requirement_id, file_name, storage_path, file_size, mime_type, uploaded_at, status)
        VALUES (p_admission_id, p_requirement_id, p_file_name, p_storage_path, p_file_size, p_mime_type, now(), 'Submitted')
        ON CONFLICT (enquiry_id, requirement_id) DO UPDATE 
        SET file_name = EXCLUDED.file_name, storage_path = EXCLUDED.storage_path, file_size = EXCLUDED.file_size, mime_type = EXCLUDED.mime_type, uploaded_at = now(), status = 'Submitted'
        RETURNING id INTO v_doc_id;
    END IF;

    -- Update Requirement Status
    UPDATE public.document_requirements
    SET status = 'Submitted', uploaded_at = now()
    WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
END;
$$;

COMMIT;
