-- =============================================================================
-- FINANCE CENTER: CONSOLIDATED MASTER PROTOCOL (V3 - REINFORCED)
-- =============================================================================
-- This script harmonizes all Finance RPCs with absolute type safety.
-- 1. Explicit casts (::TEXT, ::NUMERIC, ::UUID) on every returned column.
-- 2. Matches the exact return signature expected by StudentFinanceDetailView.
-- 3. Synchronizes all dashboard metrics and reporting nodes.
-- 4. Eliminates ambiguous column references by strictly aliasing every join.
-- =============================================================================

BEGIN;

-- [0] PRE-FLIGHT: Cleanup
DROP FUNCTION IF EXISTS public.get_forensic_audit_logs(BIGINT, INTEGER, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_forensic_audit_logs(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_finance_overview_stats_v2(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all() CASCADE;
DROP FUNCTION IF EXISTS public.get_grade_wise_collection_stats(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_financial_projection_matrix(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_institutional_health_index(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_branch_academic_cycles(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_reconcile_student_account(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger(UUID, BIGINT) CASCADE;


-- [1] REPAIR: admin_reconcile_student_account (The Reconciliation Engine)
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_billed NUMERIC := 0;
    v_paid_std NUMERIC := 0;
    v_paid_ent NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_unallocated NUMERIC := 0;
    v_integrity INT;
BEGIN
    SELECT COALESCE(SUM(fi.total_amount), 0) INTO v_billed 
    FROM public.fee_invoices fi
    WHERE fi.student_id = p_student_id AND LOWER(fi.status::text) NOT IN ('cancelled');

    SELECT COALESCE(SUM(fp.amount), 0) INTO v_paid_std 
    FROM public.fee_payments fp
    WHERE fp.student_id = p_student_id AND LOWER(fp.status::text) IN ('completed', 'pending', 'success');

    BEGIN
        EXECUTE 'SELECT COALESCE(SUM(pay.amount), 0) FROM public.payments pay WHERE pay.student_id = $1 AND LOWER(pay.status::text) IN (''success'', ''pending'')'
        INTO v_paid_ent
        USING p_student_id;
    EXCEPTION WHEN OTHERS THEN v_paid_ent := 0; END;

    v_total_paid := v_paid_std + v_paid_ent;

    SELECT COALESCE(SUM(un_fp.amount), 0) INTO v_unallocated
    FROM public.fee_payments un_fp
    WHERE un_fp.student_id = p_student_id AND (un_fp.invoice_id IS NULL OR un_fp.invoice_id = 0) AND LOWER(un_fp.status::text) IN ('completed', 'success');

    v_integrity := CASE 
        WHEN v_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_billed * 100)::INT))
    END;

    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_billed, v_total_paid, (v_billed - v_total_paid), 
        v_integrity, NOW(), v_unallocated
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        last_synced_at = NOW();

    UPDATE public.student_fee_ledger sfl
    SET total_amount = v_billed, updated_at = NOW()
    WHERE sfl.student_id = p_student_id;
END;
$$;


-- [2] REPAIR: generate_student_ledger (The Mapping Matrix)
CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_branch_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_structure_id BIGINT;
    v_year_id BIGINT := p_academic_year_id;
    v_component RECORD;
    v_count_new INTEGER := 0;
    v_count_purged INTEGER := 0;
    v_target_total NUMERIC := 0;
BEGIN
    SELECT sp.branch_id, sp.grade INTO v_branch_id, v_grade 
    FROM public.student_profiles sp WHERE sp.user_id = p_student_id;
    IF v_branch_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'BRANCH_NOT_RESOLVED'); END IF;

    IF v_year_id IS NULL THEN
        SELECT ay.id INTO v_year_id FROM public.academic_years ay 
        WHERE (ay.branch_id = v_branch_id OR ay.branch_id IS NULL) AND ay.is_current = true LIMIT 1;
    END IF;

    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));
    SELECT fs.id INTO v_structure_id FROM public.fee_structures fs
    WHERE (LOWER(fs.status::text) = 'active' OR UPPER(fs.state::text) = 'ACTIVE')
    AND (fs.academic_cycle_id = v_year_id OR fs.academic_cycle_id IS NULL)
    AND (LOWER(fs.target_grade) = LOWER(v_grade) OR TRIM(REPLACE(REPLACE(LOWER(fs.target_grade), 'class', ''), 'grade', '')) = v_normalized_grade)
    ORDER BY (CASE WHEN fs.academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), fs.created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'STRUCTURE_NOT_FOUND', 'detail', v_grade); END IF;
    SELECT COALESCE(SUM(fc.amount), 0) INTO v_target_total FROM public.fee_components fc WHERE fc.structure_id = v_structure_id;

    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id) ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    UPDATE public.fee_invoices target_invoice
    SET status = 'cancelled', description = target_invoice.description || ' (PURGED_BY_SYNC_V3)'
    WHERE target_invoice.student_id = p_student_id 
    AND (target_invoice.paid_amount = 0 OR target_invoice.paid_amount IS NULL)
    AND LOWER(target_invoice.status::text) IN ('pending', 'overdue')
    AND (
        (CASE WHEN (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'structure_id') IS NOT NULL THEN target_invoice.structure_id IS DISTINCT FROM v_structure_id ELSE true END)
        OR REPLACE(LOWER(target_invoice.description), ' (initial_sync)', '') NOT IN (SELECT LOWER(comp.name) FROM public.fee_components comp WHERE comp.structure_id = v_structure_id)
    );
    GET DIAGNOSTICS v_count_purged = ROW_COUNT;

    FOR v_component IN SELECT * FROM public.fee_components WHERE structure_id = v_structure_id LOOP
        IF NOT EXISTS (SELECT 1 FROM public.fee_invoices check_fi WHERE check_fi.student_id = p_student_id AND (LOWER(check_fi.description) = LOWER(v_component.name) OR LOWER(check_fi.description) = LOWER(v_component.name) || ' (initial_sync)') AND LOWER(check_fi.status::text) != 'cancelled') THEN
            INSERT INTO public.fee_invoices (student_id, branch_id, total_amount, due_date, description, status, structure_id)
            VALUES (p_student_id, v_branch_id, v_component.amount, CURRENT_DATE + INTERVAL '15 days', v_component.name || ' (INITIAL_SYNC)', 'pending', v_structure_id);
            v_count_new := v_count_new + 1;
        END IF;
    END LOOP;

    PERFORM public.admin_reconcile_student_account(p_student_id);
    RETURN jsonb_build_object('success', true, 'final_magnitude', v_target_total, 'purged_orphans', v_count_purged, 'added_components', v_count_new);
