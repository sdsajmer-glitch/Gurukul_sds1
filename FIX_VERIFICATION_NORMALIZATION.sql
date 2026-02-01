-- ==============================================================================
-- FIX VERIFICATION NORMALIZATION
-- ==============================================================================
-- Updates admin_verify_share_code to strip dashes (-) and whitespace.
-- This prevents "Invalid Token" errors when codes are entered with formatting.

CREATE OR REPLACE FUNCTION public.admin_verify_share_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code_record record;
    v_result jsonb;
    v_applicant_name text;
    v_grade text;
    v_entity_id uuid;
BEGIN
    -- Normalize code: Remove whitespace AND dashes, uppercase
    p_code := upper(regexp_replace(p_code, '[\s-]+', '', 'g'));

    -- Find the code
    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(code) = p_code
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

    IF v_applicant_name IS NULL THEN
         RETURN jsonb_build_object('found', false, 'error', 'Linked identity record not found.');
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
