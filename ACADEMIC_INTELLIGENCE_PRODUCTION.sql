-- =============================================================================
-- ACADEMIC INTELLIGENCE PRODUCTION (Phase 5)
-- =============================================================================
-- 1. Hardening Schema (Subjects, Exams, Marks)
-- 2. Performance Tracking & Analytics RPCs
-- 3. Automated Mock Data for 2025-26 Cycle
-- =============================================================================

BEGIN;

-- [0] CORE ACADEMIC REGISTRY (UUID Based)
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    department TEXT,
    credits NUMERIC DEFAULT 1.0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Registry
INSERT INTO public.subjects (name, code, department) VALUES 
('Mathematics', 'MAT-SEC', 'Science & Logic'),
('Physics', 'PHY-SEC', 'Science & Logic'),
('English Literature', 'ENG-LIT', 'Humanities'),
('Computer Science', 'CS-ADV', 'Technology'),
('World History', 'HIS-GLB', 'Humanities')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- [1] EXAM INFRASTRUCTURE (Correction)
DROP TABLE IF EXISTS public.exam_marks CASCADE;
DROP TABLE IF EXISTS public.subject_exams CASCADE;

CREATE TABLE public.subject_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_cycle_id BIGINT,
    class_id BIGINT,
    subject_id UUID REFERENCES public.subjects(id),
    title TEXT NOT NULL, -- e.g. "Terminal Assessment 1"
    exam_date DATE DEFAULT CURRENT_DATE,
    total_marks NUMERIC DEFAULT 100,
    status TEXT DEFAULT 'PUBLISHED', -- DRAFT, PUBLISHED
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.exam_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_exam_id UUID REFERENCES public.subject_exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    marks_obtained NUMERIC,
    is_absent BOOLEAN DEFAULT false,
    teacher_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_exam_id, student_id)
);

-- [2] ATTENANCE INTEGRITY
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    academic_cycle_id BIGINT,
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'present', -- present, absent, late, excused
    remarks TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, attendance_date)
);

-- [3] PRODUCTION RPC: COMPREHENSIVE ACADEMIC INTEL
CREATE OR REPLACE FUNCTION public.get_student_academic_intel_v1(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
    v_cycle_id BIGINT := p_cycle_id;
    v_results JSONB;
    v_attendance_stat JSONB;
    v_performance_avg NUMERIC;
BEGIN
    -- Resolve Cycle
    IF v_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    END IF;

    -- 1. Attendance Metrics
    SELECT jsonb_build_object(
        'percentage', ROUND((COUNT(*) FILTER (WHERE status = 'present')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1),
        'total_days', COUNT(*),
        'present_days', COUNT(*) FILTER (WHERE status = 'present'),
        'absent_days', COUNT(*) FILTER (WHERE status = 'absent')
    ) INTO v_attendance_stat
    FROM public.attendance_records
    WHERE student_id = p_student_id AND (v_cycle_id IS NULL OR academic_cycle_id = v_cycle_id);

    -- 2. Performance Aggregates
    SELECT ROUND(AVG((marks_obtained / total_marks) * 100), 1) INTO v_performance_avg
    FROM public.exam_marks em
    JOIN public.subject_exams se ON em.subject_exam_id = se.id
    WHERE em.student_id = p_student_id AND se.academic_cycle_id = v_cycle_id AND em.is_absent = false;

    -- 3. Final Payload
    SELECT jsonb_build_object(
        'summary', jsonb_build_object(
            'overall_score', COALESCE(v_performance_avg, 0),
            'attendance', COALESCE(v_attendance_stat, jsonb_build_object('percentage', 0, 'total_days', 0)),
            'status', CASE 
                WHEN v_performance_avg >= 90 THEN 'EXEMPLARY'
                WHEN v_performance_avg >= 75 THEN 'STABLE'
                WHEN v_performance_avg >= 40 THEN 'SATISFACTORY'
                ELSE 'ATTENTION_REQUIRED'
            END
        ),
        'subjects', (
            SELECT jsonb_agg(s) FROM (
                SELECT 
                    sub.name,
                    sub.code,
                    sub.department,
                    ROUND(AVG((em.marks_obtained / se.total_marks) * 100), 1) as proficiency,
                    jsonb_agg(jsonb_build_object(
                        'exam', se.title,
                        'score', em.marks_obtained,
                        'total', se.total_marks,
                        'date', se.exam_date
                    )) as history
                FROM public.exam_marks em
                JOIN public.subject_exams se ON em.subject_exam_id = se.id
                JOIN public.subjects sub ON se.subject_id = sub.id
                WHERE em.student_id = p_student_id AND se.academic_cycle_id = v_cycle_id
                GROUP BY sub.id, sub.name, sub.code, sub.department
            ) s
        )
    ) INTO v_results;

    RETURN v_results;
END;
$$;

-- [4] MOCK DATA ORCHESTRATOR (Feb 2026 Sync)
DO $$
DECLARE
    v_student RECORD;
    v_subject RECORD;
    v_cycle_id BIGINT;
    v_exam_id UUID;
    v_date DATE;
    v_mark NUMERIC;
BEGIN
    SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    
    IF v_cycle_id IS NULL THEN RETURN; END IF;

    -- For each student
    FOR v_student IN SELECT user_id FROM public.student_profiles WHERE enrollment_status IN ('Active', 'Enrolled') LOOP
        
        -- Add Attendance History (Last 30 days)
        FOR i IN 0..29 LOOP
            v_date := CURRENT_DATE - i;
            INSERT INTO public.attendance_records (student_id, academic_cycle_id, attendance_date, status)
            VALUES (v_student.user_id, v_cycle_id, v_date, CASE WHEN random() > 0.1 THEN 'present' ELSE 'absent' END)
            ON CONFLICT DO NOTHING;
        END LOOP;

        -- Add Exam Performance for each subject
        FOR v_subject IN SELECT id FROM public.subjects LIMIT 5 LOOP
            
            -- Mid-Term Exam
            INSERT INTO public.subject_exams (academic_cycle_id, subject_id, title, exam_date, total_marks)
            VALUES (v_cycle_id, v_subject.id, 'Mid-Term Assessment', CURRENT_DATE - 60, 100)
            RETURNING id INTO v_exam_id;

            v_mark := 60 + floor(random() * 35); -- 60..95 range
            INSERT INTO public.exam_marks (subject_exam_id, student_id, marks_obtained, teacher_feedback)
            VALUES (v_exam_id, v_student.user_id, v_mark, 'Consistent performance in analytics.')
            ON CONFLICT DO NOTHING;

            -- Unit Test 1
            INSERT INTO public.subject_exams (academic_cycle_id, subject_id, title, exam_date, total_marks)
            VALUES (v_cycle_id, v_subject.id, 'Unit Intelligence Test', CURRENT_DATE - 15, 50)
            RETURNING id INTO v_exam_id;

            v_mark := 35 + floor(random() * 15); -- 35..50 range
            INSERT INTO public.exam_marks (subject_exam_id, student_id, marks_obtained, teacher_feedback)
            VALUES (v_exam_id, v_student.user_id, v_mark, 'Exceptional logic application.')
            ON CONFLICT DO NOTHING;

        END LOOP;
    END LOOP;
END $$;

COMMIT;