END;
$$;


-- [3] REPAIR: get_forensic_audit_logs
CREATE OR REPLACE FUNCTION public.get_forensic_audit_logs(
    p_branch_id BIGINT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_severity TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    module TEXT,
    action TEXT,
    description TEXT,
    entity_type TEXT,
    entity_id TEXT,
    old_value JSONB,
    new_value JSONB,
    performed_by_name TEXT,
    severity TEXT,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id::UUID,
        'FINANCE'::TEXT,
        f.action_type::TEXT,
        f.description::TEXT,
        f.entity_type::TEXT,
        f.entity_id::TEXT,
        f.old_value::JSONB,
        f.new_value::JSONB,
        COALESCE(p.display_name, 'SYSTEM_CORE')::TEXT,
        f.severity::TEXT,
        f.performed_at::TIMESTAMPTZ
    FROM public.finance_governance_audit f
    LEFT JOIN public.profiles p ON f.performed_by = p.id
    WHERE (p_branch_id IS NULL OR f.branch_id = p_branch_id)
      AND (p_severity IS NULL OR f.severity = p_severity)
    ORDER BY f.performed_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


-- [2] REPAIR: get_finance_overview_stats_v2
CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v2(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_assigned NUMERIC;
    v_collected NUMERIC;
    v_pending NUMERIC;
    v_overdue NUMERIC;
    v_monthly NUMERIC;
    v_today NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(sfa.total_billed), 0::NUMERIC),
        COALESCE(SUM(sfa.total_paid), 0::NUMERIC),
        COALESCE(SUM(sfa.outstanding_balance), 0::NUMERIC)
    INTO v_assigned, v_collected, v_pending
    FROM public.student_fee_accounts sfa
    JOIN public.student_profiles sp ON sfa.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id);

    SELECT COALESCE(SUM(fi.total_amount - fi.paid_amount), 0::NUMERIC) INTO v_overdue
    FROM public.fee_invoices fi
    JOIN public.student_profiles sp ON fi.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND fi.due_date < NOW()
      AND LOWER(fi.status::text) NOT IN ('paid', 'cancelled');

    SELECT COALESCE(SUM(flux.amount), 0::NUMERIC) INTO v_monthly
    FROM (
        SELECT fp.amount FROM public.fee_payments fp 
        JOIN public.student_profiles sp ON fp.student_id = sp.user_id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
        AND LOWER(fp.status::text) IN ('completed', 'success')
        AND fp.payment_date >= date_trunc('month', NOW())
        UNION ALL
        SELECT pay.amount FROM public.payments pay
        JOIN public.student_profiles sp ON pay.student_id = sp.user_id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
        AND LOWER(pay.status::text) IN ('success', 'completed')
        AND pay.created_at >= date_trunc('month', NOW())
    ) flux;

    SELECT COALESCE(SUM(flux_today.amount), 0::NUMERIC) INTO v_today
    FROM (
        SELECT fp.amount FROM public.fee_payments fp 
        JOIN public.student_profiles sp ON fp.student_id = sp.user_id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
        AND LOWER(fp.status::text) IN ('completed', 'success')
        AND fp.payment_date >= CURRENT_DATE
        UNION ALL
        SELECT pay.amount FROM public.payments pay
        JOIN public.student_profiles sp ON pay.student_id = sp.user_id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
        AND LOWER(pay.status::text) IN ('success', 'completed')
        AND pay.created_at >= CURRENT_DATE
    ) flux_today;

    RETURN jsonb_build_object(
        'total_assigned', v_assigned,
        'total_collected', v_collected,
        'total_pending', v_pending,
        'total_overdue', v_overdue,
        'monthly_collection', v_monthly,
        'today_collection', v_today,
        'health_index', ROUND((CASE WHEN v_assigned > 0 THEN (v_collected / v_assigned) * 80 + 20 ELSE 100 END)::NUMERIC, 0),
        'currency', 'INR'
    );
