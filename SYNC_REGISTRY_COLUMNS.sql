-- ============================================
-- SYNC_REGISTRY_COLUMNS.sql
-- ============================================
-- Schema Integrity Patch
-- 1. Adds missing 'student_id_number' to admissions table.
-- 2. Ensures 'registered_at' and 'notes' exist for audit trail.
-- 3. Synchronizes Identity Nodes with Enrollment Vault.
-- ============================================

BEGIN;

-- [1] REINFORCE ADMISSIONS REGISTRY
DO $$ 
BEGIN
    -- Add student_id_number (The SID reference)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admissions' AND column_name = 'student_id_number') THEN
        ALTER TABLE public.admissions ADD COLUMN student_id_number text;
    END IF;

    -- Add registered_at for timestamping conversion
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admissions' AND column_name = 'registered_at') THEN
        ALTER TABLE public.admissions ADD COLUMN registered_at timestamp with time zone;
    END IF;

    -- Ensure notes exists for administrative context
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admissions' AND column_name = 'notes') THEN
        ALTER TABLE public.admissions ADD COLUMN notes text;
    END IF;
END $$;

-- [2] REINFORCE ENQUIRIES REGISTRY
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enquiries' AND column_name = 'verification_status') THEN
        ALTER TABLE public.enquiries ADD COLUMN verification_status text DEFAULT 'PENDING';
    END IF;
END $$;

-- [3] DEPLOY FINALIZED ENROLLMENT PROTOCOL (V3 - Resilience Focused)
CREATE OR REPLACE FUNCTION public.admin_finalize_enrollment(p_admission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_grade TEXT;
    v_branch_id BIGINT;
    v_sid TEXT;
    v_applicant_name TEXT;
    v_virtual_email TEXT;
BEGIN
    -- [A] Handshake: Load identity node metadata
    SELECT 
        student_user_id, grade, branch_id, applicant_name
    INTO 
        v_user_id, v_grade, v_branch_id, v_applicant_name
    FROM public.admissions WHERE id = p_admission_id;

    -- [B] Recovery: Auto-Provision Identity if missing
    IF v_user_id IS NULL THEN
        -- Check for existing profile match
        SELECT id INTO v_user_id FROM public.profiles 
        WHERE LOWER(display_name) = LOWER(v_applicant_name) AND role = 'Student' LIMIT 1;
        
        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
            v_virtual_email := 'student.' || substring(v_user_id::text from 1 for 8) || '@gurukul.node';
            
            INSERT INTO public.profiles (id, email, display_name, role, branch_id, profile_completed)
            VALUES (v_user_id, v_virtual_email, v_applicant_name, 'Student', v_branch_id, true);
        END IF;
        
        UPDATE public.admissions SET student_user_id = v_user_id WHERE id = p_admission_id;
    END IF;

    -- [C] SID Allocation: Generate unique institutional identifier
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- [D] Persistence: Seal records across all vaults
    
    -- 1. Profiles (Update roles)
    UPDATE public.profiles SET role = 'Student', profile_completed = true, branch_id = v_branch_id WHERE id = v_user_id;

    -- 2. Student Registry (The master roster record)
    INSERT INTO public.student_profiles (user_id, student_id_number, grade, branch_id, enrollment_status)
    VALUES (v_user_id, v_sid, v_grade, v_branch_id, 'Active')
    ON CONFLICT (user_id) DO UPDATE SET student_id_number = v_sid, enrollment_status = 'Active';

    -- 3. Admissions Registry (Update status and store SID)
    UPDATE public.admissions 
    SET status = 'Enrolled', 
        student_id_number = v_sid,
        registered_at = now() 
    WHERE id = p_admission_id;

    -- [E] Fiscal Handshake: Synchronize billing
    BEGIN
        PERFORM public.admin_sync_student_billing(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Billing alignment deferred: %', SQLERRM;
    END;

    -- [F] Audit
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'IDENTITY_ENROLLED', 'ENROLLMENT', jsonb_build_object('sid', v_sid, 'user_id', v_user_id));

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'message', 'Institutional Handshake Successful. Student SID allocated: ' || v_sid
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Registry Sync Failure: ' || SQLERRM);
END;
$$;

COMMIT;
