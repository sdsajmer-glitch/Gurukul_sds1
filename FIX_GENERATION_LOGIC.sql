-- ==============================================================================
-- FIX GENERATION LOGIC (Smart Lookup + Fuzzy Fallback)
-- ==============================================================================
-- 1. Updates generation to strictly respect requested Type (Enquiry/Admission).
-- 2. Adds "Fuzzy Matching" (Name + Email) to find linked Enquiries when explicit DB links (FKs) are missing.
--    This resolves the "Unable to create enquiry code" issue for students who were admitted but not explicitly linked.

CREATE OR REPLACE FUNCTION public.generate_admission_share_code(
    p_admission_id uuid, -- This is the Entity ID provided by the UI (could be Enquiry or Admission ID)
    p_purpose text,
    p_code_type text     -- The requested type ('Enquiry' or 'Admission')
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code text;
    v_exists boolean;
    v_target_id uuid;
    v_id bigint;
BEGIN
    -- 1. RESOLVE TARGET ID BASED ON REQUESTED TYPE
    IF p_code_type = 'Enquiry' THEN
        -- Case A: The provided ID is already an Enquiry ID
        IF EXISTS (SELECT 1 FROM public.enquiries WHERE id = p_admission_id) THEN
            v_target_id := p_admission_id;
        
        -- Case B: The provided ID is an Admission ID -> Find linked Enquiry
        ELSE
            -- 1. Try direct link (admission_id column)
            SELECT id INTO v_target_id FROM public.enquiries WHERE admission_id = p_admission_id LIMIT 1;
            
            -- 2. Try Fuzzy Link (Matching Name + Parent Email) if direct link fails
            IF v_target_id IS NULL THEN
                SELECT e.id INTO v_target_id 
                FROM public.enquiries e
                JOIN public.admissions a ON a.id = p_admission_id
                WHERE lower(e.applicant_name) = lower(a.applicant_name) 
                  AND (lower(e.parent_email) = lower(a.parent_email) OR lower(e.parent_email) IS NULL)
                ORDER BY e.received_at DESC
                LIMIT 1;
            END IF;

            IF v_target_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'error', 'Cannot create Enquiry Protocol: No Enquiry record found matching this student.');
            END IF;
        END IF;

    ELSIF p_code_type = 'Admission' THEN
        -- Case A: The provided ID is already an Admission ID
        IF EXISTS (SELECT 1 FROM public.admissions WHERE id = p_admission_id) THEN
            v_target_id := p_admission_id;
            
        -- Case B: The provided ID is an Enquiry ID -> Find linked Admission (if converted)
        ELSE
            SELECT admission_id INTO v_target_id FROM public.enquiries WHERE id = p_admission_id LIMIT 1;

            -- Try Fuzzy Link (Name + Email) if direct link fails
             IF v_target_id IS NULL THEN
                SELECT a.id INTO v_target_id 
                FROM public.admissions a
                JOIN public.enquiries e ON e.id = p_admission_id
                WHERE lower(a.applicant_name) = lower(e.applicant_name) 
                  AND lower(a.parent_email) = lower(e.parent_email)
                LIMIT 1;
            END IF;

            IF v_target_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'error', 'Cannot create Admission Protocol: This student has not been admitted yet.');
            END IF;
        END IF;
    ELSE
         RETURN jsonb_build_object('success', false, 'error', 'Invalid Protocol Type specified.');
    END IF;

    -- 2. GENERATE UNIQUE CODE
    LOOP
        v_code := upper(encode(gen_random_bytes(6), 'hex'));
        SELECT EXISTS(SELECT 1 FROM public.admission_share_codes WHERE code = v_code) INTO v_exists;
        IF NOT v_exists THEN EXIT; END IF;
    END LOOP;

    -- 3. INSERT RECORD
    INSERT INTO public.admission_share_codes (
        code, 
        admission_id,
        enquiry_id,
        code_type, 
        purpose,
        status,
        created_by,
        expires_at
    )
    VALUES (
        v_code,
        CASE WHEN p_code_type = 'Admission' THEN v_target_id ELSE NULL END,
        CASE WHEN p_code_type = 'Enquiry' THEN v_target_id ELSE NULL END, 
        p_code_type, 
        p_purpose,
        'Active',
        auth.uid(),
        now() + interval '1 day'
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'success', true,
        'code', v_code,
        'id', v_id,
        'type', p_code_type
    );
END;
$$;
