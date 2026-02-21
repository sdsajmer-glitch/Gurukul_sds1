-- ==========================================
-- MASTER_V60_VAULT_NODE_RESOLUTION
-- Objective: Resolves the "No document requirements assigned to this node" issue.
-- Automatically creates "Approved" admission stubs for legacy students directly mapped 
-- via student_parents, ensuring they possess legal Vault document nodes.
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
BEGIN
    -- Iterate over EVERY single child visible on the parent's dashboard
    FOR v_child IN SELECT * FROM public.get_my_children_profiles() LOOP
        
        -- Default: Attempt to use the provided ID as an admission ID
        v_target_admission_id := v_child.id;

        -- If this child comes from "STUDENT" source (direct mapping), they might lack an admissions stub.
        -- Create a silent "Approved" admission stub so the Vault has an anchor to attach AES-256 documents.
        IF v_child.source_type = 'STUDENT' THEN
            IF NOT EXISTS (SELECT 1 FROM public.admissions WHERE student_user_id = v_child.id LIMIT 1) THEN
                INSERT INTO public.admissions (
                    applicant_name, 
                    parent_email, 
                    status, 
                    grade,
                    student_user_id,
                    branch_id
                ) VALUES (
                    v_child.applicant_name, 
                    v_child.parent_email, 
                    'Approved', 
                    v_child.grade,
                    v_child.id,
                    v_child.branch_id
                ) RETURNING id INTO v_target_admission_id;
            ELSE
                SELECT id INTO v_target_admission_id FROM public.admissions WHERE student_user_id = v_child.id LIMIT 1;
            END IF;
        END IF;

        -- Provision Core Mandatory Document Slots against the verified admission anchor
        IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id) THEN
            INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
            VALUES 
            (v_target_admission_id, 'Birth Certificate', true, 'Pending'),
            (v_target_admission_id, 'Transfer Certificate', false, 'Pending'),
            (v_target_admission_id, 'Address Proof', true, 'Pending'),
            (v_target_admission_id, 'Passport Photo', true, 'Pending');
        ELSE
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id AND dr.document_name = 'Address Proof') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (v_target_admission_id, 'Address Proof', true, 'Pending');
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id AND dr.document_name = 'Birth Certificate') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (v_target_admission_id, 'Birth Certificate', true, 'Pending');
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_target_admission_id AND dr.document_name = 'Passport Photo') THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (v_target_admission_id, 'Passport Photo', true, 'Pending');
            END IF;
        END IF;

    END LOOP;
END;
$$;


-- Ensure fetching maps back correctly regardless of the node's origin
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
            dr.admission_id,
            -- DYNAMIC RETURN: If the admission is a stub for a student, frontend needs the student's node ID to map it visually
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
           OR a.student_user_id IN (SELECT id FROM public.get_my_children_profiles())
           OR a.id IN (SELECT id FROM public.get_my_children_profiles())
        ORDER BY dr.created_at DESC
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMIT;
