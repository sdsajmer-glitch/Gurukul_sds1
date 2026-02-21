-- ==============================================================================
-- MASTER_ENROLLMENT_FINANCE_ALIGNMENT_V2_ULTRASONIC.sql
-- Resolution 1: IDENTITY_FAULT (Applicant profile not linked)
-- Resolution 2: CRITICAL_FAULT (relation "fee_structures" does not exist)
-- Protocol: V37_ULTRASONIC Harmonization
-- ==============================================================================

BEGIN;

-- [1] DECOMMISSION LEGACY COMPONENTS
-- These components are the source of the "fee_structures" relation error.

DROP TRIGGER IF EXISTS trg_on_student_placement ON public.student_profiles CASCADE;
DROP FUNCTION IF EXISTS public.trigger_on_student_placement() CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger_for_student(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_finalize_enrollment(uuid) CASCADE;

-- [2] REBUILD FINANCE HANDSHAKE (V37 Protocol)
-- This function redirects workflow to the high-integrity V37 finance engine.

CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- generate_student_ledger is the modern V37 entry point using finance_fee_structures
    SELECT public.generate_student_ledger(p_student_id) INTO v_result;
    RETURN v_result;
END;
$$;

-- [3] REBUILD PLACEMENT TRIGGER (V37 Compatible)
-- Automatically triggers ledger generation when a student is placed.

CREATE OR REPLACE FUNCTION public.trigger_on_student_placement()
RETURNS TRIGGER AS $$
BEGIN
    -- Condition: Grade or Class change, or Initial Placement
    IF (TG_OP = 'UPDATE') AND 
       (COALESCE(NEW.grade, '') <> COALESCE(OLD.grade, '') OR 
        COALESCE(NEW.assigned_class_id, 0) <> COALESCE(OLD.assigned_class_id, 0)) THEN
        PERFORM public.admin_sync_student_billing(NEW.user_id);
    END IF;
    
    IF (TG_OP = 'INSERT') AND NEW.grade IS NOT NULL THEN
        PERFORM public.admin_sync_student_billing(NEW.user_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_student_placement
    AFTER INSERT OR UPDATE OF grade, assigned_class_id ON public.student_profiles
    FOR EACH ROW EXECUTE FUNCTION public.trigger_on_student_placement();

-- [4] REBUILD ENROLLMENT ENGINE (Frictionless Identity Recovery)
-- Resolves IDENTITY_FAULT by auto-provisioning missing student accounts.

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
    v_academic_year TEXT;
    v_status TEXT;
    v_billing_result JSONB;
    v_existing_student_id UUID;
BEGIN
    -- [A] Handshake: Load identity node metadata
    SELECT 
        student_user_id, grade, branch_id, applicant_name, status
    INTO 
        v_user_id, v_grade, v_branch_id, v_applicant_name, v_status
    FROM public.admissions WHERE id = p_admission_id;

    -- Integrity Check: Prevent duplicate student nodes
    SELECT user_id INTO v_existing_student_id FROM public.student_profiles WHERE admission_id = p_admission_id;
    IF v_existing_student_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'CONFLICT: A student record already exists for this admission node.');
    END IF;

    -- [B] Recovery: Auto-Provision Identity if missing (IDENTITY_FAULT Resolution)
    IF v_user_id IS NULL THEN
        -- Check for existing profile match by name and role
        SELECT id INTO v_user_id FROM public.profiles 
        WHERE LOWER(display_name) = LOWER(v_applicant_name) AND role = 'Student' LIMIT 1;
        
        IF v_user_id IS NULL THEN
            -- Provision new identity node with predictable mapping
            v_user_id := gen_random_uuid();
            INSERT INTO public.profiles (id, email, display_name, role, branch_id, profile_completed, is_active)
            VALUES (
                v_user_id, 
                'student.' || substring(v_user_id::text from 1 for 8) || '@gurukul.node', 
                v_applicant_name, 
                'Student', 
                v_branch_id, 
                true, 
                true
            );
        END IF;
        
        UPDATE public.admissions SET student_user_id = v_user_id WHERE id = p_admission_id;
    END IF;

    -- [C] Context: Resolve Current Academic Year
    SELECT year_name INTO v_academic_year FROM public.academic_years WHERE branch_id = v_branch_id AND is_current = true LIMIT 1;
    IF v_academic_year IS NULL THEN v_academic_year := TO_CHAR(NOW(), 'YYYY-YY'); END IF;

    -- [D] SID Allocation: Generate immutable institutional identifier
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- [E] Persistence: Seal records
    
    -- 1. Profiles (Ensure active state)
    UPDATE public.profiles 
    SET role = 'Student', 
        profile_completed = true, 
        branch_id = COALESCE(v_branch_id, branch_id),
        is_active = true 
    WHERE id = v_user_id;

    -- 2. Student Registry
    -- Note: Trigger 'trg_on_student_placement' will fire here.
    INSERT INTO public.student_profiles (
        user_id, admission_id, student_id_number, grade, branch_id, enrollment_status, academic_year, is_active
    )
    VALUES (
        v_user_id, p_admission_id, v_sid, v_grade, v_branch_id, 'Active', v_academic_year, true
    )
    ON CONFLICT (user_id) DO UPDATE SET 
        student_id_number = v_sid, 
        admission_id = p_admission_id,
        enrollment_status = 'Active';

    -- 3. Admissions Archive
    UPDATE public.admissions 
    SET status = 'Enrolled', 
        student_id_number = v_sid,
        registered_at = now() 
    WHERE id = p_admission_id;

    -- [F] Fiscal Result Capture
    -- Since the trigger handled it, we just verify readiness if needed, 
    -- but we call sync again here just to capture the JSONB result for the response.
    v_billing_result := public.admin_sync_student_billing(v_user_id);

    -- [G] Audit
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'IDENTITY_ENROLLED', 'ENROLLMENT', jsonb_build_object(
        'sid', v_sid, 
        'user_id', v_user_id, 
        'admission_id', p_admission_id,
        'billing_sync', v_billing_result
    ));

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'billing_sync', v_billing_result,
        'message', 'Enrollment Protocol Successful. Identity verified and Financial Node initialized.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'CRITICAL_FAULT: ' || SQLERRM);
END;
$$;

-- [5] PERMISSIONS REINFORCEMENT
GRANT EXECUTE ON FUNCTION public.admin_finalize_enrollment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(uuid) TO authenticated;

COMMIT;
