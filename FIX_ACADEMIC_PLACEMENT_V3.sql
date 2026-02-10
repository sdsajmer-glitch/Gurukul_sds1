-- ==============================================================================
-- ACADEMIC PLACEMENT V3 - THE DEFINITIVE FIX
-- ==============================================================================
-- This script creates BRAND NEW functions with a '_v3' suffix to avoid ANY
-- signature conflicts, caching issues, or ambiguity with previous versions.
-- ==============================================================================

BEGIN;

-- 1. FIX RLS POLICIES (ENSURE ADMIN ACCESS)
-- ==============================================================================
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

-- 2. NEW CLASS FETCH FUNCTION (V3)
-- ==============================================================================
DROP FUNCTION IF EXISTS public.get_classes_v3(BIGINT);

CREATE OR REPLACE FUNCTION public.get_classes_v3(
    p_branch_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    grade_level TEXT,
    section TEXT,
    academic_year TEXT,
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
        (SELECT COUNT(*) FROM public.student_profiles s WHERE s.assigned_class_id = c.id) as student_count,
        c.branch_id
    FROM public.school_classes c
    WHERE (p_branch_id IS NULL OR c.branch_id = p_branch_id)
    ORDER BY c.grade_level, c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_classes_v3(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_classes_v3(BIGINT) TO service_role;


-- 3. NEW ASSIGNMENT FUNCTION (V3)
-- ==============================================================================
DROP FUNCTION IF EXISTS public.assign_student_class_v3(UUID, BIGINT, BIGINT);

CREATE OR REPLACE FUNCTION public.assign_student_class_v3(
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
    v_class_record RECORD;
    v_rows INT;
BEGIN
    -- 1. Verify Class
    SELECT * INTO v_class_record FROM public.school_classes WHERE id = p_class_id;
    
    IF v_class_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Class not found (V3)');
    END IF;

    -- 2. Direct Update
    UPDATE public.student_profiles
    SET 
        assigned_class_id = p_class_id,
        grade = COALESCE(v_class_record.grade_level, grade),
        academic_year = COALESCE(v_class_record.academic_year, academic_year),
        enrollment_status = 'Active',
        branch_id = COALESCE(p_branch_id, v_class_record.branch_id, branch_id),
        updated_at = NOW()
    WHERE user_id = p_student_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
         -- Check if student exists
        PERFORM 1 FROM public.student_profiles WHERE user_id = p_student_id;
        IF NOT FOUND THEN
             RETURN jsonb_build_object('success', false, 'message', 'Student profile does not exist (V3)');
        END IF;
        RETURN jsonb_build_object('success', false, 'message', 'Update failed - No rows affected (V3)');
    END IF;

    -- 3. Sync Admissions (Optional)
    BEGIN
        UPDATE public.admissions
        SET 
            status = 'Enrolled',
            grade = COALESCE(v_class_record.grade_level, grade),
            updated_at = NOW()
        WHERE student_user_id = p_student_id;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore admission sync errors
    END;

    -- 4. Verify Persistence
    PERFORM 1 FROM public.student_profiles 
    WHERE user_id = p_student_id AND assigned_class_id = p_class_id;

    IF NOT FOUND THEN
         RETURN jsonb_build_object('success', false, 'message', 'Persistence Verification Failed (V3)');
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Enrollment Finalised',
        'debug', jsonb_build_object('rows', v_rows, 'class', v_class_record.name)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Database Error (V3): ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_student_class_v3(UUID, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_student_class_v3(UUID, BIGINT, BIGINT) TO service_role;

COMMIT;
