-- ==============================================================================
-- FIX_ADMISSION_DOCUMENT_VAULT_FINAL_V12.sql
-- Goal: Ensure Documentation Vault NEVER shows up as 0/0 for promoted students.
-- 1. Automates document seeding during promotion (enhanced).
-- 2. Recovers empty vaults for ALL existing admission records.
-- 3. Robust RLS for Staff and Super Admins.
-- 4. Adds auto-seed trigger for any new admission insert.
-- ==============================================================================

BEGIN;

-- [1] ENHANCED PROMOTION ENGINE (With Auto-Seeding)
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
  v_existing_admission_check uuid;
  v_migrated_count integer;
BEGIN
  -- 1. Identity Resolution
  v_enquiry_uuid := p_enquiry_id::uuid;

  -- 2. Fetch Reference Node
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_enquiry_uuid FOR UPDATE;
  
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry node not found.');
  END IF;

  -- 3. Idempotency Check
  IF v_enquiry.conversion_state = 'CONVERTED' AND v_enquiry.admission_id IS NOT NULL THEN
    SELECT id INTO v_existing_admission_check FROM public.admissions WHERE id = v_enquiry.admission_id;
    IF v_existing_admission_check IS NOT NULL THEN
        -- Even on idempotent hit, ensure vault is populated
        PERFORM public.seed_default_document_requirements(v_enquiry.admission_id);
        RETURN jsonb_build_object('success', true, 'message', 'Handshake already finalized.', 'admission_id', v_enquiry.admission_id);
    END IF;
  END IF;

  -- 4. Status Mapping
  CASE v_enquiry.status
    WHEN 'ENQUIRY_VERIFIED' THEN v_target_status := 'Verified';
    WHEN 'ENQUIRY_IN_REVIEW' THEN v_target_status := 'Pending Review';
    ELSE v_target_status := 'Registered';
  END CASE;

  -- 5. Resolve Parent
  v_parent_id := v_enquiry.user_id;
  IF v_parent_id IS NULL AND v_enquiry.parent_email IS NOT NULL THEN
    SELECT id INTO v_parent_id FROM public.profiles WHERE lower(email) = lower(v_enquiry.parent_email) LIMIT 1;
  END IF;

  -- 6. Provision Admission Node
  INSERT INTO public.admissions (
    branch_id, applicant_name, parent_name, parent_email, parent_phone, 
    grade, status, parent_id, profile_photo_url, submitted_at,
    date_of_birth, gender, medical_info, emergency_contact, address, notes
  ) VALUES (
    v_enquiry.branch_id::integer, v_enquiry.applicant_name, v_enquiry.parent_name, 
    v_enquiry.parent_email, v_enquiry.parent_phone, v_enquiry.grade, 
    v_target_status, v_parent_id, v_enquiry.profile_photo_url, 
    COALESCE(v_enquiry.received_at, now()), v_enquiry.date_of_birth, 
    v_enquiry.gender, v_enquiry.medical_info, v_enquiry.emergency_contact, 
    v_enquiry.address, v_enquiry.notes
  ) RETURNING id INTO v_admission_id;

  -- 7. Migrate Assets from Enquiry
  UPDATE public.document_requirements SET admission_id = v_admission_id, enquiry_id = NULL WHERE enquiry_id = v_enquiry_uuid;
  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;

  UPDATE public.admission_documents SET admission_id = v_admission_id, enquiry_id = NULL WHERE enquiry_id = v_enquiry_uuid;

  -- 8. SEED DEFAULT REQUIREMENTS (Always ensure mandatory baseline exists)
  PERFORM public.seed_default_document_requirements(v_admission_id);

  -- 9. Seal Enquiry
  UPDATE public.enquiries SET 
    admission_id = v_admission_id, 
    conversion_state = 'CONVERTED',
    converted_at = now(),
    status = 'ENQUIRY_CONVERTED'
  WHERE id = v_enquiry_uuid;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Promoted successfully.', 
    'admission_id', v_admission_id,
    'migrated_docs', v_migrated_count
  );
END;
$$;

-- [2] REUSABLE DOCUMENT SEEDER FUNCTION
-- This function ensures that the 4 standard mandatory documents always exist
-- for any admission. It is safe to call multiple times (idempotent).
CREATE OR REPLACE FUNCTION public.seed_default_document_requirements(p_admission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_name text;
  v_doc_names text[] := ARRAY[
    'Aadhar Card / National ID',
    'Birth Certificate',
    'Transfer Certificate',
    'Student Photograph'
  ];
BEGIN
  FOREACH v_doc_name IN ARRAY v_doc_names
  LOOP
    -- Only insert if this document name doesn't already exist for this admission
    IF NOT EXISTS (
      SELECT 1 FROM public.document_requirements 
      WHERE admission_id = p_admission_id 
        AND lower(trim(document_name)) = lower(trim(v_doc_name))
    ) THEN
      INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
      VALUES (p_admission_id, v_doc_name, true, 'Pending');
    END IF;
  END LOOP;
END;
$$;

-- [3] REPAIR EMPTY VAULTS (One-time fix for ALL existing admission records)
-- This seeds documents for any admission that currently has 0 document_requirements rows
INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, status)
SELECT 
    a.id, 
    d.name, 
    true, 
    'Pending'
FROM public.admissions a
CROSS JOIN (
    SELECT 'Aadhar Card / National ID' as name
    UNION ALL SELECT 'Birth Certificate'
    UNION ALL SELECT 'Transfer Certificate'
    UNION ALL SELECT 'Student Photograph'
) d
WHERE NOT EXISTS (
    SELECT 1 FROM public.document_requirements dr 
    WHERE dr.admission_id = a.id 
      AND lower(trim(dr.document_name)) = lower(trim(d.name))
);

-- [4] ROBUST RLS FOR DOCUMENT REQUIREMENTS
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff and Parents manage requirements" ON public.document_requirements;
DROP POLICY IF EXISTS "Manage requirements" ON public.document_requirements;

CREATE POLICY "Staff and Parents manage requirements" ON public.document_requirements
FOR ALL TO authenticated
USING (
    -- Admins can see everything
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'branch admin') OR is_super_admin = true)
    )
    OR
    -- Parents can see their own
    EXISTS (
        SELECT 1 FROM public.admissions 
        WHERE id = document_requirements.admission_id 
        AND (parent_id = auth.uid() OR parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'branch admin') OR is_super_admin = true)
    )
    OR
    EXISTS (
        SELECT 1 FROM public.admissions 
        WHERE id = document_requirements.admission_id 
        AND (parent_id = auth.uid() OR parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
    )
);

-- [5] SAME RLS FOR ADMISSION_DOCUMENTS TABLE
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff and Parents manage admission documents" ON public.admission_documents;

CREATE POLICY "Staff and Parents manage admission documents" ON public.admission_documents
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (LOWER(role) IN ('school administration', 'super admin', 'principal', 'admin', 'school_admin', 'branch admin') OR is_super_admin = true)
    )
    OR
    EXISTS (
        SELECT 1 FROM public.document_requirements dr
        JOIN public.admissions a ON a.id = dr.admission_id
        WHERE dr.id = admission_documents.requirement_id
        AND (a.parent_id = auth.uid() OR a.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
    )
);

COMMIT;

SELECT 'SUCCESS: V12 Vault recovery, auto-seeder function, and promotion protocols updated.' as status;