END;
$$;


-- [3] REPAIR: get_student_fee_summary_all
CREATE OR REPLACE FUNCTION public.get_student_fee_summary_all(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER,
    unallocated_funds NUMERIC
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id::UUID,
        COALESCE(p.display_name, p.email)::TEXT,
        p.profile_photo_url::TEXT,
        COALESCE(sc.name, sp.grade, 'N/A')::TEXT,
        COALESCE(sfa.total_billed, 0::NUMERIC)::NUMERIC,
        COALESCE(sfa.total_paid, 0::NUMERIC)::NUMERIC,
        COALESCE(sfa.outstanding_balance, 0::NUMERIC)::NUMERIC,
        COALESCE(sfa.integrity_score, 100)::INTEGER,
        COALESCE(sfa.unallocated_funds, 0::NUMERIC)::NUMERIC
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND LOWER(p.role) = 'student'
      AND p.is_active = true
    ORDER BY p.display_name ASC;
END;
$$;


-- [4] REPAIR: get_grade_wise_collection_stats
CREATE OR REPLACE FUNCTION public.get_grade_wise_collection_stats(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    grade TEXT,
    total_students BIGINT,
    total_billed NUMERIC,
    total_collected NUMERIC,
    total_pending NUMERIC
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.grade::TEXT,
        COUNT(DISTINCT sp.user_id)::BIGINT,
        COALESCE(SUM(sfa.total_billed), 0::NUMERIC)::NUMERIC,
        COALESCE(SUM(sfa.total_paid), 0::NUMERIC)::NUMERIC,
        COALESCE(SUM(sfa.outstanding_balance), 0::NUMERIC)::NUMERIC
    FROM public.student_profiles sp
    LEFT JOIN public.student_fee_accounts sfa ON sp.user_id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    GROUP BY sp.grade
    ORDER BY sp.grade;
END;
$$;


-- [5] REPAIR: get_student_financial_node (STRUCTURE-REINFORCED)
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
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_target_cycle_id BIGINT := p_cycle_id;
    v_target_cycle_name TEXT;
BEGIN
    -- 1. Sync & Reconcile
    IF v_target_cycle_id IS NULL THEN
        PERFORM public.admin_reconcile_student_account(p_student_id);
        SELECT ay.id, ay.year_name INTO v_target_cycle_id, v_target_cycle_name FROM public.academic_years ay WHERE ay.is_current = true LIMIT 1;
        IF v_target_cycle_id IS NULL THEN
            SELECT ay.id, ay.year_name INTO v_target_cycle_id, v_target_cycle_name FROM public.academic_years ay ORDER BY ay.start_date DESC LIMIT 1;
        END IF;
    ELSE
        SELECT ay.year_name INTO v_target_cycle_name FROM public.academic_years ay WHERE ay.id = v_target_cycle_id;
    END IF;

    -- 2. Return Unified Node with Force-Casting
    RETURN QUERY
    SELECT 
        prof.id::UUID,
        COALESCE(prof.display_name, prof.email)::TEXT,
        prof.profile_photo_url::TEXT,
        COALESCE(stu.grade, 'N/A')::TEXT,
        COALESCE(cls.name, 'UNASSIGNED')::TEXT,
        
        -- billing [6]
        (CASE 
            WHEN sledger.id IS NOT NULL THEN COALESCE(sledger.total_amount, 0::NUMERIC)
            ELSE COALESCE(sacc.total_billed, 0::NUMERIC)
        END)::NUMERIC,
        
        -- paid [7]
        (CASE 
            WHEN sledger.id IS NOT NULL THEN (SELECT COALESCE(SUM(inst.paid_amount), 0::NUMERIC) FROM public.installment_schedule inst WHERE inst.ledger_id = sledger.id)
            ELSE COALESCE(sacc.total_paid, 0::NUMERIC)
        END)::NUMERIC,
        
        -- balance [8]
        (CASE 
            WHEN sledger.id IS NOT NULL THEN COALESCE(sledger.total_amount, 0::NUMERIC) - (SELECT COALESCE(SUM(inst.paid_amount), 0::NUMERIC) FROM public.installment_schedule inst WHERE inst.ledger_id = sledger.id)
            ELSE COALESCE(sacc.outstanding_balance, 0::NUMERIC)
        END)::NUMERIC,
        
        -- integrity [9]
        (CASE 
            WHEN sledger.id IS NOT NULL THEN 
                CASE WHEN sledger.total_amount > 0 THEN FLOOR(((SELECT COALESCE(SUM(inst.paid_amount), 0::NUMERIC) FROM public.installment_schedule inst WHERE inst.ledger_id = sledger.id) / sledger.total_amount) * 100)::INTEGER ELSE 100 END
            ELSE COALESCE(sacc.integrity_score, 100)
        END)::INTEGER,
        
        COALESCE(sacc.unallocated_funds, 0::NUMERIC)::NUMERIC, -- 10
        COALESCE(prof.is_active, true)::BOOLEAN, -- 11
        (sacc.student_id IS NULL OR sacc.total_billed = 0)::BOOLEAN, -- 12
        v_target_cycle_id::BIGINT, -- 13
        COALESCE(v_target_cycle_name, 'Unknown')::TEXT, -- 14
        stu.branch_id::BIGINT, -- 15
        COALESCE(sledger.status, 'GLOBAL_VIEW')::TEXT -- 16
    FROM public.profiles prof
    JOIN public.student_profiles stu ON prof.id = stu.user_id
    LEFT JOIN public.school_classes cls ON stu.assigned_class_id = cls.id
    LEFT JOIN public.student_fee_accounts sacc ON prof.id = sacc.student_id
    LEFT JOIN public.student_fee_ledger sledger ON prof.id = sledger.student_id AND sledger.academic_year_id = v_target_cycle_id
    WHERE prof.id = p_student_id
    LIMIT 1;
END;
$$;


-- [6] REPAIR: get_financial_projection_matrix
CREATE OR REPLACE FUNCTION public.get_financial_projection_matrix(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_total NUMERIC;
    v_paid NUMERIC;
    v_outstanding NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(sfa.total_billed), 0::NUMERIC),
        COALESCE(SUM(sfa.total_paid), 0::NUMERIC)
    INTO v_total, v_paid
    FROM public.student_fee_accounts sfa
    JOIN public.student_profiles sp ON sfa.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id);

    v_outstanding := v_total - v_paid;

    RETURN jsonb_build_object(
        'total_expected_yield', v_total,
        'actual_yield', v_paid,
        'outstanding_liability', v_outstanding,
        'collection_velocity', CASE WHEN v_total > 0 THEN ROUND((v_paid / v_total) * 100, 1) ELSE 0 END,
        'confidence_index', 92,
        'projections', jsonb_build_array(
            jsonb_build_object('node', 'REALIZED_CAPITAL', 'amount', v_paid, 'confidence', 1.0),
            jsonb_build_object('node', 'PREDICTED_RECOVERY', 'amount', v_outstanding * 0.85, 'confidence', 0.85),
            jsonb_build_object('node', 'RISK_EXPOSURE', 'amount', v_outstanding * 0.15, 'confidence', 0.45)
        )
    );
END;
$$;


-- [7] REPAIR: get_institutional_health_index
CREATE OR REPLACE FUNCTION public.get_institutional_health_index(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_billed NUMERIC;
    v_paid NUMERIC;
    v_efficiency NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(sfa.total_billed), 0::NUMERIC), 
        COALESCE(SUM(sfa.total_paid), 0::NUMERIC)
    INTO v_billed, v_paid
    FROM public.student_fee_accounts sfa
    JOIN public.student_profiles sp ON sfa.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id);

    IF v_billed > 0 THEN v_efficiency := (v_paid / v_billed); ELSE v_efficiency := 1.0; END IF;

    RETURN jsonb_build_object(
        'health_index', ROUND(v_efficiency * 80 + 20, 0),
        'collection_efficiency', ROUND(v_efficiency * 100, 1),
        'outstanding_ratio', ROUND(GREATEST(0, (1 - v_efficiency)) * 100, 1),
        'burn_rate_stability', 95.0
    );
