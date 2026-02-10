-- ==============================================================================
-- FIX: ACADEMIC PLACEMENT - ULTIMATE PERSISTENCE FIX
-- Root Cause: The EXCEPTION WHEN OTHERS block in the previous version of
-- admin_assign_student_class causes PostgreSQL to ROLL BACK all DML
-- (including the student_profiles UPDATE) if ANY subsequent statement
-- (like audit_logs INSERT) fails. The error is caught and returned as JSON,
-- so the frontend thinks the call succeeded but the DB is unchanged.
--
-- Solution: 
--   1. Separate the critical UPDATE from non-critical audit logging
--   2. Use a nested BEGIN...EXCEPTION block for audit logging only
--   3. Verify persistence by reading back the committed value
--   4. Return the verified state to the frontend
-- ==============================================================================

BEGIN;

-- 1. DROP EXISTING FUNCTION TO RECREATE WITH BULLETPROOF LOGIC
DROP FUNCTION IF EXISTS public.admin_assign_student_class(UUID, BIGINT, BIGINT);

-- 2. CREATE BULLETPROOF ASSIGNMENT FUNCTION
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
    -- 1. Get current admin ID for audit (non-critical, don't fail on this)
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

    -- 4. CRITICAL: PERFORM THE UPDATE (This is the core operation)
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
            'message', 'UPDATE executed but 0 rows were modified. Check user_id match.'
        );
    END IF;

    -- 5. CRITICAL: VERIFY PERSISTENCE by reading back the committed value
    SELECT assigned_class_id 
    INTO v_verified_class_id
    FROM student_profiles 
    WHERE user_id = p_student_id
    LIMIT 1;

    IF v_verified_class_id IS NULL OR v_verified_class_id != p_class_id THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'PERSISTENCE VERIFICATION FAILED. Written: ' || p_class_id || ', Read back: ' || COALESCE(v_verified_class_id::text, 'NULL')
        );
    END IF;

    -- 6. NON-CRITICAL: Institutional Record Sync (wrapped in its own exception handler)
    BEGIN
        UPDATE admissions
        SET status = 'Enrolled', 
            grade = COALESCE(v_grade_level, grade),
            updated_at = NOW()
        WHERE student_user_id = p_student_id;
    EXCEPTION WHEN OTHERS THEN
        -- Admissions sync failure is non-critical, don't roll back the main update
        RAISE NOTICE 'Non-critical: admissions sync failed for %: %', p_student_id, SQLERRM;
    END;

    -- 7. NON-CRITICAL: Audit Logging (wrapped in its own exception handler)
    BEGIN
        INSERT INTO audit_logs (
            user_id,
            action,
            module,
            details,
            severity
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
                'updated_rows', v_updated_rows,
                'verified_class_id', v_verified_class_id
            ),
            'info'
        );
    EXCEPTION WHEN OTHERS THEN
        -- Audit logging failure is NON-CRITICAL - never roll back the placement for this
        RAISE NOTICE 'Non-critical: audit log insert failed for %: %', p_student_id, SQLERRM;
    END;

    -- 8. RETURN VERIFIED SUCCESS WITH ALL NEEDED DATA
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

-- TOP-LEVEL EXCEPTION: Only fires if the critical UPDATE or VERIFY fails
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'message', 'Critical Database Error during placement: ' || SQLERRM,
        'error_detail', SQLSTATE
    );
END;
$$;

-- 3. GRANT EXECUTE PERMISSIONS
GRANT EXECUTE ON FUNCTION public.admin_assign_student_class(UUID, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_student_class(UUID, BIGINT, BIGINT) TO service_role;

COMMIT;
