-- ============================================
-- FIX_QUICK_ENROLLMENT_PROTOCOL.sql
-- ============================================
-- Implementation: Full Identity Provisioning for Quick Add
-- Locality: Student Directory -> Quick Enrollment
-- ============================================

BEGIN;

-- [1] DEPLOY WORKING QUICK ADD PROTOCOL
-- This replaces the placeholder function with a real identity provisioning flow.
CREATE OR REPLACE FUNCTION public.admin_quick_add_student(
  p_display_name text, 
  p_email text, 
  p_grade text, 
  p_parent_details text,
  p_branch_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_sid TEXT;
    v_branch_id BIGINT;
    v_academic_year TEXT;
BEGIN
    -- [A] Handshake: Resolve context from the executing admin
    SELECT branch_id INTO v_branch_id FROM public.profiles WHERE id = auth.uid();
    v_branch_id := COALESCE(p_branch_id, v_branch_id);

    -- [B] Integrity Check: Prevent duplicate email usage
    SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = LOWER(p_email) LIMIT 1;
    IF v_user_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'CONFLICT: Email already associated with another identity node.');
    END IF;

    -- [C] Identity Provisioning
    v_user_id := gen_random_uuid();
    
    -- Insert into Profiles (The root identity node)
    INSERT INTO public.profiles (id, email, display_name, role, branch_id, profile_completed, is_active)
    VALUES (v_user_id, p_email, p_display_name, 'Student', v_branch_id, true, true);

    -- [D] Role Authorization (For RLS compliance)
    INSERT INTO public.user_role_assignments (user_id, role_name, branch_id)
    VALUES (v_user_id, 'Student', v_branch_id)
    ON CONFLICT DO NOTHING;

    -- [E] Context: Resolve Current Academic Year
    SELECT year_name INTO v_academic_year FROM public.academic_years WHERE branch_id = v_branch_id AND is_current = true LIMIT 1;
    IF v_academic_year IS NULL THEN v_academic_year := TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR(NOW() + interval '1 year', 'YY'); END IF;

    -- [F] SID Allocation: Generate institutional identifier
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- [G] Student Master Registry
    INSERT INTO public.student_profiles (
        user_id, 
        student_id_number, 
        grade, 
        branch_id, 
        enrollment_status, 
        academic_year,
        parent_guardian_details,
        is_active
    )
    VALUES (
        v_user_id, 
        v_sid, 
        p_grade, 
        v_branch_id, 
        'Active', 
        v_academic_year,
        p_parent_details,
        true
    );

    -- [H] Audit Logging
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'QUICK_ADD_STUDENT', 'STUDENT_DIRECTORY', jsonb_build_object(
        'sid', v_sid, 
        'user_id', v_user_id, 
        'display_name', p_display_name,
        'email', p_email,
        'timestamp', now()
    ));

    RETURN jsonb_build_object(
        'success', true, 
        'user_id', v_user_id, 
        'student_id_number', v_sid,
        'message', 'Quick Enrollment Successful. Identity node provisioned for ' || p_display_name || '.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Registry Sync Failure: ' || SQLERRM);
END;
$$;

COMMIT;
