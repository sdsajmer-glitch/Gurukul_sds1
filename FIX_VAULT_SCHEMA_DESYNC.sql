-- ==============================================================================
-- DATABASE REFRACTOR: VAULT SCHEMA SYNCHRONIZATION
-- ==============================================================================
-- This script resolves the "column dr.uploaded_at does not exist" error and 
-- ensures all required instructor/instructional fields are present in the 
-- Vault (Documents) module.

BEGIN;

-- 1. ENHANCE TABLE: document_requirements
-- Ensure all columns required by the Parent Portal UI exist.
ALTER TABLE public.document_requirements 
ADD COLUMN IF NOT EXISTS uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS notes_for_parent text;

-- 2. ENHANCE TABLE: admission_documents
-- Ensure internal alignment for document artifacts.
ALTER TABLE public.admission_documents 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Submitted',
ADD COLUMN IF NOT EXISTS uploaded_at timestamptz DEFAULT now();

-- 3. FIX: parent_get_document_requirements (Safer Selection)
-- Updated to explicitly handle the unified document ledger.
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
    -- Get user email safely
    SELECT p.email INTO v_email FROM public.profiles p WHERE p.id = p_user_id;

    SELECT jsonb_agg(sub) INTO v_result
    FROM (
        SELECT 
            dr.id,
            dr.admission_id,
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
        INNER JOIN public.admissions a ON dr.admission_id = a.id
        WHERE a.parent_id = p_user_id 
           OR (v_email IS NOT NULL AND LOWER(a.parent_email) = LOWER(v_email))
        ORDER BY dr.created_at DESC
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 4. FIX: parent_initialize_vault_slots_all
-- Ensures defaults are created with instruction nodes.
CREATE OR REPLACE FUNCTION public.parent_initialize_vault_slots_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_adm record;
    v_email text;
BEGIN
    v_email := LOWER(COALESCE(
        (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()),
        (SELECT auth.jwt() ->> 'email'),
        ''
    ));

    FOR v_adm IN 
        SELECT a.id FROM public.admissions a 
        WHERE (a.parent_id = auth.uid() OR (v_email <> '' AND LOWER(a.parent_email) = v_email))
    LOOP
        -- Insert defaults if none exist
        IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_adm.id) THEN
            INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status, notes_for_parent)
            VALUES 
            (v_adm.id, 'Birth Certificate', true, 'Pending', 'Official government-issued birth certificate node.'),
            (v_adm.id, 'Transfer Certificate', false, 'Pending', 'Leaving certificate from the previously attended node.'),
            (v_adm.id, 'Passport Photo', true, 'Pending', 'Recent biometric portrait identity record.');
        END IF;
    END LOOP;
END;
$$;

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

COMMIT;
