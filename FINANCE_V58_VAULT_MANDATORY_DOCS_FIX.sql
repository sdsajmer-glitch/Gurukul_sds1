-- ==========================================
-- FINANCE_V58_VAULT_MANDATORY_DOCS_FIX
-- Objective: Ensure minimum 3 mandatory documents for verification.
-- ==========================================

BEGIN;

-- FIX: parent_initialize_vault_slots_all to generate min 3 mandatory docs
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
    v_email := public.get_current_user_email();

    FOR v_adm IN 
        SELECT a.id FROM public.admissions a 
        WHERE (a.parent_id = auth.uid() OR (v_email <> '' AND LOWER(a.parent_email) = v_email))
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

COMMIT;
