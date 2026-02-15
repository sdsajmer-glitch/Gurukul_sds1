-- =============================================================================
-- ACADEMIC INTELLIGENCE ENGINE (Phase 4)
-- =============================================================================
-- Covers: Grading Scales, Exam Reporting, Student Analytics RPCs
-- =============================================================================

BEGIN;

-- [0] BASE TABLES (If not exist)
CREATE TABLE IF NOT EXISTS public.subject_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_cycle_id BIGINT,
    class_id BIGINT,
    subject_id UUID,
    title TEXT NOT NULL, -- e.g. "Mid Term 1"
    exam_date DATE,
    total_marks NUMERIC DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'DRAFT' -- DRAFT, PUBLISHED, ARCHIVED
);

CREATE TABLE IF NOT EXISTS public.exam_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_exam_id UUID REFERENCES public.subject_exams(id) ON DELETE CASCADE,
    student_id UUID,
    marks_obtained NUMERIC,
    is_absent BOOLEAN DEFAULT false,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_exam_id, student_id)
);

-- [1] GRADING SCALES (International Standards)
CREATE TABLE IF NOT EXISTS public.grade_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- e.g., 'CBSE Secondary', 'IB DP', 'ICSE'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.grade_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scale_id UUID REFERENCES public.grade_scales(id) ON DELETE CASCADE,
    grade_label TEXT NOT NULL, -- 'A1', 'A+', '7'
    min_percentage NUMERIC NOT NULL,
    max_percentage NUMERIC NOT NULL,
    grade_point NUMERIC, -- 10, 9, 4.0
    description TEXT,
    color_code TEXT DEFAULT '#ffffff'
);

-- Seed Default CBSE-like Scale
INSERT INTO public.grade_scales (id, name) VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Standard Grading') ON CONFLICT DO NOTHING;

INSERT INTO public.grade_rules (scale_id, grade_label, min_percentage, max_percentage, grade_point, color_code, description)
VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'A1', 91, 100, 10.0, '#10b981', 'Outstanding'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'A2', 81, 90, 9.0, '#34d399', 'Excellent'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'B1', 71, 80, 8.0, '#60a5fa', 'Very Good'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'B2', 61, 70, 7.0, '#93c5fd', 'Good'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'C1', 51, 60, 6.0, '#f59e0b', 'Satisfactory'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'C2', 41, 50, 5.0, '#fbbf24', 'Average'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'D', 33, 40, 4.0, '#f87171', 'Below Average'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'E', 0, 32, 0.0, '#ef4444', 'Needs Improvement')
ON CONFLICT DO NOTHING;


-- [2] HELPER: Calculate Grade from Percentage
CREATE OR REPLACE FUNCTION public.calculate_grade(p_percentage NUMERIC)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_grade JSONB;
BEGIN
    SELECT jsonb_build_object(
        'label', grade_label,
        'point', grade_point,
        'color', color_code,
        'description', description
    ) INTO v_grade
    FROM public.grade_rules
    WHERE scale_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' -- Default Scale
      AND p_percentage BETWEEN min_percentage AND max_percentage
    LIMIT 1;

    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('label', 'N/A', 'point', 0, 'color', '#666666');
    END IF;

    RETURN v_grade;
END;
$$;


