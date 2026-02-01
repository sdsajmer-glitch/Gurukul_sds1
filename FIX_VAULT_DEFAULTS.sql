-- ==============================================================================
-- FIX: Update Default Document List for Artifact Vault
-- Adds comprehensive list of required documents for new admissions
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.parent_initialize_vault_slots_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_adm record;
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
    FOR v_adm IN 
        SELECT id FROM public.admissions 
        WHERE (parent_id = auth.uid() OR parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
    LOOP
        FOREACH v_req IN ARRAY v_reqs
        LOOP
            -- Insert default if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements WHERE admission_id = v_adm.id AND document_name = v_req) THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (
                    v_adm.id, 
                    v_req, 
                    CASE 
                        WHEN v_req IN ('Birth Certificate', 'Aadhar Card / National ID', 'Student Photograph') THEN true 
                        ELSE false 
                    END, 
                    'Pending'
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$;
