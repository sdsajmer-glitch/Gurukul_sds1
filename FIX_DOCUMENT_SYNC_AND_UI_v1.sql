-- Admission Document Sync & UI Enhancement Fix
-- Relinks orphaned enquiry documents to their corresponding admissions and updates the upload logic.

BEGIN;

-- 1. Migration: Link orphaned document_requirements to admissions
UPDATE public.document_requirements dr
SET admission_id = e.admission_id
FROM public.enquiries e
WHERE dr.enquiry_id = e.id
  AND dr.admission_id IS NULL
  AND e.admission_id IS NOT NULL;

-- 2. Migration: Link orphaned admission_documents to admissions
UPDATE public.admission_documents ad
SET admission_id = e.admission_id
FROM public.enquiries e
WHERE ad.enquiry_id = e.id
  AND ad.admission_id IS NULL
  AND e.admission_id IS NOT NULL;

-- 3. Update parent_complete_document_upload RPC
-- Automatically resolves admission_id from enquiry_id if one exists.
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
    SELECT email INTO v_user_email FROM public.profiles WHERE id = auth.uid();

    -- Resolve identity: Is p_admission_id an Admission or an Enquiry?
    -- If it's an Enquiry, check if it has a converted Admission.
    SELECT id, admission_id INTO v_real_enquiry_id, v_real_admission_id 
    FROM public.enquiries 
    WHERE id = p_admission_id 
      AND (user_id = auth.uid() OR LOWER(parent_email) = LOWER(v_user_email));

    -- If not found as an enquiry, check if it's a direct Admission ID
    IF v_real_admission_id IS NULL AND v_real_enquiry_id IS NULL THEN
        SELECT id INTO v_real_admission_id 
        FROM public.admissions 
        WHERE id = p_admission_id 
          AND (parent_id = auth.uid() OR LOWER(parent_email) = LOWER(v_user_email));
    END IF;

    -- Final fallback: If we found an enquiry but no admission_id was cached there, 
    -- we use the enquiry_id for linking until conversion happens.
    
    IF v_real_admission_id IS NULL AND v_real_enquiry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Access Denied: Node not found or unauthorized.');
    END IF;

    -- Upsert with preference for admission_id
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

    -- Mark requirement as submitted
    UPDATE public.document_requirements
    SET status = 'Submitted', updated_at = now()
    WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
END;
$$;

COMMIT;
