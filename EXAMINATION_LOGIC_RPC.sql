
-- =============================================================================
-- EXAMINATION LOGIC ENGINE: RPC INTERFACE
-- =============================================================================
-- Description: Business logic for exam orchestration, mark entry, 
--              and performance analytics.
-- =============================================================================

BEGIN;

-- [1] GET_ADMIN_EXAM_OVERVIEW
-- Purpose: Dashboard view of all exams with completion stats
DROP FUNCTION IF EXISTS public.get_admin_exam_overview(bigint);

CREATE OR REPLACE FUNCTION public.get_admin_exam_overview(p_branch_id BIGINT)
RETURNS TABLE (
    exam_id UUID,
    cycle_name TEXT,
    class_name TEXT,
    subject_title TEXT,
    total_marks NUMERIC,
    entry_count INTEGER,
    student_count INTEGER,
    status TEXT,
    exam_date DATE
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        se.id,
        ec.name::TEXT,
        ('Grade ' || c.grade_level || ' ' || c.section)::TEXT,
        co.title::TEXT,
        se.total_marks,
        COUNT(DISTINCT em.id)::INTEGER as entry_count,
        (SELECT COUNT(sp.user_id) FROM student_profiles sp WHERE sp.assigned_class_id = se.class_id)::INTEGER as student_count,
        CASE 
            WHEN se.is_marks_published THEN 'PUBLISHED'
            WHEN COUNT(DISTINCT em.id) > 0 THEN 'PENDING'
            ELSE 'SCHEDULED'
        END as status,
        se.exam_date
    FROM subject_exams se
    JOIN exam_cycles ec ON se.exam_cycle_id = ec.id
    JOIN classes c ON se.class_id = c.id
    JOIN courses co ON se.course_id = co.id
    LEFT JOIN exam_marks em ON se.id = em.subject_exam_id
    WHERE (p_branch_id IS NULL OR ec.branch_id = p_branch_id)
    GROUP BY se.id, ec.name, c.grade_level, c.section, co.title, se.is_marks_published, se.exam_date;
END;
$$;

-- [2] UPSERT_EXAM_MARK_FORENSIC
-- Purpose: Record marks with immutable audit tracking
DROP FUNCTION IF EXISTS public.upsert_exam_mark_forensic(uuid, uuid, numeric, boolean, text, uuid);

CREATE OR REPLACE FUNCTION public.upsert_exam_mark_forensic(
    p_subject_exam_id UUID,
    p_student_id UUID,
    p_marks NUMERIC,
    p_is_absent BOOLEAN,
    p_reason TEXT,
    p_operator_id UUID
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
    v_mark_id UUID;
    v_old_marks NUMERIC;
BEGIN
    -- 1. Check for existing record
    SELECT id, marks_obtained INTO v_mark_id, v_old_marks 
    FROM exam_marks 
    WHERE subject_exam_id = p_subject_exam_id AND student_id = p_student_id;

    IF v_mark_id IS NULL THEN
        -- Insert new record
        INSERT INTO exam_marks (subject_exam_id, student_id, marks_obtained, is_absent, recorded_by, last_modified_by)
        VALUES (p_subject_exam_id, p_student_id, p_marks, p_is_absent, p_operator_id, p_operator_id)
        RETURNING id INTO v_mark_id;
    ELSE
        -- Update existing record
        UPDATE exam_marks 
        SET marks_obtained = p_marks, 
            is_absent = p_is_absent, 
            last_modified_by = p_operator_id,
            updated_at = NOW()
        WHERE id = v_mark_id;

        -- Create Audit Entry if marks changed
        IF v_old_marks IS DISTINCT FROM p_marks THEN
            INSERT INTO exam_marks_audit (marks_id, old_marks, new_marks, reason, modified_by)
            VALUES (v_mark_id, v_old_marks, p_marks, p_reason, p_operator_id);
        END IF;
    END IF;

    RETURN v_mark_id;
END;
$$;

-- [3] GET_CLASS_PERFORMANCE_BELL_CURVE
-- Purpose: Analytic data for Bell Curve visualization
DROP FUNCTION IF EXISTS public.get_class_performance_bell_curve(uuid);

CREATE OR REPLACE FUNCTION public.get_class_performance_bell_curve(p_subject_exam_id UUID)
RETURNS TABLE (
    score_range TEXT,
    student_count INTEGER,
    is_passing BOOLEAN
) LANGUAGE plpgsql AS $$
DECLARE
    v_total_marks NUMERIC;
    v_passing_marks NUMERIC;
BEGIN
    SELECT total_marks, passing_marks INTO v_total_marks, v_passing_marks 
    FROM subject_exams WHERE id = p_subject_exam_id;

    RETURN QUERY
    SELECT 
        ranges.r::TEXT,
        COUNT(em.id)::INTEGER,
        (CASE 
            WHEN CAST(SPLIT_PART(ranges.r, '-', 1) AS NUMERIC) >= v_passing_marks THEN true 
            ELSE false 
        END)
    FROM (
        VALUES ('0-20'), ('21-40'), ('41-60'), ('61-80'), ('81-100')
    ) AS ranges(r)
    LEFT JOIN exam_marks em ON (
        (em.marks_obtained / v_total_marks * 100) > CAST(SPLIT_PART(ranges.r, '-', 1) AS NUMERIC) - 1
        AND (em.marks_obtained / v_total_marks * 100) <= CAST(SPLIT_PART(ranges.r, '-', 2) AS NUMERIC)
    ) AND em.subject_exam_id = p_subject_exam_id
    GROUP BY ranges.r
    ORDER BY ranges.r;
END;
$$;

COMMIT;
