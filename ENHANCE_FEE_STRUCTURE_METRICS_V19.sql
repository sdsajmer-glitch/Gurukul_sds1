-- =============================================================================
-- [FINANCE] MASTER CONTROL ENHANCEMENT: FEE STRUCTURE METRICS (V19.1)
-- Objective: Enhance the "Institutional Fee Structures" module with real-time metrics.
--            1. Return Student Count per structure.
--            2. Return Real Displacement (Projected Revenue).
--            3. Return Collection Progress for that structure.
-- =============================================================================

BEGIN;

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
    student_count BIGINT,
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
            COALESCE(ay.year_name, fs.academic_cycle_id::TEXT)::TEXT as academic_year,
            fs.target_grade::TEXT,
            'INR'::TEXT as currency, -- Fallback to INR unless defined in fs
            fs.status::TEXT,
            COALESCE(fs.state, 'DRAFT')::TEXT as state,
            fs.created_at,
            (
                SELECT jsonb_agg(comp.*) 
                FROM public.fee_components comp 
                WHERE comp.structure_id = fs.id
            ) as components
        FROM public.fee_structures fs
        LEFT JOIN public.academic_years ay ON fs.academic_cycle_id = ay.id
        WHERE (fs.branch_id = p_branch_id OR p_branch_id IS NULL)
    ),
    metrics AS (
        SELECT 
            sfa.structure_id,
            COUNT(DISTINCT sfa.student_id) as s_count,
            COALESCE(SUM(sacc.total_billed), 0) as p_rev,
            COALESCE(SUM(sacc.total_paid), 0) as c_rev,
            AVG(sacc.integrity_score)::INTEGER as avg_integrity
        FROM public.student_fee_assignments sfa
        LEFT JOIN public.student_fee_accounts sacc ON sfa.student_id = sacc.student_id
        GROUP BY sfa.structure_id
    )
    SELECT 
        sb.id,
        sb.name,
        sb.academic_year,
        sb.target_grade,
        sb.currency,
        sb.status,
        sb.state,
        sb.created_at,
        sb.components,
        COALESCE(m.s_count, 0::BIGINT) as student_count,
        COALESCE(m.p_rev, (SELECT SUM(amount) FROM public.fee_components WHERE structure_id = sb.id) * COALESCE(m.s_count, 0)) as projected_revenue,
        COALESCE(m.c_rev, 0::NUMERIC) as collected_revenue,
        COALESCE(m.avg_integrity, 100)::INTEGER as integrity_score
    FROM structure_base sb
    LEFT JOIN metrics m ON sb.id = m.structure_id
    ORDER BY sb.created_at DESC;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Fee Structure Metrics V19.1 Deployed.' as status;
