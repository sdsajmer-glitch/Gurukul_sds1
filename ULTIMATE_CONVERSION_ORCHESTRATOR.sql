-- ==============================================================================
-- ULTIMATE_CONVERSION_ORCHESTRATOR.sql
-- Goal: Resolve "Ambiguous Function Call" and consolidate all promotion logic.
-- ==============================================================================

BEGIN;

-- 1. AGGRESSIVE CLEANUP: Remove ALL conflicting signatures
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(uuid);
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(text);
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(character varying);

-- 2. UNIFIED DEFINITION: The Single Source of Truth for Promotion
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
  v_promoter_branch_id integer;
  v_target_branch_id integer;
  v_target_status text;
BEGIN
  -- [1] Safe Identity Resolution
  BEGIN
      v_enquiry_uuid := p_enquiry_id::uuid;
  EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'message', 'Invalid Identity Node format.');
  END;

  -- [2] Fetch Reference Node & Lock for Transaction
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_enquiry_uuid FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry node not found.');
  END IF;

  -- [3] Idempotency Check (Prevent Duplicates)
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Identity already promoted to Admission Vault.',
      'admission_id', v_enquiry.admission_id
    );
  END IF;

  -- [4] Smart Branch inheritance
  -- Resolve the branch of the administrative user performing the promotion
  SELECT branch_id INTO v_promoter_branch_id FROM public.profiles WHERE id = auth.uid();
  v_target_branch_id := COALESCE(v_enquiry.branch_id::integer, v_promoter_branch_id);

  -- [5] Lifecycle Status Mapping
  CASE v_enquiry.status
    WHEN 'ENQUIRY_VERIFIED' THEN v_target_status := 'Verified';
    WHEN 'ENQUIRY_IN_REVIEW' THEN v_target_status := 'Pending Review';
    ELSE v_target_status := 'Registered';
  END CASE;

  -- [6] Provision Admission Node (Consolidating all fields from master schemas)
  INSERT INTO public.admissions (
    branch_id, applicant_name, parent_name, parent_email, parent_phone, 
    secondary_parent_name, secondary_parent_phone, secondary_parent_email,
    grade, status, parent_id, profile_photo_url, submitted_at,
    date_of_birth, gender, medical_info, emergency_contact, address, notes
  ) VALUES (
    v_target_branch_id, v_enquiry.applicant_name, v_enquiry.parent_name, 
    v_enquiry.parent_email, v_enquiry.parent_phone, 
    v_enquiry.secondary_parent_name, v_enquiry.secondary_parent_phone, v_enquiry.secondary_parent_email,
    v_enquiry.grade, v_target_status, v_enquiry.user_id, v_enquiry.profile_photo_url, 
    COALESCE(v_enquiry.received_at, now()), v_enquiry.date_of_birth, 
    v_enquiry.gender, v_enquiry.medical_info, v_enquiry.emergency_contact, 
    v_enquiry.address, v_enquiry.notes
  ) RETURNING id INTO v_admission_id;

  -- [7] Vault Asset Migration (Handing off documents to the new node)
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

-- 3. PERMISSION RE-GRANT
GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_admission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_admission(text) TO service_role;

COMMIT;

SELECT 'SUCCESS: Ambiguity resolved. Ultimate convert_enquiry_to_admission(text) signature established.' as status;
