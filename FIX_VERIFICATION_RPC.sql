-- ==============================================================================
-- FIX VERIFICATION RPC & SCHEMA
-- ==============================================================================
-- 1. Fixes schema mismatch in `admission_share_codes` (UUID vs BigInt).
-- 2. Creates `admin_verify_share_code` RPC (Missing).
-- 3. Creates `admin_import_record_from_share_code` RPC (Missing).

BEGIN;

-- 1. FIX TABLE SCHEMA (Recreate with Correct Types)
DROP TABLE IF EXISTS public.admission_share_codes CASCADE;

CREATE TABLE public.admission_share_codes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  admission_id uuid, -- Corrected from bigint to uuid
  enquiry_id uuid,   -- Corrected from bigint to uuid
  code_type text NOT NULL, -- 'Enquiry' or 'Admission'
  status text DEFAULT 'Active',
  purpose text,
  expires_at timestamp with time zone DEFAULT (now() + '1 day'::interval),
  created_at timestamp with time zone DEFAULT now()
);


-- 2. VERIFY SHARE CODE RPC
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
    -- Normalize code
    p_code := upper(regexp_replace(p_code, '\s+', '', 'g'));

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
        'admission_id', v_entity_id -- We use 'admission_id' generic key for the ID
    );
END;
$$;


-- 3. IMPORT RECORD RPC
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
BEGIN
    -- Link the record to the branch
    IF p_code_type = 'Enquiry' THEN
        UPDATE public.enquiries
        SET branch_id = p_branch_id,
            status = 'ENQUIRY_VERIFIED', -- Update status to show it is grabbed
            verification_status = 'VERIFIED'
        WHERE id = p_admission_id;
    ELSIF p_code_type = 'Admission' THEN
        UPDATE public.admissions
        SET branch_id = CAST(p_branch_id AS integer), -- Handle legacy integer type if needed, strict cast
            status = 'Verified'
        WHERE id = p_admission_id;
    END IF;

    -- Deactivate the code (Single Use)
    UPDATE public.admission_share_codes
    SET status = 'Redeemed'
    WHERE id = p_code_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_verify_share_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_share_code(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO service_role;

COMMIT;
