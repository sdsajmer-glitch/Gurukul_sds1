-- ==============================================================================
-- FIX: Courses Upload & Visibility
-- Problem: Courses upload succeeds but they don't appear in the list.
-- Cause: 
-- 1. `courses` table is missing `branch_id` column, so courses are orphaned/global.
-- 2. `bulk_import_courses` RPC was not saving `branch_id`.
-- 3. RLS policies likely prevented viewing (or lack of branch filtering caused confusion).
-- ==============================================================================

-- 1. Add branch_id to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS branch_id bigint REFERENCES public.school_branches(id);

-- 2. Enable RLS on courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- 3. Define RLS Policies for Courses
--    We drop existing ones to ensure clean state
DROP POLICY IF EXISTS "Admins can manage courses in their branch" ON public.courses;
DROP POLICY IF EXISTS "Users can view courses in their branch" ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can view courses" ON public.courses; 

-- Policy: Admins can manage (insert/update/delete) courses in their branch
CREATE POLICY "Admins can manage courses in their branch" ON public.courses
FOR ALL
USING (
    branch_id IN (SELECT get_my_branch_ids())
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Academic Coordinator', 'Principal')
    )
);

-- Policy: Users can view courses in their branch
-- This includes Admins, Teachers, Students, Parents linked to the branch
CREATE POLICY "Users can view courses in their branch" ON public.courses
FOR SELECT
USING (
    branch_id IN (SELECT get_my_branch_ids())
);

-- 4. Update bulk_import_courses RPC to handle branch_id
DROP FUNCTION IF EXISTS public.bulk_import_courses(jsonb);
DROP FUNCTION IF EXISTS public.bulk_import_courses(jsonb, bigint);

CREATE OR REPLACE FUNCTION public.bulk_import_courses(p_courses jsonb, p_branch_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    course_data jsonb;
    success_count int := 0;
    failure_count int := 0;
    errors jsonb[] := ARRAY[]::jsonb[];
BEGIN
    -- Validate branch_id
    IF p_branch_id IS NULL THEN
        RAISE EXCEPTION 'Branch ID is required for course import';
    END IF;

    -- Verify user has access to this branch
    IF NOT EXISTS (
        SELECT 1 FROM public.school_branches 
        WHERE id = p_branch_id 
        AND id IN (SELECT get_my_branch_ids())
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have access to this branch';
    END IF;

    FOR course_data IN SELECT * FROM jsonb_array_elements(p_courses)
    LOOP
        BEGIN
            INSERT INTO public.courses (
                title, 
                code, 
                grade_level, 
                description, 
                category, 
                credits, 
                status, 
                department,
                branch_id
            ) VALUES (
                course_data->>'title',
                course_data->>'code',
                course_data->>'grade_level',
                course_data->>'description',
                COALESCE(course_data->>'category', 'Core'),
                (course_data->>'credits')::numeric,
                'Active',
                course_data->>'department',
                p_branch_id
            );
            success_count := success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            failure_count := failure_count + 1;
            errors := array_append(errors, jsonb_build_object(
                'row_index', (course_data->>'row_index')::int,
                'title', course_data->>'title',
                'error', SQLERRM
            ));
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success_count', success_count,
        'failure_count', failure_count,
        'errors', to_jsonb(errors)
    );
END;
$function$;

-- 5. Grant permissions
GRANT ALL ON public.courses TO authenticated;
