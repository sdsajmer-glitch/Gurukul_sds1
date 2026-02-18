-- =============================================================================
-- ACADEMIC INTELLIGENCE: MASTER PORTAL INFRASTRUCTURE (V4 - ULTRA ROBUST)
-- =============================================================================
-- 1. Extends schema for Assignments, Remarks, and Student-Subject Mapping.
-- 2. Implements the "Master Intel" RPC for Parent Portal.
-- 3. Provides logic for performance trending and risk prediction.
-- 4. High-Fidelity Seeder for existing student nodes (e.g. Risbah Sharma).
-- =============================================================================

BEGIN;

-- [0] CORE REGISTRY BOOTSTRAP
-- Ensure the subjects table exists before we establish foreign keys
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    department TEXT,
    credits NUMERIC DEFAULT 1.0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Attendance Hardening
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    academic_cycle_id BIGINT,
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'present',
    remarks TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, attendance_date)
);

ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS academic_cycle_id BIGINT;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_student_id_attendance_date_key') THEN
        ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_student_id_attendance_date_key UNIQUE (student_id, attendance_date);
    END IF;
END $$;

-- 2. Exam Hardening
-- Drop legacy structures to ensure path to UUID alignment is clear
DROP TABLE IF EXISTS public.exam_marks CASCADE;
DROP TABLE IF EXISTS public.subject_exams CASCADE;

CREATE TABLE public.subject_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_cycle_id BIGINT,
    class_id BIGINT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    exam_date DATE DEFAULT CURRENT_DATE,
    total_marks NUMERIC DEFAULT 100,
    status TEXT DEFAULT 'PUBLISHED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.exam_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_exam_id UUID REFERENCES public.subject_exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    marks_obtained NUMERIC,
    is_absent BOOLEAN DEFAULT false,
    teacher_feedback TEXT,
    status TEXT DEFAULT 'PUBLISHED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_exam_id, student_id)
);

-- [1] CORE INFRASTRUCTURE UPGRADE
-- Cleanse ALL legacy assignment structures to ensure global UUID alignment
-- We drop assignment_submissions first as it is the primary legacy consumer
DROP TABLE IF EXISTS public.assignment_submissions CASCADE;
DROP TABLE IF EXISTS public.student_assignments CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.teacher_remarks CASCADE;

-- Ensure the search path is set to public for type resolution
SET search_path = public, pg_catalog;

CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    academic_cycle_id BIGINT,
    class_id BIGINT,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    total_points NUMERIC DEFAULT 100,
    status TEXT DEFAULT 'PUBLISHED', -- DRAFT, PUBLISHED, CLOSED
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.student_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    submission_status TEXT DEFAULT 'PENDING', -- PENDING, SUBMITTED, LATE, GRADED
    attachment_url TEXT,
    marks_obtained NUMERIC,
    teacher_comments TEXT,
    submitted_at TIMESTAMPTZ,
    UNIQUE(assignment_id, student_id)
);