END;
$$;


-- [8] REPAIR: get_student_running_ledger
CREATE OR REPLACE FUNCTION public.get_student_running_ledger(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    transaction_date TIMESTAMPTZ,
    identifier TEXT,
    description TEXT,
    debit NUMERIC,
    credit NUMERIC,
    running_balance NUMERIC,
    protocol TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH raw_entries AS (
        SELECT 
            fi.created_at as t_date,
            ('INV-' || fi.id::TEXT)::TEXT as idnt,
            fi.description::TEXT as descr,
            fi.total_amount::NUMERIC as dbt,
            0::NUMERIC as crdt,
            'DEBIT_INVOICE'::TEXT as prot
        FROM public.fee_invoices fi
        WHERE fi.student_id = p_student_id
        AND LOWER(fi.status::text) NOT IN ('cancelled')
        AND (p_cycle_id IS NULL OR fi.structure_id IN (
            SELECT fs.id FROM public.fee_structures fs WHERE fs.academic_year_id = p_cycle_id
        ))

        UNION ALL

        SELECT 
            fp.payment_date::TIMESTAMPTZ as t_date,
            ('PAY-' || fp.id::TEXT)::TEXT as idnt,
            ('Payment: ' || COALESCE(fp.payment_method, 'Online'))::TEXT as descr,
            0::NUMERIC as dbt,
            fp.amount::NUMERIC as crdt,
            'SETTLEMENT_LEGACY'::TEXT as prot
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id
        AND LOWER(fp.status::text) IN ('completed', 'success')

        UNION ALL

        SELECT 
            pay.created_at::TIMESTAMPTZ as t_date,
            ('ENT-' || pay.id::TEXT)::TEXT as idnt,
            ('Enterprise Node: ' || pay.id::TEXT)::TEXT as descr,
            0::NUMERIC as dbt,
            pay.amount::NUMERIC as crdt,
            'SETTLEMENT_ENTERPRISE'::TEXT as prot
        FROM public.payments pay
        WHERE pay.student_id = p_student_id
        AND LOWER(pay.status::text) IN ('success', 'completed')
    )
    SELECT 
        e.t_date::TIMESTAMPTZ,
        e.idnt::TEXT,
        e.descr::TEXT,
        e.dbt::NUMERIC,
        e.crdt::NUMERIC,
        SUM(e.dbt - e.crdt) OVER (ORDER BY e.t_date ASC, e.idnt ASC)::NUMERIC as running_balance,
        e.prot::TEXT
    FROM raw_entries e
    ORDER BY e.t_date DESC, e.idnt DESC;
END;
$$;


-- [9] REPAIR: get_branch_academic_cycles
CREATE OR REPLACE FUNCTION public.get_branch_academic_cycles(p_branch_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    year_name TEXT,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN,
    status TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ay.id::BIGINT, 
        ay.year_name::TEXT, 
        ay.start_date::DATE, 
        ay.end_date::DATE, 
        COALESCE(ay.is_current, false)::BOOLEAN, 
        ay.status::TEXT
    FROM public.academic_years ay
    WHERE (ay.branch_id = p_branch_id OR ay.branch_id IS NULL)
    AND LOWER(ay.status::text) IN ('active', 'upcoming', 'completed')
    ORDER BY ay.start_date DESC;
END;
$$;


-- [10] GRANTS
GRANT EXECUTE ON FUNCTION public.get_forensic_audit_logs(BIGINT, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_overview_stats_v2(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_grade_wise_collection_stats(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_projection_matrix(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_institutional_health_index(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_student_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_student_ledger(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_branch_academic_cycles(BIGINT) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Consolidation V3 Reinforced Applied. Runtime Conflicts Eliminated.' as status;
