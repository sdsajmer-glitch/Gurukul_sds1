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

-- 6. RPC: create_course_with_modules (Atomic & Secure)
CREATE OR REPLACE FUNCTION public.create_course_with_modules(
    p_course_data jsonb,
    p_modules_data jsonb,
    p_branch_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_course_id bigint;
    v_module jsonb;
    v_order int := 1;
BEGIN
    -- 1. Validate Branch Access (Robust Check)
    IF NOT EXISTS (
        SELECT 1 FROM public.school_branches branch
        WHERE branch.id = p_branch_id
        AND (
            branch.school_user_id = auth.uid() OR
            branch.branch_admin_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.user_role_assignments ura
                WHERE ura.user_id = auth.uid() AND ura.branch_id = p_branch_id
                AND ura.role_name IN ('School Administration', 'Branch Admin', 'Academic Coordinator', 'Principal')
            )
            OR EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'Super Admin'
            )
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to create courses in this branch.';
    END IF;

    -- 2. Insert Course
    INSERT INTO public.courses (
        title,
        code,
        description,
        credits,
        category,
        grade_level,
        status,
        teacher_id,
        department,
        subject_type,
        branch_id,
        created_at
    ) VALUES (
        p_course_data->>'title',
        p_course_data->>'code',
        p_course_data->>'description',
        COALESCE((p_course_data->>'credits')::numeric, 3),
        p_course_data->>'category',
        p_course_data->>'grade_level',
        p_course_data->>'status',
        CASE WHEN (p_course_data->>'teacher_id') = '' OR (p_course_data->>'teacher_id') IS NULL THEN NULL 
             ELSE (p_course_data->>'teacher_id')::uuid END,
        p_course_data->>'department',
        p_course_data->>'subject_type',
        p_branch_id,
        now()
    )
    RETURNING id INTO v_course_id;

    -- 3. Insert Modules
    IF p_modules_data IS NOT NULL AND jsonb_array_length(p_modules_data) > 0 THEN
        FOR v_module IN SELECT * FROM jsonb_array_elements(p_modules_data)
        LOOP
            INSERT INTO public.course_modules (
                course_id,
                title,
                duration_hours,
                order_index,
                status
            ) VALUES (
                v_course_id,
                v_module->>'title',
                COALESCE((v_module->>'hours')::numeric, 0),
                v_order,
                'Active'
            );
            v_order := v_order + 1;
        END LOOP;
    END IF;

    -- 4. Log Action
    INSERT INTO public.course_logs (course_id, user_id, action, details)
    VALUES (
        v_course_id,
        auth.uid(),
        'CREATED',
        jsonb_build_object('title', p_course_data->>'title', 'modules_count', v_order - 1)
    );

    RETURN jsonb_build_object('id', v_course_id, 'success', true);
END;
$$;
