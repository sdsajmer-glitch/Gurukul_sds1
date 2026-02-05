-- ==============================================================================
-- FIX PERMISSIONS AND DUPLICATION
-- 1. Prevent duplicate active share codes for same admission/enquiry and type.
-- 2. Enhanced verification data (Include contact info for Enquiry codes).
-- 3. Standardize RLS for share codes.
-- ==============================================================================

BEGIN;

-- 1. UPDATE GENERATION LOGIC: IDEMPOTENCY & DUPLICATION CHECK
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
    v_existing_code record;
    v_id bigint;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    -- CHECK FOR EXISTING ACTIVE CODE
    -- We allow only one active code per entity and type to prevent spam/confusion.
    SELECT * INTO v_existing_code
    FROM public.admission_share_codes
    WHERE (admission_id = p_admission_id OR enquiry_id = p_admission_id)
      AND code_type = p_code_type
      AND status = 'Active'
      AND expires_at > now()
    LIMIT 1;

    IF v_existing_code.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Retrieved existing active protocol key.',
            'code', v_existing_code.code,
            'id', v_existing_code.id,
            'expires_at', v_existing_code.expires_at
        );
    END IF;

    -- Generate New Code
    v_code := upper(
        substring(md5(random()::text || clock_timestamp()::text) from 1 for 4) || '-' || 
        substring(md5(random()::text || clock_timestamp()::text) from 5 for 4) || '-' || 
        substring(md5(random()::text || clock_timestamp()::text) from 9 for 4)
    );
    
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

-- 2. ENHANCED VERIFICATION DATA: INCLUDE CONTACT INFO
CREATE OR REPLACE FUNCTION public.admin_verify_share_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code_record record;
    v_applicant_name text;
    v_grade text;
    v_parent_email text;
    v_parent_phone text;
    v_entity_id uuid;
    v_normalized_input text;
BEGIN
    v_normalized_input := upper(regexp_replace(p_code, '[\s-]+', '', 'g'));

    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(regexp_replace(code, '[\s-]+', '', 'g')) = v_normalized_input
      AND status = 'Active'
      AND expires_at > now();

    IF v_code_record IS NULL THEN
        RETURN jsonb_build_object('found', false, 'error', 'Invalid or expired protocol token.');
    END IF;

    IF v_code_record.code_type = 'Enquiry' THEN
        SELECT applicant_name, grade, parent_email, parent_phone, id 
        INTO v_applicant_name, v_grade, v_parent_email, v_parent_phone, v_entity_id
        FROM public.enquiries WHERE id = v_code_record.enquiry_id;
    ELSIF v_code_record.code_type = 'Admission' THEN
        SELECT applicant_name, grade, parent_email, parent_phone, id 
        INTO v_applicant_name, v_grade, v_parent_email, v_parent_phone, v_entity_id
        FROM public.admissions WHERE id = v_code_record.admission_id;
    END IF;

    IF v_applicant_name IS NULL THEN v_applicant_name := 'Unknown Applicant'; END IF;

    RETURN jsonb_build_object(
        'found', true,
        'id', v_code_record.id,
        'code_type', v_code_record.code_type,
        'applicant_name', v_applicant_name,
        'grade', v_grade,
        'contact_email', v_parent_email,
        'contact_phone', v_parent_phone,
        'admission_id', v_entity_id 
    );
END;
$$;

-- 3. ENSURE RLS POLICIES FOR SHARE CODES
-- We already have "Users can manage their own share codes", but let's make sure service_role and authenticated have access to the table itself.
GRANT ALL ON public.admission_share_codes TO authenticated;
GRANT ALL ON public.admission_share_codes TO service_role;

COMMIT;
