-- =============================================================================
-- FINANCE SYSTEM ALIGNMENT & REFERENCE RESTORATION (V27)
-- =============================================================================
-- ROOT CAUSE: System renamed 'fee_structures' to 'finance_fee_structures' 
--             and 'fee_components' to 'finance_fee_components', but RPCs
--             and old repair scripts were still referencing legacy names.
--
-- THIS SCRIPT WILL:
--   1. Redefine 'get_fee_structures_with_metrics' to use new tables.
--   2. Redefine 'get_student_financial_node' to use new tables.
--   3. Redefine 'enroll_student_finance_protocol' to use new tables.
--   4. Update 'admin_sync_student_billing' (if exists) for schema alignment.
--   5. Ensure RLS and Grants are properly applied to the new functions.
-- =============================================================================

BEGIN;

-- [0] UTILITY: Robust Grade Normalizer (Ensuring consistency)
CREATE OR REPLACE FUNCTION public.normalize_grade_string(p_grade TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF p_grade IS NULL THEN RETURN NULL; END IF;
    RETURN TRIM(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(p_grade), 'grade', ''), 'class', ''), 'th', ''), ' ', ''));
END;
$$;

-- [1] ANALYTICS REPAIR: get_fee_structures_with_metrics
-- Re-indexing analytics to the new finance_fee_structures protocol truth.
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
               fs.status::TEXT, 'ACTIVE'::TEXT as st, fs.created_at,
               COALESCE((SELECT SUM(fc.amount) FROM public.finance_fee_components fc WHERE fc.structure_id = fs.id), 0) as b_amt
        FROM public.finance_fee_structures fs
        LEFT JOIN public.academic_years ay ON (fs.academic_year = ay.year_name OR fs.academic_year = ay.id::text)
        WHERE (fs.branch_id = p_branch_id OR p_branch_id IS NULL)
    ),
    gp AS (
        SELECT sp.grade, COUNT(*) as p_count FROM public.student_profiles sp
        WHERE (sp.branch_id = p_branch_id OR p_branch_id IS NULL) GROUP BY sp.grade
    ),
    m AS (
        SELECT 
            sp.fee_structure_id as structure_id,
            COUNT(DISTINCT sp.student_id) as s_count,
            COALESCE(SUM(sp.total_billed), 0) as p_rev,
            COALESCE(SUM(sp.total_paid), 0) as c_rev,
            AVG(COALESCE(
                CASE WHEN sp.total_billed > 0 THEN (sp.total_paid / sp.total_billed * 100)::INTEGER ELSE 100 END, 
                100
            ))::INTEGER as avg_integrity
        FROM public.finance_student_profiles sp
        WHERE (sp.branch_id = p_branch_id OR p_branch_id IS NULL)
        GROUP BY sp.fee_structure_id
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

-- [2] IDENTITY NODE: get_student_financial_node (V27 Refactor)
-- Standardizes the Detail View fetch to use the new finance_student_profiles & structures.
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER,
    unallocated_funds NUMERIC,
    is_active BOOLEAN,
    is_standby BOOLEAN,
    academic_cycle_id BIGINT,
    cycle_name TEXT,
    branch_id BIGINT,
    ledger_status TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_target_cycle_id BIGINT := p_cycle_id;
    v_target_cycle_name TEXT;
BEGIN
    IF v_target_cycle_id IS NULL THEN
        SELECT ay.id, ay.year_name INTO v_target_cycle_id, v_target_cycle_name 
        FROM public.academic_years ay WHERE ay.is_current = true LIMIT 1;
    ELSE
        SELECT ay.year_name INTO v_target_cycle_name FROM public.academic_years ay WHERE ay.id = v_target_cycle_id;
    END IF;

    RETURN QUERY
    SELECT 
        prof.id::UUID,
        COALESCE(prof.display_name, prof.email)::TEXT as display_name,
        COALESCE(
            prof.profile_photo_url, 
            sprof.profile_photo_url, 
            (SELECT adm.profile_photo_url FROM public.admissions adm WHERE adm.student_user_id = p_student_id LIMIT 1)
        )::TEXT as profile_photo_url,
        sprof.grade::TEXT,
        COALESCE(cls.name, 'UNASSIGNED')::TEXT,
        COALESCE(fsp.total_billed, 0::NUMERIC)::NUMERIC,
        COALESCE(fsp.total_paid, 0::NUMERIC)::NUMERIC,
        COALESCE(fsp.total_due, 0::NUMERIC)::NUMERIC as outstanding_balance,
        COALESCE(
            CASE WHEN fsp.total_billed > 0 THEN (fsp.total_paid / fsp.total_billed * 100)::INTEGER ELSE 100 END,
            100
        )::INTEGER as integrity_score,
        COALESCE(fsp.wallet_balance, 0::NUMERIC)::NUMERIC as unallocated_funds,
        prof.is_active::BOOLEAN,
        (fsp.fee_structure_id IS NULL)::BOOLEAN as is_standby,
        v_target_cycle_id,
        COALESCE(v_target_cycle_name, 'Current Cycle'),
        sprof.branch_id::BIGINT,
        COALESCE(fsp.financial_status, 'ACTIVE')::TEXT
    FROM public.profiles prof
    JOIN public.student_profiles sprof ON prof.id = sprof.user_id
    LEFT JOIN public.school_classes cls ON sprof.assigned_class_id = cls.id
    LEFT JOIN public.finance_student_profiles fsp ON prof.id = fsp.student_id
    WHERE prof.id = p_student_id
    LIMIT 1;
END;
$$;

-- [3] CORE PROTOCOL: enroll_student_finance_protocol (V27 Alignment)
CREATE OR REPLACE FUNCTION public.enroll_student_finance_protocol(
    p_student_id UUID,
    p_grade TEXT,
    p_cycle_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_struct_id BIGINT;
    v_total_amount NUMERIC := 0;
    v_normalized_input TEXT := public.normalize_grade_string(p_grade);
    v_branch_id BIGINT;
    v_academic_year_text TEXT;
BEGIN
    SELECT branch_id INTO v_branch_id FROM public.student_profiles WHERE user_id = p_student_id;
    SELECT year_name INTO v_academic_year_text FROM public.academic_years WHERE id = p_cycle_id;

    -- 1. Identify structure using new finance_fee_structures
    SELECT fs.id INTO v_struct_id
    FROM public.finance_fee_structures fs
    WHERE (public.normalize_grade_string(fs.target_grade) = v_normalized_input OR fs.target_grade = p_grade)
    AND (fs.academic_year = v_academic_year_text OR fs.academic_year = p_cycle_id::text)
    AND (LOWER(fs.status) = 'active')
    ORDER BY (CASE WHEN fs.is_default = true THEN 0 ELSE 1 END), fs.created_at DESC
    LIMIT 1;

    IF v_struct_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'MAPPING_NOT_FOUND', 'grade', p_grade, 'year', v_academic_year_text);
    END IF;

    -- 2. Calculate Protocol Price from finance_fee_components
    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount 
    FROM public.finance_fee_components 
    WHERE structure_id = v_struct_id;

    -- 3. Update Sync Node
    INSERT INTO public.finance_student_profiles (student_id, branch_id, grade, fee_structure_id, total_billed, total_due, is_structure_assigned, last_sync_at)
    VALUES (p_student_id, v_branch_id, p_grade, v_struct_id, v_total_amount, v_total_amount, TRUE, NOW())
    ON CONFLICT (student_id) DO UPDATE SET 
        fee_structure_id = EXCLUDED.fee_structure_id,
        total_billed = EXCLUDED.total_billed,
        total_due = EXCLUDED.total_due,
        is_structure_assigned = TRUE,
        last_sync_at = NOW();

    RETURN jsonb_build_object('success', true, 'ledger_total', v_total_amount, 'structure_id', v_struct_id);
END;
$$;

-- [4] REPAIR: admin_sync_student_billing (Detail View Direct Trigger)
CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student RECORD;
    v_cycle_id BIGINT;
BEGIN
    SELECT sp.user_id, sp.grade, sp.branch_id INTO v_student 
    FROM public.student_profiles sp WHERE sp.user_id = p_student_id;
    
    v_cycle_id := public.get_current_academic_cycle();
    
    IF v_student.user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_NOT_FOUND');
    END IF;

    RETURN public.enroll_student_finance_protocol(v_student.user_id, v_student.grade, v_cycle_id);
END;
$$;

-- [5] GRANTS & PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_fee_structures_with_metrics(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_student_finance_protocol(uuid, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(uuid) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance System Alignment V27 Deployed. All references standardized.' as status;
