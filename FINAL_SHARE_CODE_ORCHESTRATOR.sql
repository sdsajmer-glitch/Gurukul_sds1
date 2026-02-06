-- ============================================
-- FINAL_SHARE_CODE_ORCHESTRATOR.sql
-- ============================================
-- Unified Identity & Verification Protocol v3.0
-- 1. Fixed "found" vs "success" payload mismatch.
-- 2. Enabled multi-vault identity resolution (Enquiry <-> Admission).
-- 3. Consolidated all verification RPCs into a single transaction.
-- 4. Authorized for Quick Verification Tab.
-- ============================================

BEGIN;

-- [1] REINFORCE REGISTRY STRUCTURE
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

-- [2] AUTHENTICATION GENERATOR (Idempotent)
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
    
    -- Prevention logic: Return existing active key if valid
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
            'found', true,
            'message', 'Retrieved existing active protocol key.',
            'code', v_existing_code.code,
            'id', v_existing_code.id,
            'expires_at', v_existing_code.expires_at
        );
    END IF;
    
    -- Format: XXXX-XXXX-XXXX (Higher entropy)
    v_code := upper(
        substring(md5(random()::text || clock_timestamp()::text) from 1 for 4) || '-' || 
        substring(md5(random()::text || clock_timestamp()::text) from 5 for 4) || '-' || 
        substring(md5(random()::text || clock_timestamp()::text) from 9 for 4)
    );
    
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
        'found', true,
        'code', v_code,
        'id', v_id,
        'expires_at', v_expires_at
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'found', false, 'error', SQLERRM);
END;
$$;

-- [3] RESILIENT IDENTITY VERIFIER (Handshake)
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
    v_contact_email text;
    v_contact_phone text;
    v_normalized_input text;
    v_found_in_admission boolean := false;
BEGIN
    -- Normalize input (remove dashes/spaces/dots)
    v_normalized_input := upper(regexp_replace(p_code, '[\s\-\.]+', '', 'g'));

    -- Find the active token
    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(regexp_replace(code, '[\s\-\.]+', '', 'g')) = v_normalized_input
      AND status = 'Active'
      AND (expires_at > now() OR expires_at IS NULL);

    IF v_code_record.id IS NULL THEN
        RETURN jsonb_build_object('found', false, 'success', false, 'error', 'Invalid or expired protocol token.');
    END IF;

    -- Identity resolution logic: Traverse both Admission and Enquiry vaults
    v_entity_id := COALESCE(v_code_record.admission_id, v_code_record.enquiry_id);

    -- Path A: Admission Registry
    SELECT applicant_name, grade, parent_email, parent_phone
    INTO v_applicant_name, v_grade, v_contact_email, v_contact_phone
    FROM public.admissions WHERE id = v_entity_id;

    IF v_applicant_name IS NOT NULL THEN
        v_found_in_admission := true;
    ELSE
        -- Path B: Enquiry Registry (Fallback)
        SELECT applicant_name, grade, parent_email, parent_phone 
        INTO v_applicant_name, v_grade, v_contact_email, v_contact_phone
        FROM public.enquiries WHERE id = v_entity_id;
    END IF;

    IF v_applicant_name IS NULL THEN
        RETURN jsonb_build_object('found', false, 'success', false, 'error', 'Identity Resolution Refused: Node not found in registry.');
    END IF;

    -- Return Unified Identity Envelope
    RETURN jsonb_build_object(
        'found', true,
        'success', true,
        'id', v_code_record.id,
        'admission_id', v_entity_id, -- Maps to p_admission_id in import rpc
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

-- [4] NODE SYNCHRONIZATION PROTOCOL (Import)
CREATE OR REPLACE FUNCTION public.admin_import_record_from_share_code(
    p_admission_id uuid,
    p_code_type text,
    p_branch_id bigint,
    p_code_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated boolean := false;
BEGIN
    IF p_admission_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Critical Violation: Subject node ID required.');
    END IF;

    -- Traverse both tables to find and update the branch/status (Sync)
    -- This handles the case where the code_type might not match the current location of the record
    
    -- Try Enquiries
    UPDATE public.enquiries
    SET branch_id = COALESCE(p_branch_id, branch_id),
        status = 'ENQUIRY_VERIFIED',
        verification_status = 'VERIFIED'
    WHERE id = p_admission_id;
    v_updated := v_updated OR FOUND;

    -- Try Admissions
    UPDATE public.admissions
    SET branch_id = COALESCE(CAST(p_branch_id AS integer), branch_id),
        status = 'Verified'
    WHERE id = p_admission_id;
    v_updated := v_updated OR FOUND;

    IF NOT v_updated THEN
        RETURN jsonb_build_object('success', false, 'message', 'Node synchronization failed: Identity not found in active registries.');
    END IF;

    -- SEALING: Deactivate the verification token
    UPDATE public.admission_share_codes
    SET status = 'Redeemed',
        redeemed_at = now(),
        redeemed_by = auth.uid()
    WHERE id = p_code_id;

    RETURN jsonb_build_object('success', true, 'message', 'Institutional Handshake Complete.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'System Fault: ' || SQLERRM);
END;
$$;

-- [5] PROTOCOL AUTHORIZATION
GRANT ALL ON TABLE public.admission_share_codes TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_share_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO authenticated;

COMMIT;
