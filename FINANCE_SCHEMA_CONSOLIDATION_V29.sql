-- =============================================================================
-- FINANCE SCHEMA CONSOLIDATION & ATTRIBUTE STANDARDIZATION (V29)
-- =============================================================================
-- ROOT CAUSE: Multi-version attribute desync. 
--             - Column 'fc.structure_id' vs 'fc.fee_structure_id'
--             - Table 'fee_components' vs 'finance_fee_components'
--             - Column 'academic_cycle_id' vs 'academic_year'
-- =============================================================================

BEGIN;

-- [0] UTILITY: Robust Grade Normalizer
CREATE OR REPLACE FUNCTION public.normalize_grade_string(p_grade TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF p_grade IS NULL THEN RETURN NULL; END IF;
    RETURN TRIM(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(p_grade), 'grade', ''), 'class', ''), 'th', ''), ' ', ''));
END;
$$;

-- [1] TABLE RENAMING (Standardizing on 'finance_' prefix)
DO $$
BEGIN
    -- Rename fee_structures -> finance_fee_structures
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fee_structures') THEN
        IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_fee_structures') THEN
            ALTER TABLE public.fee_structures RENAME TO finance_fee_structures;
        END IF;
    END IF;

    -- Rename fee_components -> finance_fee_components
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fee_components') THEN
        IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_fee_components') THEN
            ALTER TABLE public.fee_components RENAME TO finance_fee_components;
        END IF;
    END IF;
END $$;

-- [2] COLUMN STANDARDIZATION
DO $$
BEGIN
    -- A. Standardize finance_fee_components: fee_structure_id -> structure_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'fee_structure_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'structure_id') THEN
            ALTER TABLE public.finance_fee_components RENAME COLUMN fee_structure_id TO structure_id;
        END IF;
    END IF;

    -- B. Standardize finance_fee_structures: Add academic_cycle_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_structures' AND column_name = 'academic_cycle_id') THEN
        ALTER TABLE public.finance_fee_structures ADD COLUMN academic_cycle_id BIGINT;
        -- Attempt to backfill from academic_year if it's numeric
        UPDATE public.finance_fee_structures SET academic_cycle_id = academic_year::bigint 
        WHERE academic_year ~ '^[0-9]+$';
    END IF;

    -- C. Standardize student_fee_assignments: fee_structure_id -> structure_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_assignments' AND column_name = 'fee_structure_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_assignments' AND column_name = 'structure_id') THEN
            ALTER TABLE public.student_fee_assignments RENAME COLUMN fee_structure_id TO structure_id;
        END IF;
    END IF;
END $$;

-- [3] REBUILD CRITICAL RPCs (Using Unified Schema)

-- 1. Analytics & Metrics
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
        SELECT fs.id, fs.name::TEXT, 
               COALESCE(ay.year_name, fs.academic_year::TEXT)::TEXT as ay_name, 
               fs.target_grade::TEXT as t_grade, COALESCE(fs.currency, 'INR')::TEXT as curr,
               fs.status::TEXT, COALESCE(fs.state, 'ACTIVE')::TEXT as st, fs.created_at,
               COALESCE((SELECT SUM(fc.amount) FROM public.finance_fee_components fc WHERE fc.structure_id = fs.id), 0) as b_amt
        FROM public.finance_fee_structures fs
        LEFT JOIN public.academic_years ay ON (fs.academic_cycle_id = ay.id OR fs.academic_year = ay.year_name)
        WHERE (fs.branch_id = p_branch_id OR p_branch_id IS NULL)
    ),
    gp AS (
        SELECT sp.grade, COUNT(*) as p_count FROM public.student_profiles sp
        WHERE (sp.branch_id = p_branch_id OR p_branch_id IS NULL) GROUP BY sp.grade
    ),
    m AS (
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

-- 2. Stats & Overview
CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v3(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_assigned numeric;
    v_total_collected numeric;
    v_total_pending numeric;
    v_total_overdue numeric;
    v_monthly_collection numeric;
    v_today_collection numeric;
BEGIN
    -- Totals from synced profiles
    SELECT 
        COALESCE(SUM(total_billed), 0),
        COALESCE(SUM(total_paid), 0),
        COALESCE(SUM(total_due), 0)
    INTO v_total_assigned, v_total_collected, v_total_pending
    FROM public.finance_student_profiles
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- Overdue (approximate from profile due)
    v_total_overdue := v_total_pending; -- Standardized fallback

    -- Today's collection
    SELECT COALESCE(SUM(amount), 0) INTO v_today_collection
    FROM public.fee_payments
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND payment_date::date = CURRENT_DATE;

    -- Monthly collection
    SELECT COALESCE(SUM(amount), 0) INTO v_monthly_collection
    FROM public.fee_payments
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND payment_date >= date_trunc('month', CURRENT_DATE);

    RETURN jsonb_build_object(
        'total_assigned', v_total_assigned,
        'total_collected', v_total_collected,
        'total_pending', v_total_pending,
        'total_overdue', v_total_overdue,
        'today_collection', v_today_collection,
        'monthly_collection', v_monthly_collection,
        'currency', 'INR'
    );
END;
$$;

-- [4] GRANTS
GRANT EXECUTE ON FUNCTION public.get_fee_structures_with_metrics(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_overview_stats_v3(bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance System Consolidated (V29). Use this as the Master Source.' as status;
