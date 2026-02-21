-- ==============================================================================
-- MASTER_ENROLLMENT_FINANCE_ALIGNMENT_V1.sql
-- Resolution: Relation "fee_structures" does not exist
-- Protocol: V37_ULTRASONIC (finance_ prefix harmonization)
-- ==============================================================================

BEGIN;

-- [1] DECOMMISSION LEGACY LOGIC
-- Remove functions that reference non-existent legacy tables
DROP FUNCTION IF EXISTS public.generate_student_ledger_for_student(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(uuid) CASCADE;

-- [2] REBUILD ENROLLMENT HANDSHAKE (V37 Compatible)
-- Corrects the reference from legacy 'fee_structures' to 'finance_fee_structures'
-- and leverages the high-integrity V37 engine.

CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Handshake: Redirect to the standardized V37 engine
    -- generate_student_ledger handles branch detection, grade mapping, and structure assignment.
    SELECT public.generate_student_ledger(p_student_id) INTO v_result;
    RETURN v_result;
END;
$$;

-- [3] REBUILD FINALIZATION ENGINE (Architecture Alignment)
-- This ensures that admin_finalize_enrollment uses the correct sync protocol.

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

    -- [B] Recovery: Auto-Provision Identity if missing
    IF v_user_id IS NULL THEN
        -- Check for existing profile match by name and role
        SELECT id INTO v_user_id FROM public.profiles 
        WHERE LOWER(display_name) = LOWER(v_applicant_name) AND role = 'Student' LIMIT 1;
        
        IF v_user_id IS NULL THEN
            -- Provision new identity node
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
    IF v_academic_year IS NULL THEN v_academic_year := TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR(NOW() + interval '1 year', 'YY'); END IF;

    -- [D] SID Allocation: Generate immutable institutional identifier
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- [E] Persistence: Seal records
    
    -- 1. Profiles
    UPDATE public.profiles 
    SET role = 'Student', 
        profile_completed = true, 
        branch_id = COALESCE(v_branch_id, branch_id),
        is_active = true 
    WHERE id = v_user_id;

    -- 2. Student Registry
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

    -- [F] Fiscal Handshake: Synchronize billing nodes (V37 Protocol)
    -- This is the fixed part that no longer looks for 'fee_structures'
    v_billing_result := public.admin_sync_student_billing(v_user_id);

    -- [G] Audit
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'IDENTITY_ENROLLED', 'ENROLLMENT', jsonb_build_object(
        'sid', v_sid, 
        'user_id', v_user_id, 
        'admission_id', p_admission_id,
        'billing_status', v_billing_result->>'success'
    ));

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'billing_sync', v_billing_result,
        'message', 'Enrollment Protocol Successful. Student Master and Billing Node active.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'CRITICAL_FAULT: ' || SQLERRM);
END;
$$;

-- [4] PERMISSIONS REINFORCEMENT
GRANT EXECUTE ON FUNCTION public.admin_finalize_enrollment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(uuid) TO authenticated;

COMMIT;
