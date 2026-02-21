-- ==========================================
-- FINANCE_V59_VAULT_NODE_RESOLUTION
-- Objective: Fix 0 documents showing for students mapped via student_parents or legacy links.
-- Ensures Vault correctly resolves student_id -> admission_id and provisions slots for all valid nodes.
-- ==========================================

BEGIN;

CREATE OR REPLACE FUNCTION public.parent_initialize_vault_slots_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_adm record;
    v_email text;
    v_uid uuid;
BEGIN
    v_uid := auth.uid();
    v_email := public.get_current_user_email();

    -- Find ALL admissions linked to the parent through native parent mapping OR student_profile mapping
    FOR v_adm IN 
        SELECT DISTINCT a.id 
        FROM public.admissions a
        WHERE a.parent_id = v_uid
           OR (v_email <> '' AND LOWER(a.parent_email) = v_email)
           OR a.id IN (SELECT id FROM public.get_my_children_profiles())
           OR a.student_user_id IN (SELECT id FROM public.get_my_children_profiles())
           OR a.student_user_id IN (SELECT student_user_id FROM public.get_my_children_profiles() WHERE student_user_id IS NOT NULL)
    LOOP
        -- Insert defaults if none exist
        IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_adm.id) THEN
            INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
            VALUES 
            (v_adm.id, 'Birth Certificate', true, 'Pending'),
            (v_adm.id, 'Transfer Certificate', false, 'Pending'),
            (v_adm.id, 'Address Proof', true, 'Pending'),
            (v_adm.id, 'Passport Photo', true, 'Pending');
        ELSE
            -- Ensure Address proof exists as mandatory if missing
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_adm.id AND dr.document_name = 'Address Proof') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (v_adm.id, 'Address Proof', true, 'Pending');
            END IF;
            
            -- Ensure Birth Certificate exists as mandatory if missing
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_adm.id AND dr.document_name = 'Birth Certificate') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (v_adm.id, 'Birth Certificate', true, 'Pending');
            END IF;
            
            -- Ensure Passport Photo exists as mandatory if missing
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_adm.id AND dr.document_name = 'Passport Photo') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (v_adm.id, 'Passport Photo', true, 'Pending');
            END IF;
        END IF;
    END LOOP;
END;
$$;


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
    SELECT p.email INTO v_email FROM public.profiles p WHERE p.id = p_user_id;

    SELECT jsonb_agg(sub) INTO v_result
    FROM (
        SELECT 
            dr.id AS requirement_id,
            dr.id,
            -- DYNAMIC MAPPING: Return the underlying node ID if this admission maps to a student_profile
            COALESCE(
               (SELECT cp.id FROM public.get_my_children_profiles() cp WHERE cp.student_user_id = a.student_user_id AND cp.student_user_id IS NOT NULL LIMIT 1),
               a.id
            ) AS admission_id,
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
           OR LOWER(a.parent_email) = LOWER(v_email)
           OR a.id IN (SELECT id FROM public.get_my_children_profiles())
           OR a.student_user_id IN (SELECT id FROM public.get_my_children_profiles())
           OR a.student_user_id IN (SELECT student_user_id FROM public.get_my_children_profiles() WHERE student_user_id IS NOT NULL)
        ORDER BY dr.created_at DESC
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMIT;
