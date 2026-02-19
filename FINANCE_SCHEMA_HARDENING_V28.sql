-- =============================================================================
-- FINANCE SCHEMA HARDENING & ATTRIBUTE SYNC (V28)
-- =============================================================================
-- ROOT CAUSE: Migration from legacy 'fee_components' to 'finance_fee_components'
--             left some columns named as 'fee_structure_id' instead of 
--             the standardized 'structure_id', causing RPC failures.
--
-- THIS SCRIPT WILL:
--   1. Rename columns in 'finance_fee_components' for standardization.
--   2. Rename columns in 'finance_fee_structures' if legacy names exist.
--   3. Apply the standardized 'get_fee_structures_with_metrics' RPC.
-- =============================================================================

BEGIN;

-- [1] ATTRIBUTE STANDARDIZATION
DO $$ 
BEGIN
    -- A. finance_fee_components: fee_structure_id -> structure_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'fee_structure_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'structure_id') THEN
            ALTER TABLE public.finance_fee_components RENAME COLUMN fee_structure_id TO structure_id;
        END IF;
    END IF;

    -- B. finance_fee_components: Amount standardization (Ensure numeric)
    -- (Safety check: if column exists, we don't need to do much else here)

    -- C. student_fee_assignments: fee_structure_id -> structure_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_assignments' AND column_name = 'fee_structure_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_assignments' AND column_name = 'structure_id') THEN
            ALTER TABLE public.student_fee_assignments RENAME COLUMN fee_structure_id TO structure_id;
        END IF;
    END IF;

    -- D. finance_fee_structures: academic_year_id -> academic_cycle_id (Standardizing naming)
    -- Note: Many RPCs use academic_cycle_id.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_structures' AND column_name = 'academic_cycle_id') THEN
        -- Already renamed or exists.
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_structures' AND column_name = 'academic_year_id') THEN
         ALTER TABLE public.finance_fee_structures RENAME COLUMN academic_year_id TO academic_cycle_id;
    END IF;

END $$;

-- [2] REBUILD ANALYTICS RPC (Standardized and Robust)
CREATE OR REPLACE FUNCTION public.get_fee_structures_with_metrics(p_branch_id BIGINT)
RETURNS TABLE (
    id BIGINT, name TEXT, academic_year TEXT, target_grade TEXT, currency TEXT, 
    status TEXT, state TEXT, created_at TIMESTAMPTZ, components JSONB,
    student_count BIGINT, potential_count BIGINT, base_amount NUMERIC,
    projected_revenue NUMERIC, collected_revenue NUMERIC, integrity_score INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH sb AS (
        -- Select base structures
        SELECT fs.id, fs.name::TEXT, 
               COALESCE(ay.year_name, fs.academic_year::TEXT)::TEXT as ay_name, 
               fs.target_grade::TEXT as t_grade, COALESCE(fs.currency, 'INR')::TEXT as curr,
               fs.status::TEXT, COALESCE(fs.state, 'ACTIVE')::TEXT as st, fs.created_at,
               COALESCE((SELECT SUM(COALESCE(fc.amount, 0)) FROM public.finance_fee_components fc WHERE fc.structure_id = fs.id), 0) as b_amt
        FROM public.finance_fee_structures fs
        LEFT JOIN public.academic_years ay ON (fs.academic_year = ay.year_name OR fs.academic_year = ay.id::text)
        WHERE (fs.branch_id = p_branch_id OR p_branch_id IS NULL)
    ),
    gp AS (
        -- Potential students per grade
        SELECT sp.grade, COUNT(*) as p_count FROM public.student_profiles sp
        WHERE (sp.branch_id = p_branch_id OR p_branch_id IS NULL) GROUP BY sp.grade
    ),
    m AS (
        -- Assigned metrics from the sync node
        SELECT 
            fsp.fee_structure_id as structure_id,
            COUNT(DISTINCT fsp.student_id) as s_count,
            COALESCE(SUM(fsp.total_billed), 0) as p_rev,
            COALESCE(SUM(fsp.total_paid), 0) as c_rev,
            AVG(COALESCE(
                CASE WHEN fsp.total_billed > 0 THEN (fsp.total_paid / fsp.total_billed * 100)::INTEGER ELSE 100 END, 
                100
            ))::INTEGER as avg_integrity
        FROM public.finance_student_profiles fsp
        WHERE (fsp.branch_id = p_branch_id OR p_branch_id IS NULL)
        GROUP BY fsp.fee_structure_id
    )
    SELECT 
        sb.id, sb.name, sb.ay_name, sb.t_grade, sb.curr, sb.status, sb.st, sb.created_at,
        NULL::JSONB,
        COALESCE(m.s_count, 0::BIGINT),
        COALESCE(gp.p_count, 0::BIGINT),
        sb.b_amt,
        COALESCE(m.p_rev, 0::NUMERIC), 
        COALESCE(m.c_rev, 0::NUMERIC),
        COALESCE(m.avg_integrity, 100)::INTEGER
    FROM sb
    LEFT JOIN m ON sb.id = m.structure_id
    LEFT JOIN gp ON public.normalize_grade_string(sb.t_grade) = public.normalize_grade_string(gp.grade)
    ORDER BY sb.created_at DESC;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Finance Schema Hardening V28 applied. Column structure_id standardized.' as status;
