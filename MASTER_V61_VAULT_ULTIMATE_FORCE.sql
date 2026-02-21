-- ==========================================
-- MASTER_V61_VAULT_ULTIMATE_FORCE.sql
-- Objective: Brute-forces Vault Document slot initialization for ALL valid nodes.
-- Eliminates complex nested subqueries that could cause RLS filtering issues during RPC.
-- ==========================================

BEGIN;

CREATE OR REPLACE FUNCTION public.parent_initialize_vault_slots_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_child record;
    v_target_admission_id uuid;
    v_uid uuid;
    v_email text;
BEGIN
    v_uid := auth.uid();
    v_email := public.get_current_user_email();

    -- 1. Initialize for native Admissions linked to parent
    FOR v_child IN 
        SELECT a.id FROM public.admissions a 
        WHERE a.parent_id = v_uid 
           OR a.parent_id IN (SELECT p.id FROM public.profiles p WHERE p.email = v_email)
           OR (v_email <> '' AND LOWER(a.parent_email) = LOWER(v_email))
    LOOP
        v_target_admission_id := v_child.id;
        
        IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id) THEN
            INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status) VALUES 
            (v_target_admission_id, 'Birth Certificate', true, 'Pending'),
            (v_target_admission_id, 'Transfer Certificate', false, 'Pending'),
            (v_target_admission_id, 'Address Proof', true, 'Pending'),
            (v_target_admission_id, 'Passport Photo', true, 'Pending');
        ELSE
            -- Fill missing mandatory slots
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id AND dr.document_name = 'Address Proof') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status) VALUES (v_target_admission_id, 'Address Proof', true, 'Pending');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id AND dr.document_name = 'Birth Certificate') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status) VALUES (v_target_admission_id, 'Birth Certificate', true, 'Pending');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id AND dr.document_name = 'Passport Photo') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status) VALUES (v_target_admission_id, 'Passport Photo', true, 'Pending');
            END IF;
        END IF;
    END LOOP;

    -- 2. Initialize for Enrolled Students dynamically mapped
    FOR v_child IN SELECT * FROM public.get_my_children_profiles() LOOP
        v_target_admission_id := v_child.id;

        -- Create stub for students lacking an admission ID
        IF v_child.source_type = 'STUDENT' THEN
            IF NOT EXISTS (SELECT 1 FROM public.admissions WHERE student_user_id = v_child.id LIMIT 1) THEN
                INSERT INTO public.admissions (
                    applicant_name, parent_email, status, grade, student_user_id, branch_id
                ) VALUES (
                    v_child.applicant_name, v_child.parent_email, 'Approved', v_child.grade, v_child.id, v_child.branch_id
                ) RETURNING id INTO v_target_admission_id;
            ELSE
                SELECT id INTO v_target_admission_id FROM public.admissions WHERE student_user_id = v_child.id LIMIT 1;
            END IF;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id) THEN
            INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status) VALUES 
            (v_target_admission_id, 'Birth Certificate', true, 'Pending'),
            (v_target_admission_id, 'Transfer Certificate', false, 'Pending'),
            (v_target_admission_id, 'Address Proof', true, 'Pending'),
            (v_target_admission_id, 'Passport Photo', true, 'Pending');
        ELSE
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id AND dr.document_name = 'Address Proof') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status) VALUES (v_target_admission_id, 'Address Proof', true, 'Pending');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id AND dr.document_name = 'Birth Certificate') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status) VALUES (v_target_admission_id, 'Birth Certificate', true, 'Pending');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id AND dr.document_name = 'Passport Photo') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status) VALUES (v_target_admission_id, 'Passport Photo', true, 'Pending');
            END IF;
        END IF;
    END LOOP;
END;
$$;


-- Simplify the fetcher logic without nested SECURITY DEFINER calls which break under strict RLS
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

    -- Store valid target IDs in temporary array to prevent recursive RLS failures
    -- Just fetch requirements for all Admissions mapped to this parent.
    SELECT jsonb_agg(sub) INTO v_result
    FROM (
        SELECT 
            dr.id AS requirement_id,
            dr.id,
            dr.admission_id,
            COALESCE(a.student_user_id, a.id) AS frontend_mapped_id, 
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
           -- Also include ANY admission tracking these student IDs natively
           OR a.student_user_id IN (
               SELECT sp.student_id FROM public.student_parents sp WHERE sp.parent_id = p_user_id AND sp.status = 'active'
           )
           OR a.student_user_id IN (
               SELECT stp.user_id FROM public.student_profiles stp WHERE stp.user_id = p_user_id
           )
        ORDER BY dr.created_at DESC
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMIT;
