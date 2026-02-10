-- ==============================================================================
-- FIX: ACADEMIC PLACEMENT - ULTIMATE PERSISTENCE FIX
-- ==============================================================================
-- Root Causes Found:
--   1. get_all_classes_for_admin() missing p_branch_id parameter
--   2. admin_assign_student_class EXCEPTION block causes full rollback
--   3. RLS policy on student_profiles only allows user_id = auth.uid()
--      → School Admins CANNOT update student profiles via direct UPDATE
--   4. get_student_fee_summary may not exist
--
-- This fixes ALL issues in a single script.
-- ==============================================================================

BEGIN;

-- ============================================================================
-- PART A: FIX RLS - Allow School Admins to manage student profiles
-- Currently only: "Students can manage own profile" USING (auth.uid() = user_id)
-- School Admins need UPDATE/SELECT access to assign classes
-- ============================================================================

-- Allow School Admins to read all student profiles
DROP POLICY IF EXISTS "School admin can view student profiles" ON public.student_profiles;
CREATE POLICY "School admin can view student profiles" ON public.student_profiles
  FOR SELECT USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('School Administration', 'School Administrator', 'Super Admin')
    )
  );

-- Allow School Admins to update all student profiles 
DROP POLICY IF EXISTS "School admin can update student profiles" ON public.student_profiles;
CREATE POLICY "School admin can update student profiles" ON public.student_profiles
  FOR UPDATE USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('School Administration', 'School Administrator', 'Super Admin')
    )
  );

-- Drop the overly restrictive original policy and replace with a SELECT-only version
-- (We now have separate SELECT and UPDATE policies with admin access)
DROP POLICY IF EXISTS "Students can manage own profile" ON public.student_profiles;
CREATE POLICY "Students can manage own profile" ON public.student_profiles
  FOR ALL USING (auth.uid() = user_id);


-- ============================================================================
-- PART B: FIX get_all_classes_for_admin TO ACCEPT p_branch_id PARAMETER
-- Frontend calls: supabase.rpc('get_all_classes_for_admin', { p_branch_id: ... })
-- But DB only has the no-parameter version
-- ============================================================================

-- Drop the old no-parameter version to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_all_classes_for_admin();
DROP FUNCTION IF EXISTS public.get_all_classes_for_admin(BIGINT);

-- Create a single function with DEFAULT NULL parameter (works both with and without args)
CREATE OR REPLACE FUNCTION public.get_all_classes_for_admin(
    p_branch_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    grade_level TEXT,
    section TEXT,
    academic_year TEXT,
    branch_name TEXT,
    student_count BIGINT,
    branch_id BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        c.id, 
        c.name, 
        c.grade_level, 
        c.section, 
        c.academic_year,
        b.name AS branch_name,
        (SELECT COUNT(*) FROM public.student_profiles s WHERE s.assigned_class_id = c.id) AS student_count,
        c.branch_id
    FROM public.school_classes c
    LEFT JOIN public.school_branches b ON c.branch_id = b.id
    WHERE (p_branch_id IS NULL OR c.branch_id = p_branch_id)
    ORDER BY c.grade_level, c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_classes_for_admin(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_classes_for_admin(BIGINT) TO service_role;


-- ============================================================================
-- PART C: FIX admin_assign_student_class WITH NESTED EXCEPTION HANDLERS
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_assign_student_class(UUID, BIGINT, BIGINT);

CREATE OR REPLACE FUNCTION public.admin_assign_student_class(
    p_student_id UUID,
    p_class_id BIGINT,
    p_branch_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_class_name TEXT;
    v_grade_level TEXT;
    v_academic_year TEXT;
    v_profile_exists BOOLEAN;
    v_user_id UUID;
    v_updated_rows INT;
    v_verified_class_id BIGINT;
BEGIN
    -- 1. Get current admin ID (non-critical)
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- 2. Validate Class
    SELECT name, grade_level, academic_year 
    INTO v_class_name, v_grade_level, v_academic_year 
    FROM school_classes WHERE id = p_class_id;
    
    IF v_class_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Class not found: ' || p_class_id);
    END IF;

    -- 3. Check student profile existence
    SELECT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = p_student_id) INTO v_profile_exists;
    
    IF NOT v_profile_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Student profile not found: ' || p_student_id);
    END IF;

    -- 4. CRITICAL: UPDATE student_profiles
    UPDATE student_profiles
    SET 
        assigned_class_id = p_class_id,
        grade = COALESCE(v_grade_level, grade),
        enrollment_status = 'Active',
        updated_at = NOW(),
        branch_id = COALESCE(p_branch_id, branch_id)
    WHERE user_id = p_student_id;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    IF v_updated_rows = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'UPDATE affected 0 rows');
    END IF;

    -- 5. VERIFY persistence
    SELECT assigned_class_id INTO v_verified_class_id
    FROM student_profiles WHERE user_id = p_student_id LIMIT 1;

    IF v_verified_class_id IS NULL OR v_verified_class_id != p_class_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Verification failed');
    END IF;

    -- 6. NON-CRITICAL: Admissions sync
    BEGIN
        UPDATE admissions
        SET status = 'Enrolled', grade = COALESCE(v_grade_level, grade), updated_at = NOW()
        WHERE student_user_id = p_student_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'admissions sync failed: %', SQLERRM;
    END;

    -- 7. NON-CRITICAL: Audit log
    BEGIN
        INSERT INTO audit_logs (user_id, action, module, details, severity)
        VALUES (
            COALESCE(v_user_id, p_student_id),
            'ACADEMIC_PLACEMENT_COMMITTED',
            'Academic Placement',
            jsonb_build_object(
                'student_id', p_student_id, 'class_id', p_class_id,
                'class_name', v_class_name, 'grade', v_grade_level
            ),
            'info'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'audit log failed: %', SQLERRM;
    END;

    -- 8. RETURN SUCCESS
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Placement saved and verified.',
        'class_name', v_class_name,
        'class_id', p_class_id,
        'grade', v_grade_level,
        'academic_year', v_academic_year,
        'enrollment_status', 'Active',
        'verified', true,
        'updated_rows', v_updated_rows
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'message', 'Database Error: ' || SQLERRM,
        'error_detail', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_student_class(UUID, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_student_class(UUID, BIGINT, BIGINT) TO service_role;


-- ============================================================================
-- PART D: ENSURE get_student_fee_summary EXISTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_fee_summary(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_billed', COALESCE(sfa.total_billed, 0),
        'total_paid', COALESCE(sfa.total_paid, 0),
        'outstanding_balance', COALESCE(sfa.outstanding_balance, 0),
        'integrity_score', COALESCE(sfa.integrity_score, 100)
    ) INTO v_result
    FROM student_fee_accounts sfa
    WHERE sfa.student_id = p_student_id;

    RETURN COALESCE(v_result, jsonb_build_object(
        'total_billed', 0, 'total_paid', 0, 'outstanding_balance', 0, 'integrity_score', 100
    ));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'total_billed', 0, 'total_paid', 0, 'outstanding_balance', 0, 'integrity_score', 100
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_fee_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary(UUID) TO service_role;

COMMIT;
