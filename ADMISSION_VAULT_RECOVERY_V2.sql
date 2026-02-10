-- ==============================================================================
-- ADMISSION_VAULT_RECOVERY_V2.sql
-- Goal: Ensure promoted enquiries are ALWAYS visible in the Admission Vault
-- ==============================================================================

BEGIN;

-- 1. REINFORCE SCHEMA (Ensure compatibility with master lifecycle)
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS secondary_parent_name text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS secondary_parent_phone text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS secondary_parent_email text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS profile_photo_url text;

-- 2. ROBUST RETRIEVAL (Permissive for Administrators)
CREATE OR REPLACE FUNCTION public.get_admissions_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.admissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT a.*
    FROM public.admissions a
    WHERE 
        (p_branch_id IS NULL OR a.branch_id = p_branch_id)
    ORDER BY a.submitted_at DESC;
END;
$$;

-- 3. UNBLOCK RLS (Administrative Bypass)
DROP POLICY IF EXISTS "School staff view admissions" ON public.admissions;
CREATE POLICY "School staff view admissions"
ON public.admissions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND (
            LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'super_admin')
            OR branch_id = admissions.branch_id
            OR is_super_admin = true
        )
    )
);

-- 4. FIX PROMOTION ATOMICITY
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
  -- [1] Identity Resolution
  BEGIN
      v_enquiry_uuid := p_enquiry_id::uuid;
  EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'message', 'Invalid node identity format.');
  END;

  -- [2] Fetch Reference Node (With Lock)
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_enquiry_uuid FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry node not found.');
  END IF;

  -- [3] Idempotency Check
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Handshake already finalized.',
      'admission_id', v_enquiry.admission_id
    );
  END IF;

  -- [4] Smart Status Mapping
  CASE v_enquiry.status
    WHEN 'ENQUIRY_VERIFIED' THEN v_target_status := 'Verified';
    WHEN 'ENQUIRY_IN_REVIEW' THEN v_target_status := 'Pending Review';
    ELSE v_target_status := 'Registered';
  END CASE;

  -- [5] Resolve Parent Identity
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL AND v_enquiry.parent_email IS NOT NULL THEN
    SELECT id INTO v_parent_id FROM public.profiles 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_enquiry.parent_email)) 
    LIMIT 1;
  END IF;

  -- [6] Provision Admission Node
  INSERT INTO public.admissions (
    branch_id, 
    applicant_name, 
    parent_name, 
    parent_email, 
    parent_phone, 
    secondary_parent_name,
    secondary_parent_phone,
    secondary_parent_email,
    grade, 
    status,
    parent_id,
    profile_photo_url,
    submitted_at,
    date_of_birth,
    gender,
    medical_info,
    emergency_contact,
    address,
    notes
  ) VALUES (
    v_enquiry.branch_id::integer, 
    v_enquiry.applicant_name, 
    v_enquiry.parent_name, 
    v_enquiry.parent_email, 
    v_enquiry.parent_phone, 
    v_enquiry.secondary_parent_name,
    v_enquiry.secondary_parent_phone,
    v_enquiry.secondary_parent_email,
    v_enquiry.grade, 
    v_target_status,
    v_parent_id,
    v_enquiry.profile_photo_url,
    COALESCE(v_enquiry.received_at, now()),
    v_enquiry.date_of_birth,
    v_enquiry.gender,
    v_enquiry.medical_info,
    v_enquiry.emergency_contact,
    v_enquiry.address,
    v_enquiry.notes
  ) RETURNING id INTO v_admission_id;

  -- [7] Migrate Linked Assets
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
    'message', 'Identity promoted to Admission Vault successfully.', 
    'admission_id', v_admission_id
  );
END;
$$;

-- 5. GRANTS & REFRESH
GRANT EXECUTE ON FUNCTION public.get_admissions_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_admission(text) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Admission Vault synchronization protocol restored.' as status;
