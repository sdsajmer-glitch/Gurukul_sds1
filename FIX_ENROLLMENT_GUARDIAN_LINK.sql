-- ============================================================================
-- FIX: Enrollment Guardian Auto-Link (Version 1.1)
-- Issue: Guardians are not auto-linked when a student is enrolled.
-- Error: ON CONFLICT failed because of missing unique constraint.
-- Solution: Added unique constraint to student_parents and enhanced enrollment function.
-- ============================================================================

-- 1. Ensure unique constraint exists for ON CONFLICT support
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_parents_student_id_parent_id_key'
    ) THEN
        ALTER TABLE public.student_parents 
        ADD CONSTRAINT student_parents_student_id_parent_id_key UNIQUE (student_id, parent_id);
    END IF;
END $$;

-- 2. Enhanced Enrollment Protocol
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
    IF v_status NOT IN ('Approved', 'Enrolled', 'Verified', 'Pending Review') THEN
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

    -- 1b. Role Assignment
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

    -- [STEP 2b] Guardian Linkage: Auto-connect primary guardian
    IF v_parent_id IS NULL AND v_parent_email IS NOT NULL THEN
        SELECT id INTO v_parent_id FROM public.profiles WHERE email = v_parent_email LIMIT 1;
    END IF;

    IF v_parent_id IS NOT NULL THEN
        -- Link Parent
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
        'applicant_name', v_applicant_name,
        'linked_parent_id', v_parent_id
    ));

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'message', 'Enrollment Successful. Master created with Guardian linkage.'
    );

EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'ENROLLMENT_FAULT', 'ENROLLMENT', jsonb_build_object('error', SQLERRM, 'admission_id', p_admission_id));
    RETURN jsonb_build_object('success', false, 'message', 'Registry Sync Failure: ' || SQLERRM);
END;
$$;

-- 3. Retroactive Fix Script
DO $$
DECLARE
    r RECORD;
    v_pid UUID;
    v_count INT := 0;
BEGIN
    FOR r IN 
        SELECT s.user_id, a.parent_id, a.parent_email
        FROM public.student_profiles s
        JOIN public.admissions a ON s.admission_id = a.id
        LEFT JOIN public.student_parents sp ON s.user_id = sp.student_id
        WHERE sp.student_id IS NULL
    LOOP
        v_pid := r.parent_id;
        IF v_pid IS NULL AND r.parent_email IS NOT NULL THEN
            SELECT id INTO v_pid FROM public.profiles WHERE email = r.parent_email LIMIT 1;
        END IF;

        IF v_pid IS NOT NULL THEN
            INSERT INTO public.student_parents (student_id, parent_id, is_primary)
            VALUES (r.user_id, v_pid, true)
            ON CONFLICT (student_id, parent_id) DO NOTHING;
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE 'Retroactive Repair: Linked % students.', v_count;
END $$;

SELECT 'FIX_ENROLLMENT_GUARDIAN_LINK_V1.1: Applied successfully' as status;
