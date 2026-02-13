-- ==============================================================================
-- FIX: ACADEMIC FACULTY PERSISTENCE & RPC ENHANCEMENT
-- Description: Upgrades class fetching to include faculty details and 
--              ensures persistence for subject-faculty assignments.
-- ==============================================================================

BEGIN;

-- 1. Upgrade get_all_classes_for_admin to include critical faculty details
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
    branch_name TEXT,
    student_count BIGINT,
    branch_id BIGINT,
    class_teacher_id UUID,
    teacher_name TEXT,
    capacity INTEGER
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
        c.branch_id,
        c.class_teacher_id,
        p.display_name AS teacher_name,
        c.capacity
    FROM public.school_classes c
    LEFT JOIN public.school_branches b ON c.branch_id = b.id
    LEFT JOIN public.profiles p ON c.class_teacher_id = p.id
    WHERE (p_branch_id IS NULL OR c.branch_id = p_branch_id)
    ORDER BY c.grade_level, c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_classes_for_admin(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_classes_for_admin(BIGINT) TO service_role;

-- 2. Ensure class_subjects has proper RLS for management
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage class subjects" ON public.class_subjects;
CREATE POLICY "Admins can manage class subjects" ON public.class_subjects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('School Administration', 'School Administrator', 'Super Admin', 'Admin')
        )
    );

DROP POLICY IF EXISTS "Public can view class subjects" ON public.class_subjects;
CREATE POLICY "Public can view class subjects" ON public.class_subjects
    FOR SELECT USING (true);

COMMIT;
