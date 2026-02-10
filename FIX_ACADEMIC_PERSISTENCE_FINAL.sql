-- ==============================================================================
-- FIX: ACADEMIC PERSISTENCE FINAL
-- Description: Robust function to assign student class, verify persistence,
--              and return authoritative state. Handles duplicates and validates constraints.
-- ==============================================================================

BEGIN;

-- 1. DROP EXISTING FUNCTION TO RECREATE WITH FULL LOGIC
DROP FUNCTION IF EXISTS public.admin_assign_student_class(UUID, BIGINT, BIGINT);

-- 2. CREATE ROBUST ASSIGNMENT FUNCTION
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
    v_new_status TEXT;
BEGIN
    -- 1. Get current admin ID for audit
    v_user_id := auth.uid();

    -- 2. Validate Class and get Metadata
    SELECT name, grade_level, academic_year INTO v_class_name, v_grade_level, v_academic_year 
    FROM school_classes WHERE id = p_class_id;
    
    IF v_class_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Selected class section does not exist.');
    END IF;

    -- 3. Check profile existence (Handles potential duplicates by just checking if ANY exist)
    SELECT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = p_student_id) INTO v_profile_exists;
    
    IF NOT v_profile_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Student profile not found.');
    END IF;

    -- 4. PERFORM PERMANENT INITIALIZATION
    -- We explicitly update ALL profiles for this user_id to ensure consistency if duplicates exist
    UPDATE student_profiles
    SET 
        assigned_class_id = p_class_id,
        grade = COALESCE(v_grade_level, grade), -- Update grade to match class if class has grade
        enrollment_status = 'Active', -- Marks initialization as complete
        updated_at = NOW(),
        branch_id = COALESCE(p_branch_id, branch_id) -- Update branch if provided
    WHERE user_id = p_student_id;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    IF v_updated_rows = 0 THEN
         RETURN jsonb_build_object('success', false, 'message', 'Failed to update student profile. No rows modified.');
    END IF;

    -- 5. Institutional Record Sync (Admissions Linkage)
    UPDATE admissions
    SET status = 'Enrolled', 
        grade = COALESCE(v_grade_level, grade),
        updated_at = NOW()
    WHERE student_user_id = p_student_id;

    -- 6. Audit Logging
    INSERT INTO audit_logs (
        user_id,
        action,
        module,
        details,
        severity
    ) VALUES (
        v_user_id,
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

    -- 7. RETURN SUCCCESS WITH DATA
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Academic placement saved and committed.',
        'class_name', v_class_name,
        'class_id', p_class_id,
        'grade', v_grade_level,
        'academic_year', v_academic_year,
        'enrollment_status', 'Active'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Database Error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_student_class(UUID, BIGINT, BIGINT) TO authenticated;

COMMIT;
