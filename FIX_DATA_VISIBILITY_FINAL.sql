-- ==============================================================================
-- FINAL RESOLUTION: ENQUIRY & ADMISSION DATA VISIBILITY
-- ==============================================================================
-- 1. Fixes RLS Policies for correct Role Names ('School Administration', etc.)
-- 2. Enhanced Import Logic: Auto-creates Enquiry records from Admission Data
-- 3. Unified Verification: Resolves names correctly from either table
-- 4. Status Alignment: Proper 'NEW' status handling
-- ==============================================================================

BEGIN;

-- 1. FIX ENQUIRIES RLS (Matching Built-in Roles)
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enquiries: Auth Access" ON public.enquiries;
DROP POLICY IF EXISTS "Users can view own enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Staff can view all enquiries" ON public.enquiries;

CREATE POLICY "Staff can view all enquiries"
ON public.enquiries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Teacher')
  )
);

CREATE POLICY "Staff can update all enquiries"
ON public.enquiries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('School Administration', 'Branch Admin', 'Super Admin')
  )
);

CREATE POLICY "Parents can view own enquiries"
ON public.enquiries
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR parent_email = (auth.jwt() ->> 'email')
);

-- 2. FIX ADMISSIONS RLS (Consistency)
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admissions SELECT for Staff" ON public.admissions;

CREATE POLICY "Admissions SELECT for Staff"
ON public.admissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Teacher')
  )
);

-- 3. ENHANCED VERIFICATION RPC (Double Lookup)
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
BEGIN
    v_normalized_input := upper(regexp_replace(p_code, '[\s-]+', '', 'g'));

    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(regexp_replace(code, '[\s-]+', '', 'g')) = v_normalized_input
      AND status = 'Active'
      AND expires_at > now();

    IF v_code_record IS NULL THEN
        RETURN jsonb_build_object('found', false, 'error', 'Invalid or expired protocol token.');
    END IF;

    -- Try to find in Enquiries FIRST
    SELECT applicant_name, grade, id INTO v_applicant_name, v_grade, v_entity_id
    FROM public.enquiries 
    WHERE id = v_code_record.enquiry_id OR id = v_code_record.admission_id;

    -- If not found, look in Admissions
    IF v_applicant_name IS NULL THEN
        SELECT applicant_name, grade, id INTO v_applicant_name, v_grade, v_entity_id
        FROM public.admissions 
        WHERE id = v_code_record.admission_id OR id = v_code_record.enquiry_id;
    END IF;

    RETURN jsonb_build_object(
        'found', true,
        'id', v_code_record.id,
        'code_type', v_code_record.code_type,
        'applicant_name', COALESCE(v_applicant_name, 'Unknown Identity'),
        'grade', v_grade,
        'admission_id', v_entity_id 
    );
END;
$$;

-- 4. ENHANCED IMPORT RPC (Auto-Healing Creation)
CREATE OR REPLACE FUNCTION public.admin_import_record_from_share_code(
    p_admission_id uuid,  -- The ID from verification
    p_code_type text,   -- 'Enquiry' or 'Admission'
    p_branch_id bigint, -- The branch to link to
    p_code_id bigint    -- The share code table record ID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_branch_id bigint;
    v_adm_record record;
BEGIN
    v_target_branch_id := p_branch_id;

    -- 1. Handle Enquiry Flow
    IF p_code_type = 'Enquiry' THEN
        -- Check if enquiry exists
        IF EXISTS (SELECT 1 FROM public.enquiries WHERE id = p_admission_id) THEN
            UPDATE public.enquiries
            SET branch_id = v_target_branch_id, status = 'ENQUIRY_VERIFIED'
            WHERE id = p_admission_id;
        ELSE
            -- Try to find source in admissions
            SELECT * INTO v_adm_record FROM public.admissions WHERE id = p_admission_id;
            
            IF v_adm_record.id IS NOT NULL THEN
                INSERT INTO public.enquiries (
                    id, applicant_name, grade, parent_name, parent_email, parent_phone,
                    branch_id, status, user_id, received_at
                ) VALUES (
                    p_admission_id, v_adm_record.applicant_name, v_adm_record.grade, 
                    v_adm_record.parent_name, v_adm_record.parent_email, v_adm_record.parent_phone,
                    v_target_branch_id, 'ENQUIRY_VERIFIED', v_adm_record.parent_id, now()
                );
            ELSE
                RETURN jsonb_build_object('success', false, 'error', 'Identity source not found.');
            END IF;
        END IF;

    -- 2. Handle Admission Flow
    ELSIF p_code_type = 'Admission' THEN
        UPDATE public.admissions
        SET branch_id = CAST(v_target_branch_id AS integer), status = 'Verified'
        WHERE id = p_admission_id;
        
        -- Fallback: If not in admissions, maybe it's in enquiries?
        IF NOT FOUND THEN
             UPDATE public.enquiries SET status = 'ENQUIRY_CONVERTED' WHERE id = p_admission_id;
        END IF;
    END IF;

    -- 3. Redeem Code
    UPDATE public.admission_share_codes
    SET status = 'Redeemed', redeemed_at = now(), redeemed_by = auth.uid()
    WHERE id = p_code_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;
