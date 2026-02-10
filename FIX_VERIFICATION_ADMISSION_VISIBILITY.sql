-- ==============================================================================
-- FIX_VERIFICATION_ADMISSION_VISIBILITY.sql
-- Goal: Fix identity resolution for converted enquiries during share code import.
-- ==============================================================================

BEGIN;

-- 1. SMARTER IDENTITY RESOLUTION (Handshake)
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
    v_enquiry_linked_admission_id uuid;
    v_contact_email text;
    v_contact_phone text;
    v_normalized_input text;
    v_found_in_admission boolean := false;
    v_actual_id uuid;
    v_effective_type text;
BEGIN
    -- [A] Normalization
    v_normalized_input := upper(regexp_replace(p_code, '[\s\-\.]+', '', 'g'));

    -- [B] Locate Shared Token
    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(regexp_replace(code, '[\s\-\.]+', '', 'g')) = v_normalized_input
      AND status = 'Active'
      AND (expires_at > now() OR expires_at IS NULL);

    IF v_code_record.id IS NULL THEN
        RETURN jsonb_build_object('found', false, 'success', false, 'error', 'Invalid or expired protocol token.');
    END IF;

    -- [C] Resolve Absolute Identity (Check for Conversions)
    v_entity_id := COALESCE(v_code_record.admission_id, v_code_record.enquiry_id);
    v_effective_type := v_code_record.code_type;

    -- If it's an Enquiry, check if it's already an Admission
    IF v_code_record.enquiry_id IS NOT NULL THEN
        SELECT admission_id INTO v_enquiry_linked_admission_id FROM public.enquiries WHERE id = v_code_record.enquiry_id;
        IF v_enquiry_linked_admission_id IS NOT NULL THEN
            -- Upgrade to Admission context automatically
            v_entity_id := v_enquiry_linked_admission_id;
            v_effective_type := 'Admission';
        END IF;
    END IF;

    -- [D] Fetch Metadata from Resolved Registry
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

    -- [E] Return Unified Identity Envelope
    RETURN jsonb_build_object(
        'found', true,
        'success', true,
        'id', v_code_record.id,
        'admission_id', v_entity_id, 
        'code_type', v_effective_type,
        'applicant_name', v_applicant_name,
        'grade', v_grade,
        'contact_email', v_contact_email,
        'contact_phone', v_contact_phone,
        'purpose', v_code_record.purpose,
        'vault_source', CASE WHEN v_found_in_admission THEN 'ADMISSION' ELSE 'ENQUIRY' END
    );
END;
$$;

-- 2. ROBUST NODE IMPORT (Sync)
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
    v_linked_admission_id uuid;
BEGIN
    IF p_admission_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Node Identity required.');
    END IF;

    -- [A] Cross-Vault Sync
    -- Check if it's an converted enquiry
    SELECT admission_id INTO v_linked_admission_id FROM public.enquiries WHERE id = p_admission_id;

    -- [B] Apply Institutional Context
    -- Update Enquiry Registry
    UPDATE public.enquiries
    SET branch_id = COALESCE(p_branch_id, branch_id),
        status = CASE WHEN admission_id IS NOT NULL THEN 'ENQUIRY_CONVERTED' ELSE 'ENQUIRY_VERIFIED' END,
        verification_status = 'VERIFIED'
    WHERE id = p_admission_id;
    v_updated := v_updated OR FOUND;

    -- Update Admission Registry (Direct or Linked)
    UPDATE public.admissions
    SET branch_id = COALESCE(CAST(p_branch_id AS integer), branch_id),
        status = 'Verified'
    WHERE id = p_admission_id OR id = v_linked_admission_id;
    v_updated := v_updated OR FOUND;

    IF NOT v_updated THEN
        RETURN jsonb_build_object('success', false, 'message', 'Node synchronization failure: Identity not found.');
    END IF;

    -- [C] Seal Protocol Token
    UPDATE public.admission_share_codes
    SET status = 'Redeemed',
        redeemed_at = now(),
        redeemed_by = auth.uid()
    WHERE id = p_code_id;

    RETURN jsonb_build_object('success', true, 'message', 'Identity successfully bound to branch context.');
END;
$$;

COMMIT;
