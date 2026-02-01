-- ==============================================================================
-- FINAL FIX V2: Artifact Vault Sync Protocols
-- includes DROP statements to resolve "cannot change return type" errors
-- ==============================================================================

-- 1. Ensure Table Structures
CREATE TABLE IF NOT EXISTS public.document_requirements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admission_id uuid NOT NULL,
    document_name text NOT NULL,
    is_mandatory boolean DEFAULT false,
    status text DEFAULT 'Pending',
    rejection_reason text,
    uploaded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admission_documents (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admission_id uuid NOT NULL,
    requirement_id bigint,
    file_name text,
    storage_path text,
    file_size bigint,
    mime_type text,
    status text DEFAULT 'Submitted',
    uploaded_at timestamp with time zone DEFAULT now(),
    UNIQUE(admission_id, requirement_id)
);

-- 2. DROP Existing Functions to prevent "Return Type" conflicts
DROP FUNCTION IF EXISTS public.parent_get_document_requirements(uuid);
DROP FUNCTION IF EXISTS public.parent_complete_document_upload(bigint, uuid, text, text, bigint, text);
-- Also drop old signature versions if they exist to be safe
DROP FUNCTION IF EXISTS public.parent_complete_document_upload(uuid, text, text, bigint, text); 

-- 3. Re-Create RPC: GET Requirements
CREATE OR REPLACE FUNCTION public.parent_get_document_requirements(p_user_id uuid)
RETURNS SETOF public.document_requirements
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT dr.* 
    FROM public.document_requirements dr
    JOIN public.admissions a ON dr.admission_id = a.id
    WHERE a.parent_id = p_user_id 
       OR a.parent_email = (SELECT email FROM public.profiles WHERE id = p_user_id);
$$;

-- 4. Re-Create RPC: COMPLETE Upload
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

-- 5. Helper: Initialize Default slots
DROP FUNCTION IF EXISTS public.parent_initialize_vault_slots_all();

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
        -- Insert defaults if none exist
        IF NOT EXISTS (SELECT 1 FROM public.document_requirements WHERE admission_id = v_adm.id) THEN
            INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
            VALUES 
            (v_adm.id, 'Birth Certificate', true, 'Pending'),
            (v_adm.id, 'Transfer Certificate', false, 'Pending'),
            (v_adm.id, 'Passport Photo', true, 'Pending');
        END IF;
    END LOOP;
END;
$$;
