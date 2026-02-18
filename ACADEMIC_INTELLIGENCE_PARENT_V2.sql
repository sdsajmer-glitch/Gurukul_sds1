-- =============================================================================
-- ACADEMIC INTELLIGENCE: PARENT PORTAL HARDENING (v2)
-- =============================================================================
-- 1. Implements security-hardened academic intelligence RPC.
-- 2. Integrates ownership checks for parents.
-- 3. Provides comprehensive subject and attendance analytics.
-- =============================================================================

BEGIN;

-- [1] REPAIR: get_student_academic_intel_v2
CREATE OR REPLACE FUNCTION public.get_student_academic_intel_v2(
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
    v_results JSONB;
    v_attendance_stat JSONB;
    v_performance_avg NUMERIC;
BEGIN
    -- 0. OWNERSHIP CHECK (Critical for Parent Portal)
    IF NOT EXISTS (
        SELECT 1 FROM public.get_parent_authorized_nodes() 
        WHERE node_id = p_student_id OR student_user_id = p_student_id
    ) THEN
        RETURN jsonb_build_object('error', '403_ACCESS_FORBIDDEN');
    END IF;

    -- 1. Resolve Cycle
    IF v_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
        -- Fallback to latest
        IF v_cycle_id IS NULL THEN
            SELECT id INTO v_cycle_id FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
        END IF;
    END IF;

    -- 2. Attendance Metrics (Calculated from attendance_records)
    SELECT jsonb_build_object(
        'percentage', ROUND((COUNT(*) FILTER (WHERE status = 'present')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1),
        'total_days', COUNT(*),
        'present_days', COUNT(*) FILTER (WHERE status = 'present'),
        'absent_days', COUNT(*) FILTER (WHERE status = 'absent')
    ) INTO v_attendance_stat
    FROM public.attendance_records
    WHERE student_id = p_student_id AND (v_cycle_id IS NULL OR academic_cycle_id = v_cycle_id);

    -- 3. Performance Aggregates
    SELECT ROUND(AVG((marks_obtained / total_marks) * 100), 1) INTO v_performance_avg
    FROM public.exam_marks em
    JOIN public.subject_exams se ON em.subject_exam_id = se.id
    WHERE em.student_id = p_student_id 
      AND (v_cycle_id IS NULL OR se.academic_cycle_id = v_cycle_id) 
      AND em.is_absent = false;

    -- 4. Final Payload Assembly
    SELECT jsonb_build_object(
        'summary', jsonb_build_object(
            'overall_score', COALESCE(v_performance_avg, 0),
            'attendance', COALESCE(v_attendance_stat, jsonb_build_object('percentage', 0, 'total_days', 0, 'present_days', 0, 'absent_days', 0)),
            'status', CASE 
                WHEN v_performance_avg >= 90 THEN 'EXEMPLARY'
                WHEN v_performance_avg >= 75 THEN 'STABLE'
                WHEN v_performance_avg >= 40 THEN 'SATISFACTORY'
                ELSE 'ATTENTION_REQUIRED'
            END
        ),
        'subjects', COALESCE((
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
                    ) ORDER BY se.exam_date DESC) as history
                FROM public.exam_marks em
                JOIN public.subject_exams se ON em.subject_exam_id = se.id
                JOIN public.subjects sub ON se.subject_id = sub.id
                WHERE em.student_id = p_student_id AND (v_cycle_id IS NULL OR se.academic_cycle_id = v_cycle_id)
                GROUP BY sub.id, sub.name, sub.code, sub.department
                ORDER BY proficiency DESC
            ) s
        ), '[]'::jsonb)
    ) INTO v_results;

    RETURN v_results;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_student_academic_intel_v2(UUID, BIGINT) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Academic Intelligence v2 deployed with parent security isolation.' as status;
