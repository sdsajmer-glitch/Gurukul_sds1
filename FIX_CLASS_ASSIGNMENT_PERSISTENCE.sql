-- ==============================================================================
-- FIX: Student Enrollment Initialization & Persistence
-- Description: Ensures class assignment persists, updates enrollment status,
--              and creates a permanent institutional link.
-- ==============================================================================

BEGIN;

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
BEGIN
    -- 1. Get current admin ID for audit
    v_user_id := auth.uid();

    -- 2. Validate Class and get Metadata
    SELECT name, grade_level, academic_year INTO v_class_name, v_grade_level, v_academic_year 
    FROM school_classes WHERE id = p_class_id;
    
    IF v_class_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Selected class section does not exist.');
    END IF;

    -- 3. Check profile existence
    SELECT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = p_student_id) INTO v_profile_exists;
    
    IF NOT v_profile_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Student profile not found.');
    END IF;

    -- 4. PERFORM PERMANENT INITIALIZATION
    UPDATE student_profiles
    SET 
        assigned_class_id = p_class_id,
        grade = COALESCE(v_grade_level, grade),
        enrollment_status = 'Active', -- Marks initialization as complete
        updated_at = NOW()
    WHERE user_id = p_student_id;

    -- 5. Institutional Record Sync (Admissions Linkage)
    UPDATE admissions
    SET status = 'Enrolled', 
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
        'ENROLLMENT_INITIALIZED',
        'Academic Placement',
        jsonb_build_object(
            'student_id', p_student_id,
            'class_id', p_class_id,
            'class_name', v_class_name,
            'grade', v_grade_level,
            'academic_year', v_academic_year
        ),
        'info'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Enrollment localized and finalized successfully.',
        'class_name', v_class_name,
        'class_id', p_class_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Registry Error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_student_class(UUID, BIGINT, BIGINT) TO authenticated;

COMMIT;
