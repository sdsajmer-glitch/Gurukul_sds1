-- ==============================================================================
-- FIX GENERATION LOGIC (Smart Lookup + Auto-Healing Enquiry Creation)
-- ==============================================================================
-- 1. Updates generation to strictly respect requested Type (Enquiry/Admission).
-- 2. Adds "Smart Healing": If a user asks for an Enquiry Code but only an Admission exists (no linked Enquiry),
--    the system AUTOMATICALLY CREATES/RESTORES the Enquiry record to ensure success.
-- 3. Ensures 'admission_id' and 'enquiry_id' are always cross-referenced.

CREATE OR REPLACE FUNCTION public.generate_admission_share_code(
    p_admission_id uuid, -- This is the Entity ID provided by the UI (could be Enquiry or Admission ID)
    p_purpose text,
    p_code_type text     -- The requested type ('Enquiry' or 'Admission')
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code text;
    v_exists boolean;
    
    -- Resolved IDs
    v_target_enquiry_id uuid;
    v_target_admission_id uuid;
    
    -- Admission details for auto-creation
    v_adm_record record;
    
    v_id bigint;
BEGIN
    -- 1. RESOLVE BOTH IDs (Attempt to find the pair)
    
    -- Scenario A: p_admission_id is an Admission ID (Most likely from 'get_my_children_profiles')
    IF EXISTS (SELECT 1 FROM public.admissions WHERE id = p_admission_id) THEN
        v_target_admission_id := p_admission_id;
        
        -- Try to find linked Enquiry
        -- A. Direct Link
        SELECT id INTO v_target_enquiry_id FROM public.enquiries WHERE admission_id = p_admission_id LIMIT 1;
        
        -- B. Fuzzy Link (Name + Email) if direct link fails
        IF v_target_enquiry_id IS NULL THEN
            SELECT e.id INTO v_target_enquiry_id 
            FROM public.enquiries e
            JOIN public.admissions a ON a.id = p_admission_id
            WHERE lower(e.applicant_name) = lower(a.applicant_name) 
              AND (
                  lower(e.parent_email) = lower(a.parent_email) 
                  OR lower(e.parent_email) IS NULL 
                  OR lower(a.parent_email) IS NULL
              )
            LIMIT 1;
        END IF;

    -- Scenario B: p_admission_id is an Enquiry ID
    ELSIF EXISTS (SELECT 1 FROM public.enquiries WHERE id = p_admission_id) THEN
        v_target_enquiry_id := p_admission_id;
        
        -- Try to find linked Admission
        SELECT admission_id INTO v_target_admission_id FROM public.enquiries WHERE id = p_admission_id LIMIT 1;
        
        IF v_target_admission_id IS NULL THEN
            SELECT a.id INTO v_target_admission_id 
            FROM public.admissions a
            JOIN public.enquiries e ON e.id = p_admission_id
            WHERE lower(a.applicant_name) = lower(e.applicant_name) 
              AND (lower(a.parent_email) = lower(e.parent_email) OR a.parent_email IS NULL)
            LIMIT 1;
        END IF;
    
    ELSE
         RETURN jsonb_build_object('success', false, 'error', 'Invalid Entity ID: Record not found in Admissions or Enquiries.');
    END IF;

    -- 2. "MAGIC" FIX: AUTO-CREATE MISSING ENQUIRY
    -- If user requests 'Enquiry' code, but we only have Admission ID, create the missing Enquiry record.
    IF p_code_type = 'Enquiry' AND v_target_enquiry_id IS NULL AND v_target_admission_id IS NOT NULL THEN
        
        -- Fetch Admission Details
        SELECT * INTO v_adm_record FROM public.admissions WHERE id = v_target_admission_id;
        
        -- Insert Shadow Enquiry matched to this Admission
        INSERT INTO public.enquiries (
            applicant_name,
            grade,
            parent_name,
            parent_email,
            parent_phone,
            branch_id,
            admission_id, -- Link to Admission
            status,
            user_id,      -- Link to Parent User
            received_at
        ) VALUES (
            v_adm_record.applicant_name,
            v_adm_record.grade,
            v_adm_record.parent_name,
            v_adm_record.parent_email,
            v_adm_record.parent_phone,
            v_adm_record.branch_id,
            v_target_admission_id,
            'CONVERTED', -- Mark as converted since they are already admitted
            auth.uid(),
            v_adm_record.submitted_at
        )
        ON CONFLICT (admission_id) DO UPDATE 
            SET applicant_name = EXCLUDED.applicant_name -- Dummy update to return ID
        RETURNING id INTO v_target_enquiry_id;
        
    END IF;

    -- 3. VALIDATE BASED ON REQUESTED TYPE
    IF p_code_type = 'Enquiry' THEN
        IF v_target_enquiry_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'System was unable to create or locate an Enquiry record for this student.');
        END IF;
    ELSIF p_code_type = 'Admission' THEN
         IF v_target_admission_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cannot create Admission Protocol: This student has not been fully admitted yet.');
        END IF;
    ELSE
         RETURN jsonb_build_object('success', false, 'error', 'Invalid Protocol Type specified.');
    END IF;

    -- 4. GENERATE UNIQUE CODE
    LOOP
        v_code := upper(encode(gen_random_bytes(6), 'hex'));
        SELECT EXISTS(SELECT 1 FROM public.admission_share_codes WHERE code = v_code) INTO v_exists;
        IF NOT v_exists THEN EXIT; END IF;
    END LOOP;

    -- 5. INSERT RECORD (Storing BOTH IDs helps the UI resolve names)
    INSERT INTO public.admission_share_codes (
        code, 
        admission_id,
        enquiry_id,
        code_type, 
        purpose,
        status,
        created_by,
        expires_at
    )
    VALUES (
        v_code,
        v_target_admission_id, -- Always store if known
        v_target_enquiry_id,   -- Always store if known
        p_code_type, 
        p_purpose,
        'Active',
        auth.uid(),
        now() + interval '1 day'
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'success', true,
        'code', v_code,
        'id', v_id,
        'type', p_code_type
    );
END;
$$;
