-- ==============================================================================
-- FINAL_RPC_CLEANUP.sql
-- Goal: Resolve "Ambiguous Function Call" by consolidating to a SINGLE signature
-- ==============================================================================

BEGIN;

-- 1. AGGRESSIVE CLEANUP: Remove all variations of the promotion and status functions
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(uuid);
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(text);
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(character varying);
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(text, text, text);
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(text, text);

-- 2. UNIFIED DEFINITION: convert_enquiry_to_admission
-- Consolidate to text input to handle both UUID and String formats gracefully.
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_admission(p_enquiry_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enquiry_uuid uuid;
  v_enquiry record;
  v_admission_id uuid;
  v_parent_id uuid;
  v_target_status text;
BEGIN
  -- [1] Safe UUID Casting
  BEGIN
      v_enquiry_uuid := p_enquiry_id::uuid;
  EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'message', 'Invalid Identity Node format.');
  END;

  -- [2] Identity Resolution & Row Locking
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_enquiry_uuid FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry node not found in registry.');
  END IF;

  -- [3] Idempotency Check
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Identity already promoted to Admission Vault.',
      'admission_id', v_enquiry.admission_id
    );
  END IF;

  -- [4] Lifecycle Status Mapping
  CASE v_enquiry.status
    WHEN 'ENQUIRY_VERIFIED' THEN v_target_status := 'Verified';
    WHEN 'ENQUIRY_IN_REVIEW' THEN v_target_status := 'Pending Review';
    ELSE v_target_status := 'Registered';
  END CASE;

  -- [5] Parent Identity Handshake
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL AND v_enquiry.parent_email IS NOT NULL THEN
    SELECT id INTO v_parent_id FROM public.profiles 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_enquiry.parent_email)) 
    AND role = 'Parent/Guardian'
    LIMIT 1;
  END IF;

  -- [6] Provision Admission Record
  INSERT INTO public.admissions (
    branch_id, applicant_name, parent_name, parent_email, parent_phone, 
    secondary_parent_name, secondary_parent_phone, secondary_parent_email,
    grade, status, parent_id, profile_photo_url, submitted_at,
    date_of_birth, gender, medical_info, emergency_contact, address, notes
  ) VALUES (
    v_enquiry.branch_id::integer, v_enquiry.applicant_name, v_enquiry.parent_name, 
    v_enquiry.parent_email, v_enquiry.parent_phone, 
    v_enquiry.secondary_parent_name, v_enquiry.secondary_parent_phone, v_enquiry.secondary_parent_email,
    v_enquiry.grade, v_target_status, v_parent_id, v_enquiry.profile_photo_url, 
    COALESCE(v_enquiry.received_at, now()), v_enquiry.date_of_birth, 
    v_enquiry.gender, v_enquiry.medical_info, v_enquiry.emergency_contact, 
    v_enquiry.address, v_enquiry.notes
  ) RETURNING id INTO v_admission_id;

  -- [7] Vault Asset Migration
  UPDATE public.document_requirements SET admission_id = v_admission_id, enquiry_id = NULL WHERE enquiry_id = v_enquiry_uuid;
  UPDATE public.admission_documents SET admission_id = v_admission_id, enquiry_id = NULL WHERE enquiry_id = v_enquiry_uuid;

  -- [8] Seal Enquiry Stage
  UPDATE public.enquiries SET 
    admission_id = v_admission_id, 
    conversion_state = 'CONVERTED',
    converted_at = now(),
    status = 'ENQUIRY_CONVERTED'
  WHERE id = v_enquiry_uuid;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Promotion Protocol Finalized.', 
    'admission_id', v_admission_id
  );
END;
$$;

-- 3. UNIFIED DEFINITION: admin_update_enquiry_status
CREATE OR REPLACE FUNCTION public.admin_update_enquiry_status(
    p_enquiry_id text,
    p_status text,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enquiry_uuid uuid;
BEGIN
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid Node Identity.');
    END;

    -- If status is promotion-locked, trigger the converter
    IF p_status = 'ENQUIRY_CONVERTED' THEN
        RETURN public.convert_enquiry_to_admission(p_enquiry_id);
    END IF;

    UPDATE public.enquiries SET 
        status = p_status,
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = v_enquiry_uuid;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Node not found.');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. PERMISSION RE-GRANT
GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_admission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_admission(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_enquiry_status(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_enquiry_status(text, text, text) TO service_role;

COMMIT;

SELECT 'SUCCESS: Ambiguity resolved. Single convert_enquiry_to_admission(uuid) signature established.' as status;
