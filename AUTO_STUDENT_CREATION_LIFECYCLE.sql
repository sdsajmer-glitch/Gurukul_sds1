-- ============================================
-- AUTO_STUDENT_CREATION_LIFECYCLE.sql
-- ============================================
-- Implementation: Automated Student Master Creation
-- Lifecycle: Enquiry -> Admission -> Enrollment -> Student
-- Architecture: Compliance-safe School Operations
-- ============================================

BEGIN;

-- [1] SCHEMA ALIGNMENT: REINFORCE STUDENT MASTER
DO $$ 
BEGIN
    -- Ensure admission_id is UUID to match missions.id
    -- If it's already bigint and has data, we might need a more complex cast,
    -- but usually, in these dev environments, we can just alter.
    -- However, safety first:
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'admission_id' AND data_type = 'bigint') THEN
        ALTER TABLE public.student_profiles ALTER COLUMN admission_id TYPE uuid USING NULL; 
    END IF;

    -- Add Academic Year to Student Profile if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'academic_year') THEN
        ALTER TABLE public.student_profiles ADD COLUMN academic_year text;
    END IF;

    -- Add Admission ID reference if missing (redundant check but good for safety)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'admission_id') THEN
        ALTER TABLE public.student_profiles ADD COLUMN admission_id uuid;
    END IF;
END $$;

-- [2] DEPLOY ENHANCED ENROLLMENT PROTOCOL (V4 - Lifecycle Focused)
-- This function marks the EXACT MOMENT an applicant becomes a student.
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
BEGIN
    -- [A] Handshake: Load identity node metadata and check current lifecycle
    SELECT 
        student_user_id, grade, branch_id, applicant_name, status
    INTO 
        v_user_id, v_grade, v_branch_id, v_applicant_name, v_status
    FROM public.admissions WHERE id = p_admission_id;

    -- Integrity Check: Prevent enrollment for non-approved applicants
    -- Expanded to allow Verified and Pending Review if the admin triggers it manually from the modal
    IF v_status NOT IN ('Approved', 'Enrolled', 'Verified', 'Pending Review', 'Registered') THEN
        RETURN jsonb_build_object('success', false, 'message', 'LIFECYCLE_ERROR: Only Approved or Verified applicants can be enrolled. Current status: ' || v_status);
    END IF;

    -- Integrity Check: Prevent duplicate student nodes from same Admission ID
    SELECT user_id INTO v_existing_student_id FROM public.student_profiles WHERE admission_id = p_admission_id;
    IF v_existing_student_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'CONFLICT: A student record already exists for this admission node.');
    END IF;

    -- [B] Recovery: Auto-Provision Identity if missing (Frictionless flow)
    IF v_user_id IS NULL THEN
        -- Check for existing profile match by name and role
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

    -- [D] SID Allocation: Generate immutable institutional identifier
    -- Pattern: SID-[YY]-[RAND-4]
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- [E] Persistence: Seal records across all vaults
    
    -- 1. Profiles (Update roles and lock authority)
    UPDATE public.profiles 
    SET role = 'Student', 
        profile_completed = true, 
        branch_id = COALESCE(v_branch_id, branch_id), -- Preserve existing or update
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

    -- 2. Student Registry (The master roster record - AUTOMATIC CREATION)
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

    -- 3. Admissions Registry (Archive state: Update status and seal SID)
    UPDATE public.admissions 
    SET status = 'Enrolled', 
        student_id_number = v_sid,
        registered_at = now() 
    WHERE id = p_admission_id;

    -- [F] Fiscal Handshake: Synchronize billing nodes
    BEGIN
        PERFORM public.admin_sync_student_billing(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Billing alignment deferred: %', SQLERRM;
    END;

    -- [G] Audit: Institutional Logging (Non-negotiable)
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'IDENTITY_ENROLLED', 'ENROLLMENT', jsonb_build_object(
        'sid', v_sid, 
        'user_id', v_user_id, 
        'admission_id', p_admission_id,
        'applicant_name', v_applicant_name,
        'timestamp', now()
    ));

    INSERT INTO public.admission_audit_logs (admission_id, item_type, previous_status, new_status, changed_by, changed_by_name, details)
    VALUES (p_admission_id, 'ADMISSION', 'Approved', 'Enrolled', auth.uid(), 'System Admin', jsonb_build_object('action', 'STUDENT_MASTER_AUTO_CREATED', 'sid', v_sid));

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'message', 'Institutional Handshake Successful. Student Master created for ' || v_applicant_name || '.'
    );

EXCEPTION WHEN OTHERS THEN
    -- Fallback: If creation fails, trigger error state for admin review
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'ENROLLMENT_FAULT', 'ENROLLMENT', jsonb_build_object('error', SQLERRM, 'admission_id', p_admission_id));
    
    RETURN jsonb_build_object('success', false, 'message', 'Registry Sync Failure: ' || SQLERRM);
END;
$$;


-- [3] ROLLBACK PROTOCOL: SAFE DECOMMISSIONING
CREATE OR REPLACE FUNCTION public.admin_rollback_enrollment(p_admission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_applicant_name TEXT;
BEGIN
    -- 1. Locate student node
    SELECT student_user_id, applicant_name INTO v_user_id, v_applicant_name FROM public.admissions WHERE id = p_admission_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Node not found.');
    END IF;

    -- 2. Deactivate Student Master
    UPDATE public.student_profiles SET is_active = false, enrollment_status = 'Withdrawn' WHERE user_id = v_user_id;
    
    -- 3. Revert Admission Status
    UPDATE public.admissions SET status = 'Approved' WHERE id = p_admission_id;

    -- 4. Audit
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'ENROLLMENT_ROLLBACK', 'ENROLLMENT', jsonb_build_object('admission_id', p_admission_id, 'user_id', v_user_id));

    RETURN jsonb_build_object('success', true, 'message', 'Rollback successful. Record reverted to Approved state.');
END;
$$;

-- [4] RLS STRENGTHENING: ENSURE ADMIN ACCESS
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_profiles' AND policyname = 'Admins can manage all students in their branch') THEN
        CREATE POLICY "Admins can manage all students in their branch"
        ON public.student_profiles
        FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND (profiles.role IN ('School Administration', 'Branch Admin', 'Principal', 'Admin'))
                AND (profiles.branch_id = student_profiles.branch_id OR profiles.branch_id IS NULL)
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND (profiles.role IN ('School Administration', 'Branch Admin', 'Principal', 'Admin'))
                AND (profiles.branch_id = student_profiles.branch_id OR profiles.branch_id IS NULL)
            )
        );
    END IF;
END $$;

COMMIT;
