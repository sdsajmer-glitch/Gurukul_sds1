-- ==============================================================================
-- FIX: ACADEMIC PLACEMENT V2 - ROBUST PERSISTENCE & PERMISSIONS
-- ==============================================================================
-- This script fixes the "Placement Required" loop by ensuring:
-- 1. School Admins have proper RLS permissions to update profiles directly.
-- 2. The assignment RPC function handles all edge cases and parameter versions.
-- 3. Verification logic in the database confirms the save.
-- ==============================================================================

BEGIN;

-- 1. ENABLE RLS BYPASS FOR SCHOOL ADMINS (Critical for Direct Updates)
-- Grant UPDATE/SELECT on student_profiles to School Administration role
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

-- 2. ROBUST ASSIGNMENT FUNCTION (RPC)
-- Handles optional branch_id and verifies persistence immediately
DROP FUNCTION IF EXISTS public.admin_assign_student_class(UUID, BIGINT, BIGINT);
DROP FUNCTION IF EXISTS public.admin_assign_student_class(UUID, BIGINT);

CREATE OR REPLACE FUNCTION public.admin_assign_student_class(
    p_student_id UUID,
    p_class_id BIGINT,
    p_branch_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to ensure execution
SET search_path = public
AS $$
DECLARE
    v_class_record RECORD;
    v_current_grade TEXT;
BEGIN
    -- Get class details
    SELECT * INTO v_class_record FROM public.school_classes WHERE id = p_class_id;
    
    IF v_class_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Class not found');
    END IF;

    -- Update Student Profile (Force Branch ID update if provided, otherwise keep existing)
    UPDATE public.student_profiles
    SET 
        assigned_class_id = p_class_id,
        grade = COALESCE(v_class_record.grade_level, grade),
        academic_year = COALESCE(v_class_record.academic_year, academic_year),
        enrollment_status = 'Active',
        branch_id = COALESCE(p_branch_id, v_class_record.branch_id, branch_id),
        updated_at = NOW()
    WHERE user_id = p_student_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Student Not Found');
    END IF;

    -- Sync Admission Record (Optional)
    UPDATE public.admissions
    SET 
        status = 'Enrolled',
        grade = COALESCE(v_class_record.grade_level, grade)
    WHERE student_user_id = p_student_id;

    -- Verify the update stuck
    PERFORM 1 FROM public.student_profiles 
    WHERE user_id = p_student_id AND assigned_class_id = p_class_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Persistence Verification Failed');
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Enrollment Finalized',
        'class_name', v_class_record.name,
        'grade', v_class_record.grade_level
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 3. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.admin_assign_student_class(UUID, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_student_class(UUID, BIGINT, BIGINT) TO service_role;

-- 4. FIX GET CLASSES FUNCTION (Ensure it accepts parameters)
DROP FUNCTION IF EXISTS public.get_all_classes_for_admin();
DROP FUNCTION IF EXISTS public.get_all_classes_for_admin(BIGINT);

CREATE OR REPLACE FUNCTION public.get_all_classes_for_admin(
    p_branch_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    grade_level TEXT,
    section TEXT,
    academic_year TEXT,
    student_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        c.id, 
        c.name, 
        c.grade_level, 
        c.section, 
        c.academic_year,
        (SELECT COUNT(*) FROM public.student_profiles s WHERE s.assigned_class_id = c.id) as student_count
    FROM public.school_classes c
    WHERE (p_branch_id IS NULL OR c.branch_id = p_branch_id)
    ORDER BY c.grade_level, c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_classes_for_admin(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_classes_for_admin(BIGINT) TO service_role;

COMMIT;
