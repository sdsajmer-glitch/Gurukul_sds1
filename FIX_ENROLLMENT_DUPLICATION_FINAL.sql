-- ==============================================================================
-- FIX: ENROLLMENT DUPLICATION & IDEMPOTENCY
-- ==============================================================================
-- 1. Refines convert_enquiry_to_admission with row locking and content-based matching.
-- 2. Ensures existing admission profiles are reused and linked instead of duplicated.
-- 3. Synchronizes the 'convert_enquiry_to_admission_v2' logic into the main function.
-- ==============================================================================

BEGIN;

-- 1. DROP Existing function to ensure clean recreation (handling overload if any)
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(uuid);

-- 2. ROBUST IDEMPOTENT CONVERSION FUNCTION
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_admission(p_enquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enquiry record;
  v_admission_id uuid;
  v_parent_id uuid;
  v_existing_admission_id uuid;
BEGIN
  -- Fetch current state with row-level lock to prevent race conditions during concurrent clicks
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry identity node not found.');
  END IF;

  -- PRIMARY IDEMPOTENCY CHECK: If already marked as converted, return the existing link
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Handshake already finalized. Redirecting to existing vault entry.',
        'admission_id', v_enquiry.admission_id,
        'already_converted', true
    );
  END IF;

  -- CHECK 2: Verify if the linked admission record actually exists (integrity check)
  IF v_enquiry.admission_id IS NOT NULL THEN
    SELECT id INTO v_existing_admission_id FROM public.admissions WHERE id = v_enquiry.admission_id;
    IF v_existing_admission_id IS NOT NULL THEN
        -- Link exists in DB but maybe state was out of sync. Fixing state and returning.
        UPDATE public.enquiries SET conversion_state = 'CONVERTED', updated_at = now() WHERE id = p_enquiry_id;
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Valid admission link discovered. Synchronizing state.',
            'admission_id', v_existing_admission_id,
            'already_converted', true
        );
    END IF;
  END IF;

  -- CHECK 3: Content-based Identity Matching (Prevents Cross-Enquiry Duplicates)
  -- If an admission already exists for this Parent + Applicant + Grade, we link to it instead of creating a new one.
  SELECT id INTO v_existing_admission_id 
  FROM public.admissions 
  WHERE LOWER(applicant_name) = LOWER(v_enquiry.applicant_name)
    AND LOWER(parent_email) = LOWER(v_enquiry.parent_email)
    AND grade = v_enquiry.grade
  ORDER BY submitted_at DESC
  LIMIT 1;

  IF v_existing_admission_id IS NOT NULL THEN
      -- Atomic state update: Link this enquiry to the PRE-EXISTING admission
      UPDATE public.enquiries 
      SET conversion_state = 'CONVERTED', 
          admission_id = v_existing_admission_id,
          status = 'ENQUIRY_CONVERTED',
          converted_at = now(),
          updated_at = now()
      WHERE id = p_enquiry_id;

      RETURN jsonb_build_object(
        'success', true, 
        'message', 'Matching admission profile found in vault. Linking identity nodes.',
        'admission_id', v_existing_admission_id,
        'linked_existing', true
      );
  END IF;

  -- Resolve parent identity for new record linkage
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL THEN
     v_parent_id := (SELECT id FROM public.profiles WHERE LOWER(email) = LOWER(v_enquiry.parent_email) LIMIT 1);
  END IF;

  -- Create New Admission Record (Including profile_photo_url persistence)
  INSERT INTO public.admissions (
    branch_id, 
    applicant_name, 
    parent_name, 
    parent_email, 
    parent_phone, 
    grade, 
    status,
    parent_id,
    profile_photo_url,
    submitted_at
  ) VALUES (
    v_enquiry.branch_id::integer, 
    v_enquiry.applicant_name, 
    v_enquiry.parent_name, 
    v_enquiry.parent_email, 
    v_enquiry.parent_phone, 
    v_enquiry.grade, 
    'Registered',
    v_parent_id,
    v_enquiry.profile_photo_url,
    COALESCE(v_enquiry.received_at, now())
  ) RETURNING id INTO v_admission_id;

  -- Finalize atomic state update for enquiry
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

-- 3. Update convert_enquiry_to_admission_v2 if it exists to point to the main one
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_admission_v2(p_enquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.convert_enquiry_to_admission(p_enquiry_id);
END;
$$;

COMMIT;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
