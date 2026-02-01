-- ==============================================================================
-- FIX SHARE CODE SYSTEM (Audit, Security, Granular Errors)
-- ==============================================================================

BEGIN;

-- 1. ENHANCE TABLE SCHEMA
ALTER TABLE public.admission_share_codes 
ADD COLUMN IF NOT EXISTS redeemed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS redeemed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 2. ENHANCE VERIFICATION RPC (Granular Authentication)
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
BEGIN
    -- Normalize: Remove whitespace/dashes
    p_code := upper(regexp_replace(p_code, '[\s-]+', '', 'g'));

    -- 1. Lookup Code (All statuses)
    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(code) = p_code;

    -- 2. Check Existence
    IF v_code_record IS NULL THEN
        RETURN jsonb_build_object('found', false, 'error', 'This verification code does not exist.');
    END IF;

    -- 3. Check Lockout
    IF v_code_record.locked_until IS NOT NULL AND v_code_record.locked_until > now() THEN
        RETURN jsonb_build_object('found', false, 'error', 'Code is temporarily locked due to too many attempts.');
    END IF;

    -- 4. Check Redemption
    IF v_code_record.status = 'Redeemed' THEN
         RETURN jsonb_build_object('found', false, 'error', 'This code has already been redeemed.');
    END IF;

    -- 5. Check Expiry
    IF v_code_record.expires_at < now() THEN
         RETURN jsonb_build_object('found', false, 'error', 'This code has expired. Please request a new one.');
    END IF;

    -- 6. Fetch Entity Details
    IF v_code_record.code_type = 'Enquiry' THEN
        SELECT applicant_name, grade, id INTO v_applicant_name, v_grade, v_entity_id
        FROM public.enquiries WHERE id = v_code_record.enquiry_id;
    ELSIF v_code_record.code_type = 'Admission' THEN
        SELECT applicant_name, grade, id INTO v_applicant_name, v_grade, v_entity_id
        FROM public.admissions WHERE id = v_code_record.admission_id;
    END IF;

    IF v_applicant_name IS NULL THEN
         RETURN jsonb_build_object('found', false, 'error', 'Linked identity record not found or deleted.');
    END IF;

    -- Success
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

-- 3. ENHANCE REDEMPTION RPC (Audit Logging)
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
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();

    -- 1. Update Entity Status & Branch Link
    IF p_code_type = 'Enquiry' THEN
        UPDATE public.enquiries
        SET branch_id = p_branch_id,
            status = 'ENQUIRY_VERIFIED',
            verification_status = 'VERIFIED'
        WHERE id = p_admission_id;
    ELSIF p_code_type = 'Admission' THEN
        UPDATE public.admissions
        SET branch_id = CAST(p_branch_id AS integer),
            status = 'Verified'
        WHERE id = p_admission_id;
    END IF;

    -- 2. Mark Code as Redeemed
    UPDATE public.admission_share_codes
    SET status = 'Redeemed',
        redeemed_by = v_user_id,
        redeemed_at = now()
    WHERE id = p_code_id;

    -- 3. Audit Log
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (
        v_user_id, 
        'SHARE_CODE_REDEEMED', 
        'VERIFICATION', 
        jsonb_build_object(
            'code_id', p_code_id,
            'entity_id', p_admission_id,
            'branch_id', p_branch_id,
            'type', p_code_type
        )
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. GRANT PERMISSIONS
GRANT SELECT, INSERT, UPDATE ON public.admission_share_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admission_share_codes TO service_role;

COMMIT;
