-- ==============================================================================
-- FIX GENERATION LOGIC (Strict Type Handling with Smart Lookup)
-- ==============================================================================
-- 1. Respects User's requested Token Type (Enquiry vs Admission).
-- 2. Intelligently resolves IDs:
--    - If requesting 'Enquiry' token for an 'Admission' ID, it finds the linked Enquiry ID.
--    - If no linked record exists, it returns a clear error instead of creating a mismatch.

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
            SELECT id INTO v_target_id FROM public.enquiries WHERE admission_id = p_admission_id LIMIT 1;
            
            IF v_target_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'error', 'Cannot create Enquiry Protocol: No Enquiry record found for this student.');
            END IF;
        END IF;

    ELSIF p_code_type = 'Admission' THEN
        -- Case A: The provided ID is already an Admission ID
        IF EXISTS (SELECT 1 FROM public.admissions WHERE id = p_admission_id) THEN
            v_target_id := p_admission_id;
            
        -- Case B: The provided ID is an Enquiry ID -> Find linked Admission (if converted)
        ELSE
            SELECT admission_id INTO v_target_id FROM public.enquiries WHERE id = p_admission_id LIMIT 1;

            IF v_target_id IS NULL THEN
                -- Check if it exists in admissions table directly (User mistake?)
                -- Unlikely if we checked Exists above first.
                RETURN jsonb_build_object('success', false, 'error', 'Cannot create Admission Protocol: This student is not yet admitted.');
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
        p_code_type, -- Strictly respect requested type
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
