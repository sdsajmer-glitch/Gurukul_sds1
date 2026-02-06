-- ==============================================================================
-- MASTER FIX: PROTOCOL ACCESS & IDENTITY PROVISIONING
-- ==============================================================================
-- Resolves: "Unauthorized access to admission record"
-- This script upgrades the 'generate_admission_share_code' function to use
-- robust multi-path authorization, ensuring parents can access records by
-- UID or verified email metadata.
-- ==============================================================================

BEGIN;

-- 1. DROP LEGACY VERSIONS (Clean slate for the master logic)
DROP FUNCTION IF EXISTS public.generate_admission_share_code(uuid, text, text);
DROP FUNCTION IF EXISTS public.generate_admission_share_code(bigint, text, text);

-- 2. DEPLOY MASTER PROVISIONING LOGIC
CREATE OR REPLACE FUNCTION public.generate_admission_share_code(
    p_admission_id uuid, -- Universal Identity Node ID
    p_purpose text,
    p_code_type text     -- 'Enquiry' or 'Admission'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code text;
    v_id bigint;
    v_exists boolean;
    v_user_id uuid := auth.uid();
    v_user_email text;
    v_is_admin boolean;
    
    -- Resolved variables
    v_target_admission_id uuid;
    v_target_enquiry_id uuid;
    v_adm_record record;
    v_enq_record record;
BEGIN
    -- [A] INITIALIZE USER CONTEXT
    v_user_email := LOWER(COALESCE(
        (SELECT email FROM public.profiles WHERE id = v_user_id),
        auth.jwt() ->> 'email'
    ));
    
    v_is_admin := EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_user_id 
        AND role IN ('School Administration', 'Branch Admin', 'Super Admin', 'admin', 'school_admin')
    );

    -- [B] RESOLVE TARGET NODE & VERIFY OWNERSHIP
    -- Check Admissions Table first
    SELECT * INTO v_adm_record FROM public.admissions WHERE id = p_admission_id;
    
    IF FOUND THEN
        v_target_admission_id := v_adm_record.id;
        
        -- PROBATIVE AUTH CHECK
        IF NOT (
            v_is_admin OR 
            v_adm_record.parent_id = v_user_id OR 
            LOWER(v_adm_record.parent_email) = v_user_email
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'Identity Violation: Unauthorized access to admission record.');
        END IF;
        
        -- SELF-HEALING: Link parent_id if missing but identity is verified via email
        IF v_adm_record.parent_id IS NULL AND LOWER(v_adm_record.parent_email) = v_user_email THEN
            UPDATE public.admissions SET parent_id = v_user_id WHERE id = v_adm_record.id;
        END IF;

    ELSE
        -- Fallback: Check Enquiries Table (if p_admission_id was actually an enquiry_id)
        SELECT * INTO v_enq_record FROM public.enquiries WHERE id = p_admission_id;
        
        IF FOUND THEN
            v_target_enquiry_id := v_enq_record.id;
            v_target_admission_id := v_enq_record.admission_id; -- Might be NULL
            
            -- PROBATIVE AUTH CHECK
            IF NOT (
                v_is_admin OR 
                v_enq_record.user_id = v_user_id OR 
                LOWER(v_enq_record.parent_email) = v_user_email
            ) THEN
                RETURN jsonb_build_object('success', false, 'message', 'Identity Violation: Unauthorized access to enquiry node.');
            END IF;

            -- SELF-HEALING: Link user_id if missing
            IF v_enq_record.user_id IS NULL AND LOWER(v_enq_record.parent_email) = v_user_email THEN
                UPDATE public.enquiries SET user_id = v_user_id WHERE id = v_enq_record.id;
            END IF;
        ELSE
            RETURN jsonb_build_object('success', false, 'message', 'Registry Fault: Node identity not found in Admissions or Enquiries.');
        END IF;
    END IF;

    -- [C] ENSURE SYMMETRY (Attempt to link the pair if missing)
    IF v_target_admission_id IS NOT NULL AND v_target_enquiry_id IS NULL THEN
        SELECT id INTO v_target_enquiry_id FROM public.enquiries WHERE admission_id = v_target_admission_id LIMIT 1;
    ELSIF v_target_enquiry_id IS NOT NULL AND v_target_admission_id IS NULL THEN
        SELECT admission_id INTO v_target_admission_id FROM public.enquiries WHERE id = v_target_enquiry_id LIMIT 1;
    END IF;

    -- [D] SMART-GHOSTING: If Enquiry requested but not found, check if we should create it
    IF p_code_type = 'Enquiry' AND v_target_enquiry_id IS NULL AND v_target_admission_id IS NOT NULL THEN
        -- Create a phantom enquiry record from admission data to satisfy the protocol
        INSERT INTO public.enquiries (
            admission_id, 
            user_id, 
            applicant_name, 
            parent_name, 
            parent_email, 
            parent_phone, 
            grade, 
            branch_id, 
            status
        ) VALUES (
            v_target_admission_id,
            v_user_id,
            v_adm_record.applicant_name,
            v_adm_record.parent_name,
            v_adm_record.parent_email,
            v_adm_record.parent_phone,
            v_adm_record.grade,
            v_adm_record.branch_id,
            'CONVERTED'
        ) RETURNING id INTO v_target_enquiry_id;
    END IF;

    -- [E] PROTOCOL VALIDATION
    IF p_code_type = 'Enquiry' AND v_target_enquiry_id IS NULL THEN
         RETURN jsonb_build_object('success', false, 'message', 'Protocol Failure: Enquiry context required but missing.');
    END IF;

    -- [F] CIPHER GENERATION (Unique 12-char Provisioning Key)
    LOOP
        v_code := upper(encode(gen_random_bytes(6), 'hex'));
        SELECT EXISTS(SELECT 1 FROM public.admission_share_codes WHERE code = v_code) INTO v_exists;
        IF NOT v_exists THEN EXIT; END IF;
    END LOOP;

    -- [G] REGISTRY INSERTION
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
        v_target_admission_id,
        v_target_enquiry_id,
        p_code_type, 
        p_purpose,
        'Active',
        v_user_id,
        now() + interval '24 hours'
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'success', true,
        'code', v_code,
        'id', v_id,
        'expires_at', now() + interval '24 hours'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Protocol Critical Failure: ' || SQLERRM);
