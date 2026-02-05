-- ==============================================================================
-- ADMISSION CONVERSION PHOTO PERSISTENCE
-- ==============================================================================

BEGIN;

-- Update convert_enquiry_to_admission to persist profile_photo_url
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_admission_v2(p_enquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enquiry record;
  v_admission_id uuid;
  v_parent_id uuid;
BEGIN
  -- Fetch current state
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry not found');
  END IF;

  -- IDEMPOTENCY CHECK
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Handshake already finalized. Redirecting to existing vault entry.',
        'admission_id', v_enquiry.admission_id,
        'already_converted', true
    );
  END IF;

  -- Resolve parent identity
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL THEN
     v_parent_id := (SELECT id FROM public.profiles WHERE LOWER(email) = LOWER(v_enquiry.parent_email) LIMIT 1);
  END IF;

  -- Create Admission Record (Including profile_photo_url)
  INSERT INTO public.admissions (
    branch_id, 
    applicant_name, 
    parent_name, 
    parent_email, 
    parent_phone, 
    grade, 
    status,
    parent_id,
    profile_photo_url
  ) VALUES (
    v_enquiry.branch_id::integer, 
    v_enquiry.applicant_name, 
    v_enquiry.parent_name, 
    v_enquiry.parent_email, 
    v_enquiry.parent_phone, 
    v_enquiry.grade, 
    'Registered',
    v_parent_id,
    v_enquiry.profile_photo_url
  ) RETURNING id INTO v_admission_id;

  -- Atomic state update for enquiry
  UPDATE public.enquiries 
  SET conversion_state = 'CONVERTED', 
      admission_id = v_admission_id,
      status = 'ENQUIRY_CONVERTED',
      converted_at = now(),
      updated_at = now()
  WHERE id = p_enquiry_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Identity node promoted to Admission Vault successfully.',
    'admission_id', v_admission_id
  );
END;
$$;

-- Alias the function for backward compatibility if needed, or just update the main one
-- For now, replacing the main one is best as it's the one used by the UI.
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_admission(p_enquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.convert_enquiry_to_admission_v2(p_enquiry_id);
END;
$$;

COMMIT;
