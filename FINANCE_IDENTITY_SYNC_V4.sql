
-- ==============================================================================
-- FINANCE IDENTITY PROTOCOL V4 - MULTI-NODE PHOTO SYNC & QUICK ADD ENHANCEMENT
-- ==============================================================================
-- 1. Adds profile_photo_url to student_profiles for redundancy and performance.
-- 2. Upgrades admin_quick_add_student to support photo provisioning.
-- 3. Upgrades update_student_details_admin to support photo updates.
-- 4. Re-orders COALESCE in Finance RPCs to treat Profile Node as Authoritative.
-- ==============================================================================

BEGIN;

-- [1] Schema Reinforcement
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.student_profiles ADD COLUMN profile_photo_url text;
    END IF;
END $$;

-- [2] UPGRADE QUICK ADD PROTOCOL (Support Photo)
CREATE OR REPLACE FUNCTION public.admin_quick_add_student(
  p_display_name text, 
  p_email text, 
  p_grade text, 
  p_parent_details text,
  p_branch_id bigint DEFAULT NULL,
  p_profile_photo_url text DEFAULT NULL
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
    INSERT INTO public.profiles (id, email, display_name, role, branch_id, profile_completed, is_active, profile_photo_url)
    VALUES (v_user_id, p_email, p_display_name, 'Student', v_branch_id, true, true, p_profile_photo_url);

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
        is_active,
        profile_photo_url
    )
    VALUES (
        v_user_id, 
        v_sid, 
        p_grade, 
        v_branch_id, 
        'Active', 
        v_academic_year,
        p_parent_details,
        true,
        p_profile_photo_url
    );

    -- [H] Audit Logging
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'QUICK_ADD_STUDENT', 'STUDENT_DIRECTORY', jsonb_build_object(
        'sid', v_sid, 
        'user_id', v_user_id, 
        'display_name', p_display_name,
        'email', p_email,
        'has_photo', (p_profile_photo_url IS NOT NULL),
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

-- [3] UPGRADE UPDATE STUDENT DETAILS (Support Photo)
DROP FUNCTION IF EXISTS public.update_student_details_admin(uuid, text, text, date, text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.update_student_details_admin(
    p_student_id uuid,
    p_display_name text DEFAULT NULL,
    p_phone text DEFAULT NULL,
    p_dob date DEFAULT NULL,
    p_gender text DEFAULT NULL,
    p_address text DEFAULT NULL,
    p_parent_details text DEFAULT NULL,
    p_student_id_number text DEFAULT NULL,
    p_grade text DEFAULT NULL,
    p_enrollment_status text DEFAULT NULL,
    p_profile_photo_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET
        display_name = COALESCE(p_display_name, display_name),
        phone = COALESCE(p_phone, phone),
        profile_photo_url = COALESCE(p_profile_photo_url, profile_photo_url)
    WHERE id = p_student_id;

    UPDATE public.student_profiles
    SET
        date_of_birth = COALESCE(p_dob, date_of_birth),
        gender = COALESCE(p_gender, gender),
        address = COALESCE(p_address, address),
        parent_guardian_details = COALESCE(p_parent_details, parent_guardian_details),
        student_id_number = COALESCE(p_student_id_number, student_id_number),
        grade = COALESCE(p_grade, grade),
        enrollment_status = COALESCE(p_enrollment_status, enrollment_status),
        profile_photo_url = COALESCE(p_profile_photo_url, profile_photo_url)
    WHERE user_id = p_student_id;
END;
$$;

-- [4] UPGRADE FINANCE RPCs (Photo Order: Profile > Registry > Admission)
CREATE OR REPLACE FUNCTION public.get_student_financial_node(p_student_id UUID)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER,
    unallocated_funds NUMERIC,
    is_active BOOLEAN,
    academic_cycle TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        p.id as student_id,
        COALESCE(p.display_name, p.email) as display_name,
        -- MASTER PHOTO COALESCE V4: Prefer Profiles (Master) > Registry > Admission (Historical)
        COALESCE(p.profile_photo_url, sp.profile_photo_url, a.profile_photo_url) as profile_photo_url,
        COALESCE(sp.grade, 'N/A') as grade,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
        p.is_active,
        '2023-24'::TEXT as academic_cycle 
    FROM public.profiles p
    LEFT JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    LEFT JOIN public.admissions a ON p.id = a.student_user_id
    WHERE p.id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_fee_summary_all(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER,
    unallocated_funds NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as student_id,
        COALESCE(p.display_name, p.email) as display_name,
        -- MASTER PHOTO COALESCE V4: Prefer Profiles (Master) > Registry > Admission (Historical)
        COALESCE(p.profile_photo_url, sp.profile_photo_url, a.profile_photo_url) as profile_photo_url,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    LEFT JOIN (
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        WHERE student_user_id IS NOT NULL
        ORDER BY student_user_id, registered_at DESC
    ) a ON p.id = a.student_user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND p.role = 'Student'
    ORDER BY p.display_name ASC;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Finance Identity Protocol V4 applied. Photo sources synchronized with Profile priority.' as status;
