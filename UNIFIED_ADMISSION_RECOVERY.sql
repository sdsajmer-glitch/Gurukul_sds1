-- ==============================================================================
-- UNIFIED_ADMISSION_RECOVERY.sql
-- Goal: Fix visibility for Rishabh Sharma and ensure Branch Admins see all records.
-- ==============================================================================

BEGIN;

-- 1. FIX THE CONVERSION LOGIC: Inherit Branch of the Promoter if Enquiry is 'Global'
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
  v_promoter_branch_id integer;
  v_target_branch_id integer;
BEGIN
  -- [1] Identity Resolution
  BEGIN
      v_enquiry_uuid := p_enquiry_id::uuid;
  EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'message', 'Invalid Node Identity.');
  END;

  -- [2] Fetch Reference Node
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_enquiry_uuid FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry not found.');
  END IF;

  -- [3] Idempotency Check
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Identity already promoted.',
      'admission_id', v_enquiry.admission_id
    );
  END IF;

  -- [4] Smart Branch Resolution
  -- If enquiry has no branch, take the branch of the admin performing the conversion
  SELECT branch_id INTO v_promoter_branch_id FROM public.profiles WHERE id = auth.uid();
  v_target_branch_id := COALESCE(v_enquiry.branch_id::integer, v_promoter_branch_id);

  -- [5] Provision Admission
  INSERT INTO public.admissions (
    branch_id, applicant_name, parent_name, parent_email, parent_phone, 
    secondary_parent_name, secondary_parent_phone, secondary_parent_email,
    grade, status, parent_id, profile_photo_url, submitted_at,
    address, notes
  ) VALUES (
    v_target_branch_id, v_enquiry.applicant_name, v_enquiry.parent_name, 
    v_enquiry.parent_email, v_enquiry.parent_phone, 
    v_enquiry.secondary_parent_name, v_enquiry.secondary_parent_phone, v_enquiry.secondary_parent_email,
    v_enquiry.grade, 'Registered', v_enquiry.user_id, v_enquiry.profile_photo_url, 
    COALESCE(v_enquiry.received_at, now()), v_enquiry.address, v_enquiry.notes
  ) RETURNING id INTO v_admission_id;

  -- [6] Archive Enquiry Stage
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

-- 2. REINFORCE SELECTIVITY: Ensure branch admins see HO/Global records too
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
        -- If p_branch_id is passed, show records for that branch OR global records
        (p_branch_id IS NULL OR a.branch_id = p_branch_id OR a.branch_id IS NULL)
    ORDER BY a.submitted_at DESC;
END;
$$;

-- 3. UNBLOCK RLS: Absolute visibility for Admin roles
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
            -- Roles with wide visibility
            LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'super_admin')
            OR is_super_admin = true
            -- Branch Specific (Only if NOT a wide role)
            OR branch_id = admissions.branch_id
            -- Allow seeing 'Global' records
            OR admissions.branch_id IS NULL
        )
    )
);

COMMIT;
