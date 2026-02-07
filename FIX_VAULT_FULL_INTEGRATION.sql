-- ==============================================================================
-- FIX: INTEGRATE VAULT WITH ENQUIRIES & ADMISSIONS
-- ==============================================================================

BEGIN;

-- 1. Schema Updates: Add enquiry_id support
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_requirements' AND column_name = 'enquiry_id') THEN
        ALTER TABLE public.document_requirements ADD COLUMN enquiry_id uuid REFERENCES public.enquiries(id) ON DELETE CASCADE;
    END IF;

    -- make admission_id nullable to support Enquiries
    ALTER TABLE public.document_requirements ALTER COLUMN admission_id DROP NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admission_documents' AND column_name = 'enquiry_id') THEN
        ALTER TABLE public.admission_documents ADD COLUMN enquiry_id uuid REFERENCES public.enquiries(id) ON DELETE CASCADE;
    END IF;

    -- make admission_id nullable
    ALTER TABLE public.admission_documents ALTER COLUMN admission_id DROP NOT NULL;
END $$;

-- 2. Drop Helper Functions to allow changing return types/signatures
DROP FUNCTION IF EXISTS public.parent_get_document_requirements(uuid);
DROP FUNCTION IF EXISTS public.parent_complete_document_upload(bigint, uuid, text, text, bigint, text);
DROP FUNCTION IF EXISTS public.parent_initialize_vault_slots_all();

-- 3. Function: Initialize Slots (Admissions AND Enquiries)
CREATE OR REPLACE FUNCTION public.parent_initialize_vault_slots_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec record;
    v_reqs text[] := ARRAY[
        'Birth Certificate', 
        'Aadhar Card / National ID', 
        'Transfer Certificate (TC)', 
        'Previous Year Marksheet', 
        'Address Proof', 
        'Parent / Guardian ID', 
        'Medical Fitness Certificate', 
        'Student Photograph'
    ];
    v_req text;
BEGIN
    -- A. Process Admissions
    FOR v_rec IN 
        SELECT a.id FROM public.admissions a
        WHERE (a.parent_id = auth.uid() OR a.parent_email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
    LOOP
        FOREACH v_req IN ARRAY v_reqs
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_rec.id AND dr.document_name = v_req) THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (v_rec.id, v_req, 
                    CASE WHEN v_req IN ('Birth Certificate', 'Aadhar Card / National ID', 'Student Photograph') THEN true ELSE false END, 
                    'Pending');
            END IF;
        END LOOP;
    END LOOP;

    -- B. Process Enquiries (Draft/Applied)
    FOR v_rec IN 
        SELECT e.id FROM public.enquiries e
        WHERE (e.user_id = auth.uid() OR e.parent_email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
          AND e.is_deleted = false
          AND (e.admission_id IS NULL) -- Only if not already converted/linked
    LOOP
        FOREACH v_req IN ARRAY v_reqs
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.enquiry_id = v_rec.id AND dr.document_name = v_req) THEN
                INSERT INTO public.document_requirements (enquiry_id, document_name, is_mandatory, status)
                VALUES (v_rec.id, v_req, 
                    CASE WHEN v_req IN ('Birth Certificate', 'Aadhar Card / National ID', 'Student Photograph') THEN true ELSE false END, 
                    'Pending');
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

-- 4. Function: Get Requirements (Unified)
CREATE OR REPLACE FUNCTION public.parent_get_document_requirements(p_user_id uuid)
RETURNS TABLE (
    id bigint,
    admission_id uuid, -- We alias this to be the "Child ID" (Admission OR Enquiry)
    document_name text,
    is_mandatory boolean,
    status text,
    rejection_reason text,
    uploaded_at timestamp with time zone,
    created_at timestamp with time zone,
    admission_documents jsonb -- Return generic JSON to avoid table type conflicts
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
            WHERE (ad.requirement_id = dr.id)
        ) AS admission_documents
    FROM public.document_requirements dr
    LEFT JOIN public.admissions a ON dr.admission_id = a.id
    LEFT JOIN public.enquiries e ON dr.enquiry_id = e.id
    WHERE 
        -- Parent Owns Admission
        (a.parent_id = p_user_id OR a.parent_email = (SELECT p.email FROM public.profiles p WHERE p.id = p_user_id))
        OR
        -- Parent Owns Enquiry
        (e.user_id = p_user_id OR e.parent_email = (SELECT p.email FROM public.profiles p WHERE p.id = p_user_id))
    ORDER BY dr.is_mandatory DESC, dr.document_name ASC;
END;
$$;

-- 5. Function: Complete Upload (Unified)
CREATE OR REPLACE FUNCTION public.parent_complete_document_upload(
    p_requirement_id bigint,  
    p_admission_id uuid, -- This is effectively "Child ID" (Admission OR Enquiry)
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
    -- Determine Record Type & Verify Access (with Aliasing)
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
        -- Helper: Manual Upsert for Enquiries
        UPDATE public.admission_documents
        SET 
            file_name = p_file_name,
            storage_path = p_storage_path,
            file_size = p_file_size,
            mime_type = p_mime_type,
            uploaded_at = now(),
            status = 'Submitted'
        WHERE enquiry_id = p_admission_id AND requirement_id = p_requirement_id
        RETURNING id INTO v_doc_id;

        IF v_doc_id IS NULL THEN
            INSERT INTO public.admission_documents (enquiry_id, requirement_id, file_name, storage_path, file_size, mime_type, uploaded_at, status)
            VALUES (p_admission_id, p_requirement_id, p_file_name, p_storage_path, p_file_size, p_mime_type, now(), 'Submitted')
            RETURNING id INTO v_doc_id;
        END IF;
    END IF;

    -- Update Requirement Status
    UPDATE public.document_requirements
    SET status = 'Submitted', uploaded_at = now()
    WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
END;
$$;

COMMIT;
