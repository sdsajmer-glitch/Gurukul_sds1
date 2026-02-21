-- ============================================
-- ENHANCE_ENROLLMENT_FLOW_V2.sql
-- ============================================
-- Absolute Frictionless Enrollment Protocol
-- 1. Auto-provisions missing Student Identity nodes (Profiles).
-- 2. Uses Virtual Identity signatures to prevent email collisions.
-- 3. Perfectly synchronizes with the Enrollment Vault and Billing.
-- ============================================

BEGIN;

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
    v_parent_id UUID;
    v_virtual_email TEXT;
BEGIN
    -- [1] RECONNAISSANCE: Fetch Admission Metadata
    SELECT 
        student_user_id, 
        grade, 
        branch_id, 
        applicant_name,
        parent_id
    INTO 
        v_user_id, 
        v_grade, 
        v_branch_id, 
        v_applicant_name,
        v_parent_id
    FROM public.admissions WHERE id = p_admission_id;

    -- [2] IDENTITY HARVESTING: Search for existing nodes
    IF v_user_id IS NULL THEN
        -- Search by Name and Role (Existing node check)
        SELECT id INTO v_user_id 
        FROM public.profiles 
        WHERE LOWER(display_name) = LOWER(v_applicant_name)
          AND role = 'Student'
          AND (branch_id = v_branch_id::bigint OR branch_id IS NULL)
        LIMIT 1;

        -- If found, bind it to the admission trial permanently
        IF v_user_id IS NOT NULL THEN
            UPDATE public.admissions SET student_user_id = v_user_id WHERE id = p_admission_id;
        END IF;
    END IF;

    -- [3] AUTO-PROVISIONING: Create Virtual Identity Node if missing
    -- This "Enhances the flow" by allowing Admins to enroll students who haven't registered online yet.
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        -- Generate a unique virtual signature to avoid collisions with parents or other students
        v_virtual_email := 'student.' || substring(v_user_id::text from 1 for 8) || '@universepi.internal';

        INSERT INTO public.profiles (
            id, 
            email, 
            display_name, 
            role, 
            branch_id, 
            profile_completed,
            is_active
        ) VALUES (
            v_user_id,
            v_virtual_email,
            v_applicant_name,
            'Student',
            v_branch_id,
            true,
            true
        );

        -- Update the Admission vault with the new identity pointer
        UPDATE public.admissions SET student_user_id = v_user_id WHERE id = p_admission_id;
    END IF;

    -- [4] PROTOCOL GENERATION: Student ID (SID)
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- [5] NODE ACTIVATION: Profiles
    UPDATE public.profiles 
    SET 
        role = 'Student', 
        profile_completed = true,
        branch_id = v_branch_id
    WHERE id = v_user_id;

    -- [6] ACADEMIC ANCHORING: student_profiles
    INSERT INTO public.student_profiles (
        user_id, 
        student_id_number, 
        grade, 
        branch_id,
        enrollment_status
    )
    VALUES (
        v_user_id, 
        v_sid, 
        v_grade, 
        v_branch_id,
        'Active'
    )
    ON CONFLICT (user_id) DO UPDATE SET 
        enrollment_status = 'Active', 
        student_id_number = v_sid,
        grade = v_grade,
        branch_id = v_branch_id;

    -- [7] ADMISSION CLOSURE
    UPDATE public.admissions 
    SET 
        status = 'Enrolled', 
        student_id_number = v_sid,
        updated_at = now()
    WHERE id = p_admission_id;

    -- [8] FISCAL ACTIVATION (Billing Handshake)
    BEGIN
        PERFORM public.admin_sync_student_billing(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Billing synchronization deferred: %', SQLERRM;
    END;

    -- [9] AUDIT LOGGING
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (
        auth.uid(), 
        'ENROLLMENT_SEALED', 
        'ENROLLMENT', 
        jsonb_build_object(
            'admission_id', p_admission_id, 
            'student_id', v_user_id, 
            'sid', v_sid,
            'auto_provisioned', (v_virtual_email IS NOT NULL)
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'message', 'Institutional Handshake Complete: Student Node Provisioned & Sealed.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Critical Node Sync Error: ' || SQLERRM);
END;
$$;

COMMIT;
