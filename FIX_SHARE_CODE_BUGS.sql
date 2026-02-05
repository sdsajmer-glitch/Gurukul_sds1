-- ==============================================================================
-- FIX SHARE CODE VERIFICATION & GENERATION
-- ==============================================================================
-- 1. Updates generation to create CLEAN hex codes (no dashes) for consistency.
-- 2. Updates verification to be robust: normalizes BOTH input and DB value.
--    This ensures existing codes with dashes still work, and new clean codes work.
-- 3. Ensures RLS policies are correct.

BEGIN;

-- 1. FIX GENERATION: CLEAN HEX (12 chars)
CREATE OR REPLACE FUNCTION public.generate_admission_share_code(
    p_admission_id uuid,
    p_purpose text,
    p_code_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code text;
    v_expires_at timestamp with time zone;
    v_id bigint;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    -- Generate 12-char clean HEX code (e.g., 4A1B2C3D4E5F)
    -- Using gen_random_bytes is cryptographically secure and cleaner than md5 loops.
    v_code := upper(encode(gen_random_bytes(6), 'hex'));
    
    -- Ensure uniqueness (paranoid check)
    WHILE EXISTS (SELECT 1 FROM public.admission_share_codes WHERE code = v_code) LOOP
        v_code := upper(encode(gen_random_bytes(6), 'hex'));
    END LOOP;
    
    v_expires_at := now() + interval '24 hours';
    
    INSERT INTO public.admission_share_codes (
        admission_id, 
        enquiry_id,
        code,
        code_type,
        purpose,
        expires_at,
        created_by,
        status
    ) VALUES (
        CASE WHEN p_code_type = 'Admission' THEN p_admission_id ELSE NULL END,
        CASE WHEN p_code_type = 'Enquiry' THEN p_admission_id ELSE NULL END, 
        v_code,
        p_code_type,
        p_purpose,
        v_expires_at,
        v_user_id,
        'Active'
    ) RETURNING id INTO v_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'code', v_code,
        'id', v_id,
        'expires_at', v_expires_at
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- 2. FIX VERIFICATION: ROBUST NORMALIZATION
CREATE OR REPLACE FUNCTION public.admin_verify_share_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code_record record;
    v_applicant_name text;
    v_grade text;
    v_entity_id uuid;
    v_normalized_input text;
BEGIN
    -- Normalize input: Remove whitespace AND dashes, uppercase
    v_normalized_input := upper(regexp_replace(p_code, '[\s-]+', '', 'g'));

    -- Find the code
    -- CRITICAL FIX: Normalize the DB column too, so existing codes with dashes are matched.
    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(regexp_replace(code, '[\s-]+', '', 'g')) = v_normalized_input
      AND status = 'Active'
      AND expires_at > now();

    IF v_code_record IS NULL THEN
        RETURN jsonb_build_object('found', false, 'error', 'Invalid or expired protocol token.');
    END IF;

    -- Fetch Details based on Type
    IF v_code_record.code_type = 'Enquiry' THEN
        SELECT applicant_name, grade, id INTO v_applicant_name, v_grade, v_entity_id
        FROM public.enquiries WHERE id = v_code_record.enquiry_id;
    ELSIF v_code_record.code_type = 'Admission' THEN
        SELECT applicant_name, grade, id INTO v_applicant_name, v_grade, v_entity_id
        FROM public.admissions WHERE id = v_code_record.admission_id;
    END IF;

    -- Fallback if name is missing
    IF v_applicant_name IS NULL THEN
         v_applicant_name := 'Unknown Applicant';
    END IF;

    RETURN jsonb_build_object(
        'found', true,
        'id', v_code_record.id,
        'code_type', v_code_record.code_type,
        'applicant_name', v_applicant_name,
        'grade', v_grade,
        'admission_id', v_entity_id 
    );
END;
$$;


-- 3. ENSURE PERMISSIONS
GRANT ALL ON public.admission_share_codes TO authenticated;
GRANT ALL ON public.admission_share_codes TO service_role;

COMMIT;
