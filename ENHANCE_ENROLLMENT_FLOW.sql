-- ============================================
-- ENHANCE_ENROLLMENT_FLOW.sql
-- ============================================
-- Resilience Patch: Self-Healing Identity Resolution
-- 1. Upgrades admin_finalize_enrollment to handle missing user nodes.
-- 2. Implements automatic identity recovery for unlinked admissions.
-- 3. Standardizes Student ID (SID) generation logic.
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
BEGIN
    -- [1] DATA RETRIEVAL & INITIAL VALIDATION
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

    -- [2] SELF-HEALING PROTOCOL
    -- If the student_user_id is missing, try to resolve it from the profiles table
    -- (Maybe they registered but the link wasn't sealed)
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id 
        FROM public.profiles 
        WHERE LOWER(display_name) = LOWER(v_applicant_name)
          AND role = 'Student'
          AND branch_id = v_branch_id::bigint
        LIMIT 1;

        -- If found, heal the link permanently
        IF v_user_id IS NOT NULL THEN
            UPDATE public.admissions SET student_user_id = v_user_id WHERE id = p_admission_id;
        END IF;
    END IF;

    -- [3] IDENTITY FAULT PROTECTION
    -- If we still don't have a user_id, we cannot finalize because the Student needs an Auth node.
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'IDENTITY_FAULT: This applicant does not have a registered Student Account. Please ensure the parent has completed the child registration in the portal.'
        );
    END IF;

    -- [4] SID GENERATION (Format: SID-YY-RAND)
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- [5] CORE PROFILE ACTIVATION
    -- Promote the profile to an active Student status
    UPDATE public.profiles 
    SET 
        role = 'Student', 
        profile_completed = true,
        branch_id = v_branch_id
    WHERE id = v_user_id;

    -- [6] ACADEMIC RECORD INITIALIZATION
    -- Create or update the student profile record
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

    -- [7] ADMISSION VAULT SEALING
    UPDATE public.admissions 
    SET 
        status = 'Enrolled', 
        student_id_number = v_sid,
        updated_at = now()
    WHERE id = p_admission_id;

    -- [8] FISCAL HANDSHAKE (Initialize Billing)
    -- We use a safe CALL to the billing sync if it exists
    BEGIN
        PERFORM public.admin_sync_student_billing(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        -- Fallback: Don't fail the whole enrollment if billing sync has a minor issue
        RAISE NOTICE 'Billing synchronization deferred: %', SQLERRM;
    END;

    -- [9] AUDIT LOGGING
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (
        auth.uid(), 
        'ENROLLMENT_FINALIZED', 
        'ADMISSIONS', 
        jsonb_build_object('admission_id', p_admission_id, 'student_id', v_user_id, 'sid', v_sid)
    );

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'message', 'Institutional node successfully activated. Enrollment context sealed.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Critical System Fault: ' || SQLERRM);
END;
$$;

COMMIT;
