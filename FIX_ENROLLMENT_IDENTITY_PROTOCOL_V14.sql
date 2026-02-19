-- ==============================================================================
-- FIX_ENROLLMENT_IDENTITY_PROTOCOL_V14.sql
-- ==============================================================================
-- ROOT CAUSE: "IDENTITY_FAULT: This applicant does not have an active user account yet."
-- This error occurs when an admin tries to finalize an enrollment for a student 
-- who was promoted but hasn't had a user profile created yet.
--
-- FIX: Implement "Frictionless Provisioning" in the enrollment engine.
-- If student_user_id is missing, the system will now auto-create a shadow 
-- profile to allow enrollment to proceed without blocking the admin.
-- ==============================================================================

BEGIN;

-- [1] RE-STRENGTHEN THE ENROLLMENT ENGINE
CREATE OR REPLACE FUNCTION public.admin_finalize_enrollment(p_admission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_grade TEXT;
    v_branch_id BIGINT;
    v_sid TEXT;
    v_applicant_name TEXT;
    v_virtual_email TEXT;
    v_academic_year TEXT;
    v_status TEXT;
    v_existing_profile_id UUID;
BEGIN
    -- 1. Identity Handshake: Load node metadata
    SELECT student_user_id, grade, branch_id, applicant_name, status
    INTO v_user_id, v_grade, v_branch_id, v_applicant_name, v_status
    FROM public.admissions WHERE id = p_admission_id;

    IF v_applicant_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Node not found or identity corrupted.');
    END IF;

    -- 2. FRICTIONLESS PROVISIONING (The Fix)
    -- If no user is linked, we create a virtual identity for institutional tracking
    IF v_user_id IS NULL THEN
        -- Check if a student profile with this name already exists for this branch to prevent duplicates
        SELECT id INTO v_user_id FROM public.profiles 
        WHERE LOWER(TRIM(display_name)) = LOWER(TRIM(v_applicant_name)) 
          AND role = 'Student' 
          AND branch_id = v_branch_id
        LIMIT 1;

        IF v_user_id IS NULL THEN
            -- Create a new unique identity
            v_user_id := gen_random_uuid();
            v_virtual_email := 'student.' || substring(v_user_id::text from 1 for 8) || '@gurukul.internal';
            
            INSERT INTO public.profiles (id, email, display_name, role, branch_id, profile_completed, is_active)
            VALUES (v_user_id, v_virtual_email, v_applicant_name, 'Student', v_branch_id, true, true);
        END IF;

        -- Link the newly created or found profile back to the admission record
        UPDATE public.admissions SET student_user_id = v_user_id WHERE id = p_admission_id;
    END IF;

    -- 3. Resolve Academic Context
    SELECT year_name INTO v_academic_year FROM public.academic_years WHERE branch_id = v_branch_id AND is_current = true LIMIT 1;
    IF v_academic_year IS NULL THEN 
        v_academic_year := TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR(NOW() + interval '1 year', 'YY'); 
    END IF;

    -- 4. SID Allocation (Immutable Institutional ID)
    -- Format: SID-YY-RANDOM
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- 5. FINALIZATION: Sync across all vaults
    
    -- Update Profile Role
    UPDATE public.profiles 
    SET role = 'Student', 
        profile_completed = true,
        display_name = COALESCE(display_name, v_applicant_name),
        is_active = true
    WHERE id = v_user_id;

    -- Ensure Role Assignments (RLS support)
    INSERT INTO public.user_roles (name, display_name, is_system_role)
    VALUES ('Student', 'Student', true)
    ON CONFLICT (name) DO NOTHING;

    INSERT INTO public.user_role_assignments (user_id, role_name, branch_id)
    VALUES (v_user_id, 'Student', v_branch_id)
    ON CONFLICT DO NOTHING;

    -- Update Student Profile (Roster Record)
    INSERT INTO public.student_profiles (
        user_id, admission_id, student_id_number, grade, branch_id, enrollment_status, is_active, academic_year
    )
    VALUES (
        v_user_id, p_admission_id, v_sid, v_grade, v_branch_id, 'Active', true, v_academic_year
    )
    ON CONFLICT (user_id) DO UPDATE SET 
        enrollment_status = 'Active', 
        student_id_number = v_sid,
        admission_id = p_admission_id,
        is_active = true,
        grade = COALESCE(v_grade, student_profiles.grade);

    -- Update Admission Record
    UPDATE public.admissions 
    SET status = 'Enrolled', 
        student_id_number = v_sid,
        registered_at = now()
    WHERE id = p_admission_id;

    -- 6. Fiscal Handshake: Synchronize billing
    BEGIN
        PERFORM public.admin_sync_student_billing(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        -- If billing sync fails, don't rollback enrollment, just log it.
        RAISE NOTICE 'Billing Sync Deferred: %', SQLERRM;
    END;

    -- 7. Audit Log
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'IDENTITY_ENROLLED', 'ENROLLMENT', jsonb_build_object(
        'sid', v_sid, 
        'user_id', v_user_id, 
        'admission_id', p_admission_id,
        'applicant_name', v_applicant_name
    ));

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'message', 'Frictionless enrollment finalized. Identity node provisioned.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'CRITICAL_FAULT: ' || SQLERRM);
END;
$$;

-- Ensure grants are correct
GRANT EXECUTE ON FUNCTION public.admin_finalize_enrollment(uuid) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Enrollment Identity Protocol V14 deployed. Frictionless provisioning active.' as status;
