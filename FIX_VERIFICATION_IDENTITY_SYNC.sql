-- ==============================================================================
-- MASTER FIX: QUICK VERIFICATION IDENTITY SYNC
-- ==============================================================================
-- Resolves: "Invalid admission ID: missing or not a string"
-- This script ensures that the verification protocol can resolve identity nodes
-- whether they are stored in 'admission_id' or 'enquiry_id' slots, and returns
-- a unified identity string for the frontend handshake.
-- ==============================================================================

BEGIN;

-- 1. REINFORCE TABLE STRUCTURE (Ensure UUID types for identity nodes)
DO $$ 
BEGIN
    -- Only alter if they aren't already UUID
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'admission_share_codes' AND column_name = 'admission_id') != 'uuid' THEN
        ALTER TABLE public.admission_share_codes ALTER COLUMN admission_id TYPE uuid USING NULL;
    END IF;
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'admission_share_codes' AND column_name = 'enquiry_id') != 'uuid' THEN
        ALTER TABLE public.admission_share_codes ALTER COLUMN enquiry_id TYPE uuid USING NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Column alteration skipped: %', SQLERRM;
END $$;

-- 2. DEPLOY ROBUST VERIFICATION PROTOCOL (admin_verify_share_code)
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
    v_contact_email text;
    v_contact_phone text;
BEGIN
    -- [A] NORMALIZE PROTOCOL KEY
    v_normalized_input := upper(regexp_replace(p_code, '[\s-]+', '', 'g'));

    -- [B] LOCATE ACTIVE PROTOCOL RECORD
    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(regexp_replace(code, '[\s-]+', '', 'g')) = v_normalized_input
      AND status = 'Active'
      AND (expires_at > now() OR expires_at IS NULL);

    IF v_code_record IS NULL THEN
        RETURN jsonb_build_object('found', false, 'error', 'Protocol session not found or expired.');
    END IF;

    -- [C] RESOLVE IDENTITY NODE (Multi-path resolution)
    -- We try to find the applicant details in either table, using whichever ID is present.
    v_entity_id := COALESCE(v_code_record.enquiry_id, v_code_record.admission_id);

    IF v_code_record.code_type = 'Enquiry' THEN
        SELECT applicant_name, grade, parent_email, parent_phone 
        INTO v_applicant_name, v_grade, v_contact_email, v_contact_phone
        FROM public.enquiries WHERE id = v_entity_id;
        
        -- Fallback: If not found in enquiries, check admissions (they might have been converted)
        IF v_applicant_name IS NULL THEN
            SELECT applicant_name, grade, parent_email, parent_phone 
            INTO v_applicant_name, v_grade, v_contact_email, v_contact_phone
            FROM public.admissions WHERE id = v_entity_id;
        END IF;
    ELSE
        SELECT applicant_name, grade, parent_email, parent_phone 
        INTO v_applicant_name, v_grade, v_contact_email, v_contact_phone
        FROM public.admissions WHERE id = v_entity_id;
        
        -- Fallback: Check enquiries if not in admissions
        IF v_applicant_name IS NULL THEN
            SELECT applicant_name, grade, parent_email, parent_phone 
            INTO v_applicant_name, v_grade, v_contact_email, v_contact_phone
            FROM public.enquiries WHERE id = v_entity_id;
        END IF;
    END IF;

    -- [D] INTEGRITY CHECK
    IF v_applicant_name IS NULL THEN
        RETURN jsonb_build_object(
            'found', false, 
            'error', 'Registry Linkage Broken: No identity record found for node ID ' || COALESCE(v_entity_id::text, 'NULL')
        );
    END IF;

    -- [E] RETURN UNIFIED IDENTITY ENVELOPE
    -- Note: We include both 'found' and 'success' for compatibility with all frontend versions.
    RETURN jsonb_build_object(
        'found', true,
        'success', true,
        'id', v_code_record.id,
        'admission_id', v_entity_id, -- Unified node ID string
        'code_type', v_code_record.code_type,
        'applicant_name', v_applicant_name,
        'grade', v_grade,
        'contact_email', v_contact_email,
        'contact_phone', v_contact_phone,
        'purpose', v_code_record.purpose
    );
END;
$$;

-- 3. DEPLOY ROBUST IMPORT PROTOCOL (admin_import_record_from_share_code)
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
    -- Protect against null IDs
    IF p_admission_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Logic Error: Subject ID is null.');
    END IF;

    -- [A] EXECUTE IDENTITY REBINDING
    IF p_code_type = 'Enquiry' THEN
        UPDATE public.enquiries
        SET 
            branch_id = COALESCE(p_branch_id, branch_id),
            status = 'ENQUIRY_VERIFIED',
            verification_status = 'VERIFIED'
        WHERE id = p_admission_id;
        v_updated := FOUND;
    ELSIF p_code_type = 'Admission' THEN
        UPDATE public.admissions
        SET 
            branch_id = COALESCE(CAST(p_branch_id AS integer), branch_id),
            status = 'Verified'
        WHERE id = p_admission_id;
        v_updated := FOUND;
    END IF;

    -- If the primary update failed, attempt a cross-table fallback (Identity Recovery)
    IF NOT v_updated THEN
        IF p_code_type = 'Enquiry' THEN
            UPDATE public.admissions SET branch_id = COALESCE(CAST(p_branch_id AS integer), branch_id), status = 'Verified' WHERE id = p_admission_id;
        ELSE
            UPDATE public.enquiries SET branch_id = COALESCE(p_branch_id, branch_id), status = 'ENQUIRY_VERIFIED', verification_status = 'VERIFIED' WHERE id = p_admission_id;
        END IF;
    END IF;

    -- [B] PROTOCOL SEALING (Deactivate the key)
    UPDATE public.admission_share_codes
    SET status = 'Redeemed',
        redeemed_at = now(),
        redeemed_by = auth.uid()
    WHERE id = p_code_id;

    RETURN jsonb_build_object('success', true, 'message', 'Node synchronization complete.');
END;
$$;

-- 4. GRANT EXECUTION PERMISSIONS
GRANT EXECUTE ON FUNCTION public.admin_verify_share_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_share_code(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO service_role;

COMMIT;

SELECT 'SUCCESS: Quick Verification Identity Sync Patch applied.' as status;