-- [3] DATA FETCH: Student Assessment Report
-- Analyzes all exams for a student in a cycle and returns structured report
CREATE OR REPLACE FUNCTION public.get_student_academic_report(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_cycle_id BIGINT := p_cycle_id;
    v_exams JSONB;
    v_subjects JSONB;
    v_summary JSONB;
    v_total_marks NUMERIC := 0;
    v_obtained_marks NUMERIC := 0;
    v_percentage NUMERIC := 0;
    v_grade_info JSONB;
BEGIN
    -- Resolve Cycle
    IF v_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    END IF;

    -- Fetch Exam Results
    -- We assume table structure: exam_marks(student_id, subject_exam_id, marks_obtained)
    -- and subject_exams(id, title, total_marks, subject_id, exam_date)
    -- Adjusting to match probable schema or standardizing it.
    
    WITH student_marks AS (
        SELECT 
            em.id AS mark_id,
            em.marks_obtained,
            em.is_absent,
            se.title AS exam_title,
            se.total_marks,
            se.exam_date,
            sub.name AS subject_name,
            sub.code AS subject_code,
            se.academic_cycle_id
        FROM public.exam_marks em
        JOIN public.subject_exams se ON em.subject_exam_id = se.id
        LEFT JOIN public.subjects sub ON se.subject_id = sub.id
        WHERE em.student_id = p_student_id
          AND (v_cycle_id IS NULL OR se.academic_cycle_id = v_cycle_id)
    )
    SELECT jsonb_agg(jsonb_build_object(
        'exam', exam_title,
        'subject', subject_name,
        'date', exam_date,
        'marks_obtained', marks_obtained,
        'total_marks', total_marks,
        'percentage', CASE WHEN total_marks > 0 THEN ROUND((marks_obtained / total_marks) * 100, 2) ELSE 0 END,
        'grade', public.calculate_grade(CASE WHEN total_marks > 0 THEN (marks_obtained / total_marks) * 100 ELSE 0 END),
        'is_absent', is_absent
    )) INTO v_exams
    FROM student_marks;

    -- Calculate Totals
    SELECT 
        COALESCE(SUM(se.total_marks), 0),
        COALESCE(SUM(em.marks_obtained), 0)
    INTO v_total_marks, v_obtained_marks
    FROM public.exam_marks em
    JOIN public.subject_exams se ON em.subject_exam_id = se.id
    WHERE em.student_id = p_student_id
      AND (v_cycle_id IS NULL OR se.academic_cycle_id = v_cycle_id)
      AND em.is_absent = false;

    IF v_total_marks > 0 THEN
        v_percentage := ROUND((v_obtained_marks / v_total_marks) * 100, 2);
    ELSE
        v_percentage := 0;
    END IF;

    v_grade_info := public.calculate_grade(v_percentage);

    -- Subject-wise Aggregates
    SELECT jsonb_agg(sub_agg) INTO v_subjects FROM (
        SELECT 
            sub.name AS subject,
            COUNT(em.id) AS exams_count,
            SUM(em.marks_obtained) AS total_obtained,
            SUM(se.total_marks) AS total_max,
            ROUND((SUM(em.marks_obtained) / NULLIF(SUM(se.total_marks), 0)) * 100, 2) AS percentage
        FROM public.exam_marks em
        JOIN public.subject_exams se ON em.subject_exam_id = se.id
        LEFT JOIN public.subjects sub ON se.subject_id = sub.id
        WHERE em.student_id = p_student_id
          AND (v_cycle_id IS NULL OR se.academic_cycle_id = v_cycle_id)
        GROUP BY sub.name
    ) sub_agg;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'percentage', v_percentage,
            'total_exams', (SELECT COUNT(*) FROM public.exam_marks em JOIN public.subject_exams se ON em.subject_exam_id = se.id WHERE em.student_id = p_student_id AND se.academic_cycle_id = v_cycle_id),
            'final_grade', v_grade_info->>'label',
            'health_color', v_grade_info->>'color'
        ),
        'exams', COALESCE(v_exams, '[]'::jsonb),
        'subjects', COALESCE(v_subjects, '[]'::jsonb),
        'cycle_id', v_cycle_id
    );
END;
$$;

-- [4] DATA ENTRY: Teacher/Admin Marks Upsert
CREATE OR REPLACE FUNCTION public.upsert_exam_mark_forensic(
    p_subject_exam_id UUID,
    p_student_id UUID,
    p_marks NUMERIC,
    p_is_absent BOOLEAN,
    p_reason TEXT,
    p_operator_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.exam_marks (
        subject_exam_id,
        student_id,
        marks_obtained,
        is_absent,
        reason,
        updated_at
    )
    VALUES (
        p_subject_exam_id,
        p_student_id,
        p_marks,
        p_is_absent,
        p_reason,
        NOW()
    )
    ON CONFLICT (subject_exam_id, student_id)
    DO UPDATE SET
        marks_obtained = EXCLUDED.marks_obtained,
        is_absent = EXCLUDED.is_absent,
        reason = EXCLUDED.reason,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;