END;
$$;

-- 3. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO service_role;

-- 4. REINFORCE RLS POLICIES (Fuzzy Identity Match)
ALTER TABLE public.admission_share_codes ENABLE ROW LEVEL SECURITY;

-- Allow SELECT with fuzzy identity check
DROP POLICY IF EXISTS "Users can view own created codes" ON public.admission_share_codes;
CREATE POLICY "Users can view own created codes" 
ON public.admission_share_codes FOR SELECT 
TO authenticated 
USING (
    created_by = auth.uid() 
    OR 
    admission_id IN (
        SELECT id FROM public.admissions 
        WHERE parent_id = auth.uid() 
        OR LOWER(parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
        OR LOWER(parent_email) = (SELECT LOWER(auth.jwt() ->> 'email'))
    )
    OR
    enquiry_id IN (
        SELECT id FROM public.enquiries 
        WHERE user_id = auth.uid()
        OR LOWER(parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
        OR LOWER(parent_email) = (SELECT LOWER(auth.jwt() ->> 'email'))
    )
);

-- Allow UPDATE (Revoke)
DROP POLICY IF EXISTS "Users can update own created codes" ON public.admission_share_codes;
CREATE POLICY "Users can update own created codes" 
ON public.admission_share_codes FOR UPDATE 
TO authenticated 
USING (
    created_by = auth.uid() 
    OR 
    admission_id IN (SELECT id FROM public.admissions WHERE parent_id = auth.uid())
);

COMMIT;

SELECT 'SUCCESS: Master Protocol Provisioning & RLS logic deployed.' as status;
