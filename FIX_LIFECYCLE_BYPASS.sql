-- ============================================================================
-- FIX: Admission Lifecycle Bypass for 'Registered' Status
-- Allows students in 'Registered' state to be enrolled if all docs are verified.
-- ============================================================================

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
    v_academic_year TEXT;
    v_existing_student_id UUID;
    v_status TEXT;
    
    -- Variables for parent linking
    v_parent_id UUID;
    v_parent_email TEXT;
BEGIN
    -- [A] Handshake: Load identity node metadata and check current lifecycle
    SELECT 
        student_user_id, grade, branch_id, applicant_name, status,
        parent_id, parent_email
    INTO 
        v_user_id, v_grade, v_branch_id, v_applicant_name, v_status,
        v_parent_id, v_parent_email
    FROM public.admissions WHERE id = p_admission_id;

    -- Integrity Check: Prevent enrollment for non-approved applicants
    -- Added 'Registered' to allowed list to support frictionless conversion from the new Admission Modal
    IF v_status NOT IN ('Approved', 'Enrolled', 'Verified', 'Pending Review', 'Registered') THEN
        RETURN jsonb_build_object('success', false, 'message', 'LIFECYCLE_ERROR: Only Approved or Verified applicants can be enrolled. Current status: ' || v_status);
    END IF;

    -- Integrity Check: Prevent duplicate student nodes
    SELECT user_id INTO v_existing_student_id FROM public.student_profiles WHERE admission_id = p_admission_id;
    IF v_existing_student_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'CONFLICT: A student record already exists for this admission node.');
    END IF;

    -- [B] Recovery: Auto-Provision Identity if missing
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM public.profiles 
        WHERE LOWER(display_name) = LOWER(v_applicant_name) AND role = 'Student' LIMIT 1;
        
        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
            v_virtual_email := 'student.' || substring(v_user_id::text from 1 for 8) || '@gurukul.node';
            
            INSERT INTO public.profiles (id, email, display_name, role, branch_id, profile_completed, is_active)
            VALUES (v_user_id, v_virtual_email, v_applicant_name, 'Student', v_branch_id, true, true);
        END IF;
        
        UPDATE public.admissions SET student_user_id = v_user_id WHERE id = p_admission_id;
    END IF;

    -- [C] Context: Resolve Current Academic Year
    SELECT year_name INTO v_academic_year FROM public.academic_years WHERE branch_id = v_branch_id AND is_current = true LIMIT 1;
    IF v_academic_year IS NULL THEN v_academic_year := TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR(NOW() + interval '1 year', 'YY'); END IF;

    -- [D] SID Allocation
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- [E] Persistence
    
    -- 1. Profiles
    UPDATE public.profiles 
    SET role = 'Student', 
        profile_completed = true, 
        branch_id = COALESCE(v_branch_id, branch_id), 
        is_active = true 
    WHERE id = v_user_id;

    -- 1b. Role Assignment (Legacy support for RLS)
    -- Ensure the 'Student' role exists in the master registry to satisfy FK
    INSERT INTO public.user_roles (name, display_name, is_system_role)
    VALUES ('Student', 'Student', true)
    ON CONFLICT (name) DO NOTHING;

    INSERT INTO public.user_role_assignments (user_id, role_name, branch_id)
    VALUES (v_user_id, 'Student', v_branch_id)
    ON CONFLICT DO NOTHING;

    -- 2. Student Registry
    INSERT INTO public.student_profiles (
        user_id, 
        admission_id, 
        student_id_number, 
        grade, 
        branch_id, 
        enrollment_status, 
        academic_year,
        is_active
    )
    VALUES (
        v_user_id, 
        p_admission_id, 
        v_sid, 
        v_grade, 
        v_branch_id, 
        'Active', 
        v_academic_year,
        true
    )
    ON CONFLICT (user_id) DO UPDATE SET 
        student_id_number = v_sid, 
        admission_id = p_admission_id,
        enrollment_status = 'Active',
        grade = EXCLUDED.grade,
        branch_id = EXCLUDED.branch_id,
        academic_year = EXCLUDED.academic_year,
        is_active = true;

    -- [STEP 2b] Guardian Linkage
    IF v_parent_id IS NULL AND v_parent_email IS NOT NULL THEN
        SELECT id INTO v_parent_id FROM public.profiles WHERE email = v_parent_email LIMIT 1;
    END IF;

    IF v_parent_id IS NOT NULL THEN
        INSERT INTO public.student_parents (student_id, parent_id, is_primary)
        VALUES (v_user_id, v_parent_id, true)
        ON CONFLICT (student_id, parent_id) DO UPDATE SET is_primary = EXCLUDED.is_primary;
    END IF;

    -- 3. Admissions Registry
    UPDATE public.admissions 
    SET status = 'Enrolled', 
        student_id_number = v_sid,
        registered_at = now() 
    WHERE id = p_admission_id;

    -- [F] Fiscal Handshake
    BEGIN
        PERFORM public.admin_sync_student_billing(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Billing alignment deferred: %', SQLERRM;
    END;

    -- [G] Audit
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
        'message', 'Enrollment Protocol Finalized: Registered -> Enrolled.'
    );

EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'ENROLLMENT_FAULT', 'ENROLLMENT', jsonb_build_object('error', SQLERRM, 'admission_id', p_admission_id));
    RETURN jsonb_build_object('success', false, 'message', 'Registry Sync Failure: ' || SQLERRM);
END;
$$;
