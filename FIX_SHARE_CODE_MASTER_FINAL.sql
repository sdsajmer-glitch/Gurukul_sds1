-- ============================================
-- SHARE CODE SYSTEM MASTER FIX v2.0
-- ============================================

-- 1. Ensure Table Structure
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admission_share_codes') THEN
        CREATE TABLE public.admission_share_codes (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            admission_id uuid,
            enquiry_id uuid,
            code text NOT NULL,
            code_type text NOT NULL, -- 'Enquiry' or 'Admission'
            purpose text,
            status text DEFAULT 'Active',
            expires_at timestamp with time zone,
            created_by uuid REFERENCES auth.users(id),
            created_at timestamp with time zone DEFAULT now(),
            redeemed_by uuid REFERENCES auth.users(id),
            redeemed_at timestamp with time zone,
            attempts integer DEFAULT 0,
            locked_until timestamp with time zone
        );
    END IF;
END $$;

-- 2. Grant Permissions
GRANT ALL ON public.admission_share_codes TO authenticated, service_role;

-- 3. Idempotent Generation Function
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
    
    -- CHECK FOR EXISTING ACTIVE CODE (Requirement: Prevent duplicates)
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
    
    -- Generate New Code (Format: XXXX-XXXX-XXXX)
    v_code := upper(
        substring(md5(random()::text || clock_timestamp()::text) from 1 for 4) || '-' || 
        substring(md5(random()::text || clock_timestamp()::text) from 5 for 4) || '-' || 
        substring(md5(random()::text || clock_timestamp()::text) from 9 for 4)
    );
    
    -- Default expiration: 7 days for more reliability
    v_expires_at := now() + interval '7 days';
    
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

-- 4. Enhanced Verification Function (Resilient Fallback)
CREATE OR REPLACE FUNCTION public.admin_verify_share_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code_record record;
    v_applicant_name text;
    v_grade text;
    v_contact_email text;
    v_contact_phone text;
    v_normalized_input text;
    v_found_in_admission boolean := false;
BEGIN
    -- Normalize input (remove dashes/spaces and uppercase)
    v_normalized_input := upper(regexp_replace(p_code, '[\s-]+', '', 'g'));

    -- Find the code
    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(regexp_replace(code, '[\s-]+', '', 'g')) = v_normalized_input
      AND status = 'Active'
      AND (expires_at > now() OR expires_at IS NULL);

    IF v_code_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired protocol key.');
    END IF;

    -- Fetch data based on code type, with fallback
    IF v_code_record.code_type = 'Admission' THEN
        -- Try Admissions first
        SELECT applicant_name, grade, parent_email, parent_phone
        INTO v_applicant_name, v_grade, v_contact_email, v_contact_phone
        FROM public.admissions
        WHERE id = v_code_record.admission_id;
        
        IF v_applicant_name IS NOT NULL THEN
            v_found_in_admission := true;
        ELSE
            -- Fallback to Enquiry (maybe not converted yet)
            SELECT applicant_name, grade, parent_email, parent_phone 
            INTO v_applicant_name, v_grade, v_contact_email, v_contact_phone
            FROM public.enquiries
            WHERE id = v_code_record.admission_id; -- Note: p_admission_id column stored the ID
        END IF;
    ELSE
        -- Strictly Enquiry
        SELECT applicant_name, grade, parent_email, parent_phone 
        INTO v_applicant_name, v_grade, v_contact_email, v_contact_phone
        FROM public.enquiries
        WHERE id = v_code_record.enquiry_id;
    END IF;

    IF v_applicant_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Protocol mismatch: Identity node not found in target vault.');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'id', v_code_record.id,
        'admission_id', COALESCE(v_code_record.admission_id, v_code_record.enquiry_id),
        'code_type', v_code_record.code_type,
        'applicant_name', v_applicant_name,
        'grade', v_grade,
        'contact_email', v_contact_email,
        'contact_phone', v_contact_phone,
        'purpose', v_code_record.purpose,
        'vault_source', CASE WHEN v_found_in_admission THEN 'ADMISSION' ELSE 'ENQUIRY' END
    );
END;
$$;
