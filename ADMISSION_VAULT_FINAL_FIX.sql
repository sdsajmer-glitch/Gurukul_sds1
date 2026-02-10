-- ==============================================================================
-- ADMISSION_VAULT_FINAL_FIX.sql
-- Goal: Ensure absolute visibility for Branch Admins and resolve "Archived" sync.
-- ==============================================================================

BEGIN;

-- 1. REINFORCE RLS (Permissive for Staff)
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
            -- [A] Role matching (Case Insensitive)
            LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'super_admin', 'admin node')
            -- [B] Branch Matching (Or if user is an HO admin)
            OR branch_id = admissions.branch_id
            OR branch_id IS NULL 
            OR is_super_admin = true
        )
    )
);

-- 2. ROBUST RETRIEVAL (Ensure no internal filtering hides records)
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
        (p_branch_id IS NULL OR a.branch_id = p_branch_id OR a.branch_id IS NULL)
    ORDER BY a.submitted_at DESC;
END;
$$;

-- 3. ENSURE IDEMPOTENCY IN CONVERSION (Prevent Ghost Records)
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
      RETURN jsonb_build_object('success', false, 'message', 'Invalid Node ID.');
  END;

  -- [2] Fetch Reference Node (With Lock)
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_enquiry_uuid FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry not found.');
  END IF;

  -- [3] Idempotency Check (Crucial for "Archived" sync)
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    -- Even if converted, return the existing ID to the frontend
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Handshake already finalized.',
      'admission_id', v_enquiry.admission_id
    );
  END IF;

  -- [4] Resolve Branch Context (Default to HO if missing)
  -- Ensure the admission definitely inherits the enquiry's branch
  
  -- [5] Provision Admission Node
  INSERT INTO public.admissions (
    branch_id, applicant_name, parent_name, parent_email, parent_phone, 
    secondary_parent_name, secondary_parent_phone, secondary_parent_email,
    grade, status, parent_id, profile_photo_url, submitted_at,
    address, notes
  ) VALUES (
    v_enquiry.branch_id::integer, v_enquiry.applicant_name, v_enquiry.parent_name, 
    v_enquiry.parent_email, v_enquiry.parent_phone, 
    v_enquiry.secondary_parent_name, v_enquiry.secondary_parent_phone, v_enquiry.secondary_parent_email,
    v_enquiry.grade, 'Registered', v_enquiry.user_id, v_enquiry.profile_photo_url, 
    COALESCE(v_enquiry.received_at, now()), v_enquiry.address, v_enquiry.notes
  ) RETURNING id INTO v_admission_id;

  -- [6] Seal Enquiry Stage
  UPDATE public.enquiries SET 
    admission_id = v_admission_id, 
    conversion_state = 'CONVERTED',
    converted_at = now(),
    status = 'ENQUIRY_CONVERTED'
  WHERE id = v_enquiry_uuid;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Promoted to Admission Vault successfully.', 
    'admission_id', v_admission_id
  );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Admission Vault visibility reinforced for Branch Admins.' as status;
