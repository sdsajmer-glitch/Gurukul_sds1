-- ==============================================================================
-- FIX: MISSING ENROLLMENT FINALIZATION FUNCTIONS
-- This file restores the critical RPCs required to finalize student enrollment
-- and synchronize their fiscal ledger.
-- ==============================================================================

BEGIN;

-- 1. Helper: Sync Student Billing
-- This is called by the finalization engine to initialize fee assignments
CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
    RETURN public.generate_student_ledger_for_student(p_student_id);
END;
$$;

-- 2. CORE ENGINE: generate_student_ledger_for_student
-- Assigns fee structures and generates initial invoices
CREATE OR REPLACE FUNCTION public.generate_student_ledger_for_student(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_grade TEXT;
    v_structure_id BIGINT;
    v_component RECORD;
    v_count INT := 0;
BEGIN
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Grade context not initialized.');
    END IF;

    -- Pick the default active fee structure for this grade
    SELECT id INTO v_structure_id 
    FROM public.fee_structures 
    WHERE target_grade = v_grade AND status = 'Active' AND is_default = true
    ORDER BY created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN
        -- Fallback: try active without default flag
        SELECT id INTO v_structure_id 
        FROM public.fee_structures 
        WHERE target_grade = v_grade AND status = 'Active'
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active fee structure found for Grade ' || v_grade);
    END IF;

    -- Assign structure to student
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    -- Generate Invoices for One-time/Admission components
    FOR v_component IN 
        SELECT * FROM public.fee_components WHERE structure_id = v_structure_id
    LOOP
        -- Avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
            AND description ILIKE v_component.name || '%'
            AND status != 'Cancelled'
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, total_amount, due_date, description, status, created_at
            ) VALUES (
                p_student_id, v_component.amount, NOW() + INTERVAL '15 days',
                v_component.name || ' (INITIAL_SYNC)', 'Pending', NOW()
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- Reconcile totals
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'invoices_created', v_count, 'structure_id', v_structure_id);
END;
$$;

-- 3. FINALIZATION RPC: admin_finalize_enrollment
-- This is what the button calls. It seals the identity and transitions to Student role.
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
BEGIN
    -- 1. Fetch Admission Context
    SELECT student_user_id, grade, branch_id, applicant_name
    INTO v_user_id, v_grade, v_branch_id, v_applicant_name
    FROM public.admissions WHERE id = p_admission_id;

    -- Safety Check: If no user linked, we can't finalize (need an account to assign role)
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'IDENTITY_FAULT: This applicant does not have an active user account yet.');
    END IF;

    -- 2. Generate Student ID (SID-YY-RANDOM)
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- 3. Finalize Core Identity
    UPDATE public.profiles 
    SET role = 'Student', 
        profile_completed = true,
        display_name = COALESCE(display_name, v_applicant_name)
    WHERE id = v_user_id;

    -- 4. Establish/Update Student Profile
    INSERT INTO public.student_profiles (user_id, student_id_number, grade, branch_id, enrollment_status)
    VALUES (v_user_id, v_sid, v_grade, v_branch_id, 'Active')
    ON CONFLICT (user_id) DO UPDATE SET 
        enrollment_status = 'Active', 
        student_id_number = v_sid,
        grade = COALESCE(v_grade, student_profiles.grade);

    -- 5. Update Admission Status
    UPDATE public.admissions 
    SET status = 'Enrolled', 
        student_id_number = v_sid 
    WHERE id = p_admission_id;

    -- 6. Execute Fiscal Handshake
    PERFORM public.admin_sync_student_billing(v_user_id);

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'message', 'Enrollment Protocol Finalized. Billing node active.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'CRITICAL_FAULT: ' || SQLERRM);
END;
$$;

-- Grant permissions to authenticated users (admins)
GRANT EXECUTE ON FUNCTION public.admin_finalize_enrollment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_student_ledger_for_student(uuid) TO authenticated;

COMMIT;
