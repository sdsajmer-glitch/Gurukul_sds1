-- ==============================================================================
-- FIX: DOCUMENT REQUIREMENTS MASTER SYNCHRONIZATION
-- ==============================================================================
-- 1. Standardizes document naming across the entire platform.
-- 2. Makes the Admission Trigger idempotent (prevents duplicate slots).
-- 3. Synchronizes Parent Vault initialization logic.
-- 4. Deduplicates existing conflicting requirements.
-- ==============================================================================

BEGIN;

-- [A] DEFINE MASTER PROTOCOL CONSTANTS (Logic level)
-- Standard Names:
-- Mandatory: 'Birth Certificate', 'ID Proof', 'Transfer Certificate', 'Student Photograph'
-- Supporting: 'Previous Year Marksheet', 'Address Proof', 'Parent / Guardian ID', 'Medical Fitness Certificate'

-- [B] IDEMPOTENT TRIGGER FOR ADMISSIONS
CREATE OR REPLACE FUNCTION public.assign_default_docs_to_admission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We ONLY insert requirements that don't already exist for this ID 
  -- (e.g. if they were migrated from Enquiry stage)
  
  -- 1. Birth Certificate (Mandatory)
  IF NOT EXISTS (SELECT 1 FROM public.document_requirements WHERE admission_id = new.id AND document_name = 'Birth Certificate') THEN
    INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
    VALUES (new.id, 'Birth Certificate', true, 'Pending');
  END IF;

  -- 2. ID Proof (Mandatory)
  IF NOT EXISTS (SELECT 1 FROM public.document_requirements WHERE admission_id = new.id AND document_name = 'ID Proof') THEN
    INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
    VALUES (new.id, 'ID Proof', true, 'Pending');
  END IF;

  -- 3. Transfer Certificate (Mandatory)
  IF NOT EXISTS (SELECT 1 FROM public.document_requirements WHERE admission_id = new.id AND document_name = 'Transfer Certificate') THEN
    INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
    VALUES (new.id, 'Transfer Certificate', true, 'Pending');
  END IF;

  -- 4. Student Photograph (Mandatory)
  IF NOT EXISTS (SELECT 1 FROM public.document_requirements WHERE admission_id = new.id AND document_name = 'Student Photograph') THEN
    INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
    VALUES (new.id, 'Student Photograph', true, 'Pending');
  END IF;

  RETURN new;
END;
$$;

-- [C] SYNCHRONIZE PARENT VAULT INITIALIZATION
-- This function is called by the Parent Portal to ensure slots exist.
CREATE OR REPLACE FUNCTION public.parent_initialize_vault_slots_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec record;
    v_reqs_mandatory text[] := ARRAY['Birth Certificate', 'ID Proof', 'Transfer Certificate', 'Student Photograph'];
    v_reqs_supporting text[] := ARRAY['Previous Year Marksheet', 'Address Proof', 'Parent / Guardian ID', 'Medical Fitness Certificate'];
    v_req text;
BEGIN
    -- 1. Process Admissions (The primary source)
    FOR v_rec IN 
        SELECT a.id FROM public.admissions a
        WHERE (a.parent_id = auth.uid() OR a.parent_email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
    LOOP
        -- Add Mandatory
        FOREACH v_req IN ARRAY v_reqs_mandatory
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_rec.id AND dr.document_name = v_req) THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (v_rec.id, v_req, true, 'Pending');
            END IF;
        END LOOP;

        -- Add Supporting
        FOREACH v_req IN ARRAY v_reqs_supporting
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = v_rec.id AND dr.document_name = v_req) THEN
                INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
                VALUES (v_rec.id, v_req, false, 'Pending');
            END IF;
        END LOOP;
    END LOOP;

    -- 2. Process Enquiries (Draft phase)
    FOR v_rec IN 
        SELECT e.id FROM public.enquiries e
        WHERE (e.user_id = auth.uid() OR e.parent_email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
          AND e.is_deleted = false
          AND e.admission_id IS NULL -- Only if not already promoted
    LOOP
        FOREACH v_req IN ARRAY v_reqs_mandatory
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.document_requirements dr WHERE dr.enquiry_id = v_rec.id AND dr.document_name = v_req) THEN
                INSERT INTO public.document_requirements (enquiry_id, document_name, is_mandatory, status)
                VALUES (v_rec.id, v_req, true, 'Pending');
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

-- [D] DATA CLEANUP: REMOVE DUPLICATES & STANDARDIZE
-- Standardize names before deduplicating
UPDATE public.document_requirements SET document_name = 'Transfer Certificate' WHERE document_name IN ('Transfer Certificate (TC)', 'TC', 'School TC');
UPDATE public.document_requirements SET document_name = 'ID Proof' WHERE document_name IN ('Aadhar Card / National ID', 'Aadhar Card', 'ID Proof (Aadhar/National ID)');
UPDATE public.document_requirements SET document_name = 'Student Photograph' WHERE document_name IN ('Student Photo', 'Passport Size Photo', 'Photograph');
UPDATE public.document_requirements SET document_name = 'Previous Year Marksheet' WHERE document_name IN ('Previous Report Card', 'Report Card', 'Grade Sheet');

-- Deduplicate document_requirements (Keep the one with a file or the status 'Verified')
DELETE FROM public.document_requirements d1
USING public.document_requirements d2
WHERE d1.id < d2.id
  AND d1.document_name = d2.document_name
  AND (
    (d1.admission_id = d2.admission_id AND d1.admission_id IS NOT NULL)
    OR
    (d1.enquiry_id = d2.enquiry_id AND d1.enquiry_id IS NOT NULL)
  );

COMMIT;

-- VERIFICATION
SELECT 'SUCCESS: Document requirements standardized and deduplicated.' as status;