CREATE TABLE public.teacher_remarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id),
    category TEXT DEFAULT 'ACADEMIC', -- ACADEMIC, BEHAVIORAL, GENERAL, ALERT
    remark TEXT NOT NULL,
    severity TEXT DEFAULT 'NEUTRAL', -- NEUTRAL, POSITIVE, CONCERN, CRITICAL
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- [2] THE MASTER INTEL RPC (Parent-Student Hardened)
CREATE OR REPLACE FUNCTION public.get_student_academic_master_intel(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_cycle_id BIGINT := p_cycle_id;
    v_parent_id UUID := auth.uid();
    v_result JSONB;
    v_attendance_stat JSONB;
    v_perf_summary JSONB;
    v_risk_level TEXT := 'STABLE';
    v_risk_reason TEXT := 'Overall performance is within institutional standards.';
    v_aggregate_score NUMERIC;
BEGIN
    -- 0. SECURITY HANDSHAKE (Validate Parent-Student Ownership)
    IF NOT EXISTS (
        SELECT 1 FROM public.student_parents 
        WHERE student_id = p_student_id AND parent_id = v_parent_id
    ) AND NOT EXISTS (
        SELECT 1 FROM public.admissions 
        WHERE (student_user_id = p_student_id OR parent_id = v_parent_id) 
        AND student_user_id = p_student_id AND parent_id = v_parent_id
    ) THEN
        -- Allow if Super Admin is testing, but primarily check ownership
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_parent_id AND is_super_admin = true) THEN
             RETURN jsonb_build_object('error', '403_ACCESS_FORBIDDEN');
        END IF;
    END IF;

    -- 1. RESOLVE CYCLE
    IF v_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
        IF v_cycle_id IS NULL THEN
            SELECT id INTO v_cycle_id FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
        END IF;
    END IF;

    -- 2. ATTENDANCE CLARITY
    SELECT jsonb_build_object(
        'percentage', ROUND((COUNT(*) FILTER (WHERE status = 'present')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1),
        'total_days', COUNT(*),
        'present_days', COUNT(*) FILTER (WHERE status = 'present'),
        'absent_days', COUNT(*) FILTER (WHERE status = 'absent'),
        'heatmap', (
            SELECT jsonb_agg(h) FROM (
                SELECT attendance_date as date, status FROM public.attendance_records 
                WHERE student_id = p_student_id AND academic_cycle_id = v_cycle_id 
                ORDER BY attendance_date DESC LIMIT 31
            ) h
        )
    ) INTO v_attendance_stat
    FROM public.attendance_records
    WHERE student_id = p_student_id AND (v_cycle_id IS NULL OR academic_cycle_id = v_cycle_id);

    -- 3. SUBJECT PERFORMANCE MATRIX
    WITH subject_data AS (
        SELECT 
            sub.id as s_id,
            sub.name,
            sub.code,
            sub.department,
            ROUND(AVG((em.marks_obtained / se.total_marks) * 100), 1) as proficiency
        FROM public.exam_marks em
        JOIN public.subject_exams se ON em.subject_exam_id = se.id
        JOIN public.subjects sub ON se.subject_id = sub.id
        WHERE em.student_id = p_student_id AND se.academic_cycle_id = v_cycle_id
        GROUP BY sub.id, sub.name, sub.code, sub.department
    )
    SELECT COALESCE(jsonb_agg(sd), '[]'::jsonb) INTO v_perf_summary FROM subject_data sd;

    -- 4. RISK PREDICTION ENGINE (Logic based)
    SELECT ROUND(AVG((marks_obtained / total_marks) * 100), 1) INTO v_aggregate_score
    FROM public.exam_marks em
    JOIN public.subject_exams se ON em.subject_exam_id = se.id
    WHERE em.student_id = p_student_id AND se.academic_cycle_id = v_cycle_id;

    IF v_aggregate_score < 40 OR (v_attendance_stat->>'percentage')::NUMERIC < 75 THEN
        v_risk_level := 'CRITICAL';
        v_risk_reason := 'Warning: Performance or attendance node is below critical threshold.';
    ELSIF v_aggregate_score < 60 THEN
        v_risk_level := 'AT_RISK';
        v_risk_reason := 'Pre-emptive Alert: Subject-wise progression shows volatility.';
    END IF;

    -- 5. FINAL PAYLOAD ASSEMBLY
    SELECT jsonb_build_object(
        'overview', jsonb_build_object(
            'overall_score', COALESCE(v_aggregate_score, 0),
            'attendance_rate', COALESCE((v_attendance_stat->>'percentage')::NUMERIC, 0),
            'subjects_count', (SELECT COUNT(*) FROM public.subjects),
            'assignments_pending', (SELECT COUNT(*) FROM public.assignments a 
                                    LEFT JOIN public.student_assignments sa ON a.id = sa.assignment_id AND sa.student_id = p_student_id
                                    WHERE a.academic_cycle_id = v_cycle_id AND (sa.id IS NULL OR sa.submission_status = 'PENDING')),
            'upcoming_exams', (SELECT COUNT(*) FROM public.subject_exams se WHERE se.academic_cycle_id = v_cycle_id AND se.exam_date > CURRENT_DATE),
            'risk', jsonb_build_object('level', v_risk_level, 'reason', v_risk_reason)
        ),
        'attendance', v_attendance_stat,
        'subjects', v_perf_summary,
        'exams', (
            SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM (
                SELECT se.title, sub.name as subject_name, se.exam_date, se.total_marks, em.marks_obtained, em.status
                FROM public.subject_exams se
                JOIN public.subjects sub ON se.subject_id = sub.id
                LEFT JOIN public.exam_marks em ON se.id = em.subject_exam_id AND em.student_id = p_student_id
                WHERE se.academic_cycle_id = v_cycle_id
                ORDER BY se.exam_date DESC LIMIT 15
            ) e
        ),
        'assignments', (
            SELECT COALESCE(jsonb_agg(a), '[]'::jsonb) FROM (
                SELECT a.title, sub.name as subject_name, a.due_date, COALESCE(sa.submission_status, 'PENDING') as status
                FROM public.assignments a
                JOIN public.subjects sub ON a.subject_id = sub.id
                LEFT JOIN public.student_assignments sa ON a.id = sa.assignment_id AND sa.student_id = p_student_id
                WHERE a.academic_cycle_id = v_cycle_id
                ORDER BY a.due_date ASC
            ) a
        ),
        'remarks', (
            SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
                SELECT tr.remark, tr.category, tr.severity, tr.recorded_at, p.display_name as teacher_name
                FROM public.teacher_remarks tr
                LEFT JOIN public.profiles p ON tr.teacher_id = p.id
                WHERE tr.student_id = p_student_id
                ORDER BY tr.recorded_at DESC LIMIT 10
            ) r
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Grant Execution to Parents/Authenticated
GRANT EXECUTE ON FUNCTION public.get_student_academic_master_intel(UUID, BIGINT) TO authenticated;

-- [MOCK DATA SEEDER - High Fidelity]
DO $$
DECLARE
    v_student RECORD;
    v_subject RECORD;
    v_cycle_id BIGINT;
    v_exam_id UUID;
    v_date DATE;
BEGIN
    -- 1. Resolve Academic Cycle (Safely)
    SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    IF v_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
    END IF;

    -- If no cycle exists, we can't seed data
    IF v_cycle_id IS NULL THEN RETURN; END IF;

    -- 2. Ensure we have subjects to reference
    IF NOT EXISTS (SELECT 1 FROM public.subjects) THEN
        INSERT INTO public.subjects (name, code, department) VALUES 
        ('Mathematics', 'MAT-SEC', 'Science & Logic'),
        ('Physics', 'PHY-SEC', 'Science & Logic'),
        ('English Literature', 'ENG-LIT', 'Humanities'),
        ('Computer Science', 'CS-ADV', 'Technology')
        ON CONFLICT DO NOTHING;
    END IF;

    -- 3. Populate ALL Active Students with History
    FOR v_student IN SELECT user_id FROM public.student_profiles WHERE is_active = true LOOP
        
        -- Seed Attendance (Last 31 days)
        FOR i IN 0..30 LOOP
            v_date := CURRENT_DATE - i;
            INSERT INTO public.attendance_records (student_id, academic_cycle_id, attendance_date, status)
            VALUES (
                v_student.user_id, 
                v_cycle_id, 
                v_date, 
                (CASE WHEN random() > 0.1 THEN 'present' ELSE 'absent' END)::attendance_status
            )
            ON CONFLICT (student_id, attendance_date) DO NOTHING;
        END LOOP;

        -- Seed Exam Matrix (Sample per subject)
        FOR v_subject IN SELECT id, name FROM public.subjects LOOP
            
            -- Main Assessment
            INSERT INTO public.subject_exams (academic_cycle_id, subject_id, title, exam_date, total_marks)
            VALUES (v_cycle_id, v_subject.id, v_subject.name || ' - Term Assessment', CURRENT_DATE - 15, 100)
            RETURNING id INTO v_exam_id;

            INSERT INTO public.exam_marks (subject_exam_id, student_id, marks_obtained, teacher_feedback)
            VALUES (v_exam_id, v_student.user_id, 65 + floor(random() * 30), 'Institutional node showing stable progression.')
            ON CONFLICT DO NOTHING;

            -- Seed a Mock Assignment
            INSERT INTO public.assignments (subject_id, academic_cycle_id, title, description, due_date)
            VALUES (v_subject.id, v_cycle_id, v_subject.name || ' Exercise', 'Standard periodic evaluation.', CURRENT_DATE + 5)
            RETURNING id INTO v_exam_id; -- Reusing variable

            INSERT INTO public.student_assignments (assignment_id, student_id, submission_status)
            VALUES (v_exam_id, v_student.user_id, 'PENDING')
            ON CONFLICT DO NOTHING;

        END LOOP;

        -- Seed a behavioral remark
        INSERT INTO public.teacher_remarks (student_id, category, remark, severity)
        VALUES (v_student.user_id, 'GENERAL', 'Student is demonstrating consistent engagement with digital coursework.', 'POSITIVE')
        ON CONFLICT DO NOTHING;

    END LOOP;
END $$;

COMMIT;
