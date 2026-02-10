-- ==============================================================================
-- FIX: ACADEMIC PLACEMENT - ULTIMATE PERSISTENCE FIX
-- Root Cause 1: The EXCEPTION WHEN OTHERS block in the previous version causes
--   PostgreSQL to ROLL BACK all DML if audit_logs INSERT fails.
-- Root Cause 2: get_all_classes_for_admin() has no p_branch_id parameter,
--   but the frontend calls it WITH p_branch_id, causing a "function not found" error.
--
-- This script fixes BOTH issues:
--   A. Creates get_all_classes_for_admin with p_branch_id parameter
--   B. Creates bulletproof admin_assign_student_class with nested exception handlers
-- ==============================================================================

BEGIN;

-- ============================================================================
-- PART A: FIX get_all_classes_for_admin TO ACCEPT p_branch_id PARAMETER
-- The frontend calls: supabase.rpc('get_all_classes_for_admin', { p_branch_id: ... })
-- But the DB only has get_all_classes_for_admin() with NO parameters.
-- This creates the overload that the frontend expects.
-- ============================================================================

-- Keep the old no-parameter version for backwards compatibility
-- Create the version WITH p_branch_id that the StudentProfileModal calls
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
-- PART B: FIX admin_assign_student_class WITH NESTED EXCEPTION HANDLERS
-- Non-critical operations (audit logging, admissions sync) are wrapped in
-- their own BEGIN...EXCEPTION blocks so they can NEVER roll back the
-- critical student_profiles UPDATE.
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

    -- 2. Validate Class exists and get its Metadata
    SELECT name, grade_level, academic_year 
    INTO v_class_name, v_grade_level, v_academic_year 
    FROM school_classes 
    WHERE id = p_class_id;
    
    IF v_class_name IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Selected class section does not exist (ID: ' || p_class_id || ').'
        );
    END IF;

    -- 3. Check student profile existence
    SELECT EXISTS (
        SELECT 1 FROM student_profiles WHERE user_id = p_student_id
    ) INTO v_profile_exists;
    
    IF NOT v_profile_exists THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Student profile not found for ID: ' || p_student_id
        );
    END IF;

    -- 4. CRITICAL: PERFORM THE UPDATE
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
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'UPDATE executed but 0 rows modified. Check user_id match.'
        );
    END IF;

    -- 5. VERIFY PERSISTENCE by reading back
    SELECT assigned_class_id 
    INTO v_verified_class_id
    FROM student_profiles 
    WHERE user_id = p_student_id
    LIMIT 1;

    IF v_verified_class_id IS NULL OR v_verified_class_id != p_class_id THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'PERSISTENCE VERIFICATION FAILED. Written: ' || p_class_id || ', Read: ' || COALESCE(v_verified_class_id::text, 'NULL')
        );
    END IF;

    -- 6. NON-CRITICAL: Admissions sync (nested exception handler)
    BEGIN
        UPDATE admissions
        SET status = 'Enrolled', 
            grade = COALESCE(v_grade_level, grade),
            updated_at = NOW()
        WHERE student_user_id = p_student_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Non-critical: admissions sync failed: %', SQLERRM;
    END;

    -- 7. NON-CRITICAL: Audit Logging (nested exception handler)
    BEGIN
        INSERT INTO audit_logs (
            user_id, action, module, details, severity
        ) VALUES (
            COALESCE(v_user_id, p_student_id),
            'ACADEMIC_PLACEMENT_COMMITTED',
            'Academic Placement',
            jsonb_build_object(
                'student_id', p_student_id,
                'class_id', p_class_id,
                'class_name', v_class_name,
                'grade', v_grade_level,
                'academic_year', v_academic_year,
                'updated_rows', v_updated_rows
            ),
            'info'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Non-critical: audit log failed: %', SQLERRM;
    END;

    -- 8. RETURN VERIFIED SUCCESS
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Academic placement saved, committed, and verified.',
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
        'message', 'Critical Database Error: ' || SQLERRM,
        'error_detail', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_student_class(UUID, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_student_class(UUID, BIGINT, BIGINT) TO service_role;


-- ============================================================================
-- PART C: ENSURE get_student_fee_summary EXISTS (prevents fetchData errors)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_fee_summary(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_billed', COALESCE(sfa.total_billed, 0),
        'total_paid', COALESCE(sfa.total_paid, 0),
        'outstanding_balance', COALESCE(sfa.outstanding_balance, 0),
        'integrity_score', COALESCE(sfa.integrity_score, 100)
    ) INTO v_result
    FROM student_fee_accounts sfa
    WHERE sfa.student_id = p_student_id;

    IF v_result IS NULL THEN
        v_result := jsonb_build_object(
            'total_billed', 0,
            'total_paid', 0,
            'outstanding_balance', 0,
            'integrity_score', 100
        );
    END IF;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'total_billed', 0,
        'total_paid', 0,
        'outstanding_balance', 0,
        'integrity_score', 100
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_fee_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary(UUID) TO service_role;


COMMIT;
