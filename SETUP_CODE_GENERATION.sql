-- ==============================================================================
-- SETUP AUTOMATIC CODE GENERATION (ENQUIRY & ADMISSION)
-- ==============================================================================
-- 1. Creates a trigger function to auto-generate secure 12-char HEX tokens.
-- 2. Attaches triggers to `enquiries` and `admissions` tables.
-- 3. Backfills tokens for ALL existing records so they can be verified immediately.

CREATE OR REPLACE FUNCTION public.fn_auto_generate_share_code()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_code text;
    v_exists boolean;
BEGIN
    LOOP
        -- Generate 12-char HEX code (Clean, no dashes)
        v_code := upper(encode(gen_random_bytes(6), 'hex'));
        
        -- Check uniqueness
        SELECT EXISTS(SELECT 1 FROM public.admission_share_codes WHERE code = v_code) INTO v_exists;
        IF NOT v_exists THEN
            EXIT;
        END IF;
    END LOOP;

    IF TG_TABLE_NAME = 'enquiries' THEN
        INSERT INTO public.admission_share_codes (code, enquiry_id, code_type, purpose)
        VALUES (v_code, NEW.id, 'Enquiry', 'Identity Handshake');
    ELSIF TG_TABLE_NAME = 'admissions' THEN
        INSERT INTO public.admission_share_codes (code, admission_id, code_type, purpose)
        VALUES (v_code, NEW.id, 'Admission', 'Enrollment Protocol');
    END IF;

    RETURN NEW;
END;
$$;

-- Drop existing triggers to prevent duplicates
DROP TRIGGER IF EXISTS trg_generate_share_code_enquiry ON public.enquiries;
DROP TRIGGER IF EXISTS trg_generate_share_code_admission ON public.admissions;

-- Create Triggers
CREATE TRIGGER trg_generate_share_code_enquiry
AFTER INSERT ON public.enquiries
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_generate_share_code();

CREATE TRIGGER trg_generate_share_code_admission
AFTER INSERT ON public.admissions
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_generate_share_code();

-- BACKFILL: Generate codes for existing records missing them
DO $$
DECLARE
    r record;
    v_code text;
BEGIN
    -- Enquiries Backfill
    FOR r IN SELECT id FROM public.enquiries WHERE id NOT IN (SELECT enquiry_id FROM public.admission_share_codes WHERE enquiry_id IS NOT NULL) LOOP
        -- Generate Code
        LOOP
            v_code := upper(encode(gen_random_bytes(6), 'hex'));
            IF NOT EXISTS(SELECT 1 FROM public.admission_share_codes WHERE code = v_code) THEN EXIT; END IF;
        END LOOP;
        
        INSERT INTO public.admission_share_codes (code, enquiry_id, code_type, purpose)
        VALUES (v_code, r.id, 'Enquiry', 'Identity Handshake (Backfill)');
    END LOOP;

    -- Admissions Backfill
    FOR r IN SELECT id FROM public.admissions WHERE id NOT IN (SELECT admission_id FROM public.admission_share_codes WHERE admission_id IS NOT NULL) LOOP
        LOOP
            v_code := upper(encode(gen_random_bytes(6), 'hex'));
            IF NOT EXISTS(SELECT 1 FROM public.admission_share_codes WHERE code = v_code) THEN EXIT; END IF;
        END LOOP;
        
        INSERT INTO public.admission_share_codes (code, admission_id, code_type, purpose)
        VALUES (v_code, r.id, 'Admission', 'Enrollment Protocol (Backfill)');
    END LOOP;
END;
$$;
