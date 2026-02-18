-- =============================================================================
-- [FINANCE] MASTER CONTROL ENHANCEMENT: FEE STRUCTURE METRICS (V19.2)
-- Objective: Fix the ₹0 amounts by ensuring base template totals are returned.
--            1. Return 'base_amount' (Sum of components for 1 student).
--            2. Return 'projected_revenue' (Total expected from all assigned students).
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
            fs.target_grade::TEXT,
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
        sb.target_grade,
        sb.currency,
        sb.status,
        sb.state,
        sb.created_at,
        sb.components_json,
        COALESCE(m.s_count, 0::BIGINT) as student_count,
        sb.b_amount as base_amount,
        CASE 
            WHEN COALESCE(m.s_count, 0) > 0 THEN m.p_rev 
            ELSE 0 -- Projection is 0 if no students, but base_amount is available for the card
        END as projected_revenue,
        COALESCE(m.c_rev, 0::NUMERIC) as collected_revenue,
        COALESCE(m.avg_integrity, 100)::INTEGER as integrity_score
    FROM structure_base sb
    LEFT JOIN metrics m ON sb.id = m.structure_id
    ORDER BY sb.created_at DESC;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Fee Structure Metrics V19.2 Deployed.' as status;
