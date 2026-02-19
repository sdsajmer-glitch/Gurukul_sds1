-- =============================================================================
-- [FINANCE] MASTER CONTROL ENHANCEMENT: ADVANCED FEE METRICS & ORCHESTRATION (V20)
-- Objective: 1. Fix 'Student 0' by providing 'Potential Count' context.
--            2. Enhance metrics to include collection efficiency per structure.
--            3. Add Bulk Sync capability for grade-wise assignments.
-- =============================================================================

BEGIN;

-- 1. ENHANCED RPC: get_fee_structures_with_metrics
CREATE OR REPLACE FUNCTION public.get_fee_structures_with_metrics(p_branch_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    academic_year TEXT,
    target_grade TEXT,
    currency TEXT,
    status TEXT,
    state TEXT,
    created_at TIMESTAMPTZ,
    components JSONB,
    student_count BIGINT,        -- Assigned students
    potential_count BIGINT,      -- Total students in grade
    base_amount NUMERIC,
    projected_revenue NUMERIC,
    collected_revenue NUMERIC,
    integrity_score INTEGER
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH structure_base AS (
        SELECT 
            fs.id,
            fs.name::TEXT,
            COALESCE(ay.year_name, fs.academic_year::TEXT, fs.academic_cycle_id::TEXT)::TEXT as academic_year,
            fs.target_grade::TEXT as t_grade,
            COALESCE(fs.currency, 'INR')::TEXT as currency,
            fs.status::TEXT,
            COALESCE(fs.state, 'DRAFT')::TEXT as state,
            fs.created_at,
            (
                SELECT jsonb_agg(comp.*) 
                FROM public.fee_components comp 
                WHERE comp.structure_id = fs.id
            ) as components_json,
            COALESCE((
                SELECT SUM(amount) 
                FROM public.fee_components comp 
                WHERE comp.structure_id = fs.id
            ), 0) as b_amount
        FROM public.fee_structures fs
        LEFT JOIN public.academic_years ay ON fs.academic_cycle_id = ay.id
        WHERE (fs.branch_id = p_branch_id OR p_branch_id IS NULL)
    ),
    grade_potential AS (
        -- Count total students in each grade for this branch
        SELECT 
            sp.grade,
            COUNT(*) as p_count
        FROM public.student_profiles sp
        WHERE (sp.branch_id = p_branch_id OR p_branch_id IS NULL)
        GROUP BY sp.grade
    ),
    metrics AS (
        SELECT 
            sfa.structure_id,
            COUNT(DISTINCT sfa.student_id) as s_count,
            COALESCE(SUM(sacc.total_billed), 0) as p_rev,
            COALESCE(SUM(sacc.total_paid), 0) as c_rev,
            AVG(COALESCE(sacc.integrity_score, 100))::INTEGER as avg_integrity
        FROM public.student_fee_assignments sfa
        LEFT JOIN public.student_fee_accounts sacc ON sfa.student_id = sacc.student_id
        GROUP BY sfa.structure_id
    )
    SELECT 
        sb.id,
        sb.name,
        sb.academic_year,
        sb.t_grade as target_grade,
        sb.currency,
        sb.status,
        sb.state,
        sb.created_at,
        sb.components_json,
        COALESCE(m.s_count, 0::BIGINT) as student_count,
        COALESCE(gp.p_count, 0::BIGINT) as potential_count,
        sb.b_amount as base_amount,
        CASE 
            WHEN COALESCE(m.s_count, 0) > 0 THEN m.p_rev 
            ELSE 0 
        END as projected_revenue,
        COALESCE(m.c_rev, 0::NUMERIC) as collected_revenue,
        COALESCE(m.avg_integrity, 100)::INTEGER as integrity_score
    FROM structure_base sb
    LEFT JOIN metrics m ON sb.id = m.structure_id
    LEFT JOIN grade_potential gp ON sb.t_grade = gp.grade
    ORDER BY sb.created_at DESC;
END;
$$;

-- 2. NEW UTILITY: bulk_sync_grade_fee_structure
-- Purpose: Mass assign all students in a grade to a specific fee structure.
CREATE OR REPLACE FUNCTION public.bulk_sync_grade_fee_structure(
    p_structure_id BIGINT,
    p_branch_id BIGINT
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
    v_target_grade TEXT;
    v_student_id UUID;
    v_count INT := 0;
BEGIN
    -- 1. Get Target Grade
    SELECT target_grade INTO v_target_grade FROM public.fee_structures WHERE id = p_structure_id;
    
    IF v_target_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Structure not found.');
    END IF;

    -- 2. Iterate through students in that grade who are NOT yet assigned to this specific structure
    -- Or we can force overwrite. Let's force overwrite if the structure is Active.
    FOR v_student_id IN 
        SELECT user_id FROM public.student_profiles 
        WHERE grade = v_target_grade AND (branch_id = p_branch_id OR p_branch_id IS NULL)
    LOOP
        -- Re-use the existing logic for ledger generation
        -- This will create the assignment and initial invoices
        PERFORM public.generate_student_ledger_for_student(v_student_id);
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'students_synced', v_count,
        'target_grade', v_target_grade
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Advanced Fee Metrics V20 deployed.' as status;
