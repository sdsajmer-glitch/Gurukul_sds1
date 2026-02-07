-- ============================================
-- SYNC_IDENTITY_FIELDS.sql
-- ============================================
-- 1. Ensure columns exist in admissions/enquiries
-- 2. Update administrative finalization logic
-- ============================================

BEGIN;

-- [1] Schema Reinforcement
DO $$ 
BEGIN
    -- Add address to admissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admissions' AND column_name = 'address') THEN
        ALTER TABLE public.admissions ADD COLUMN address text;
    END IF;

    -- Add address to enquiries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enquiries' AND column_name = 'address') THEN
        ALTER TABLE public.enquiries ADD COLUMN address text;
    END IF;

    -- Ensure parent_phone is searchable in admissions (for sync)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admissions' AND column_name = 'parent_phone') THEN
        ALTER TABLE public.admissions ADD COLUMN parent_phone text;
    END IF;
END $$;

-- [2] Re-deploy admin_finalize_enrollment with FULL SYNC
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
    v_gender TEXT;
    v_dob DATE;
    v_photo TEXT;
    v_address TEXT;
    v_parent_phone TEXT;
    v_parent_name TEXT;
    v_virtual_email TEXT;
BEGIN
    -- [A] Handshake: Load identity node metadata + sync data
    SELECT 
        student_user_id, grade, branch_id, applicant_name,
        gender, date_of_birth, profile_photo_url, address, parent_phone, parent_name
    INTO 
        v_user_id, v_grade, v_branch_id, v_applicant_name,
        v_gender, v_dob, v_photo, v_address, v_parent_phone, v_parent_name
    FROM public.admissions WHERE id = p_admission_id;

    -- [B] Recovery: Auto-Provision Identity if missing
    IF v_user_id IS NULL THEN
        -- Check for existing profile match
        SELECT id INTO v_user_id FROM public.profiles 
        WHERE LOWER(display_name) = LOWER(v_applicant_name) AND role = 'Student' LIMIT 1;
        
        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
            v_virtual_email := 'student.' || substring(v_user_id::text from 1 for 8) || '@gurukul.node';
            
            INSERT INTO public.profiles (id, email, display_name, role, branch_id, profile_completed, profile_photo_url, phone)
            VALUES (v_user_id, v_virtual_email, v_applicant_name, 'Student', v_branch_id, true, v_photo, v_parent_phone);
        END IF;
        
        UPDATE public.admissions SET student_user_id = v_user_id WHERE id = p_admission_id;
    END IF;

    -- [C] SID Allocation: Generate unique institutional identifier
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- [D] Persistence: Seal records across all vaults
    
    -- 1. Profiles (Update roles and master photo)
    UPDATE public.profiles 
    SET role = 'Student', 
        profile_completed = true, 
        branch_id = v_branch_id,
        profile_photo_url = COALESCE(v_photo, profile_photo_url),
        phone = COALESCE(v_parent_phone, phone)
    WHERE id = v_user_id;

    -- 2. Student Registry (The master roster record with ALL fields)
    INSERT INTO public.student_profiles (
        user_id, student_id_number, grade, branch_id, enrollment_status,
        gender, date_of_birth, address, parent_guardian_details
    )
    VALUES (
        v_user_id, v_sid, v_grade, v_branch_id, 'Active',
        v_gender, v_dob, v_address, v_parent_name
    )
    ON CONFLICT (user_id) DO UPDATE SET 
        student_id_number = v_sid, 
        enrollment_status = 'Active',
        gender = COALESCE(v_gender, student_profiles.gender),
        date_of_birth = COALESCE(v_dob, student_profiles.date_of_birth),
        address = COALESCE(v_address, student_profiles.address),
        grade = COALESCE(v_grade, student_profiles.grade);

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
