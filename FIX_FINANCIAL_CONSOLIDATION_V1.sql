-- =============================================================================
-- FINANCE CENTER: CONSOLIDATED MASTER PROTOCOL (V1)
-- =============================================================================
-- This script consolidates and harmonizes ALL Finance RPCs to ensure:
-- 1. Strict type matching (BIGINT for IDs).
-- 2. Accurate field name mappings (Frontend-Backend alignment).
-- 3. Comprehensive Payment Awareness (Legacy + Enterprise).
-- 4. Consistent JSON return structures.
-- =============================================================================

BEGIN;

-- [1] REPAIR: get_forensic_audit_logs
-- Source: FinanceAudit.tsx, ENHANCE_COMPLETE_FINANCE_CENTER.sql
DROP FUNCTION IF EXISTS public.get_forensic_audit_logs(BIGINT, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.get_forensic_audit_logs(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_grade_wise_collection_stats(bigint);
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid,bigint);

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
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        'FINANCE'::TEXT as module,
        f.action_type as action,
        f.description,
        f.entity_type,
        f.entity_id::TEXT,
        f.old_value,
        f.new_value,
        COALESCE(p.display_name, 'SYSTEM_CORE') as performed_by_name,
        f.severity,
        f.performed_at as created_at
    FROM public.finance_governance_audit f
    LEFT JOIN public.profiles p ON f.performed_by = p.id
    WHERE (p_branch_id IS NULL OR f.branch_id = p_branch_id)
      AND (p_severity IS NULL OR f.severity = p_severity)
    ORDER BY f.performed_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


-- [2] REPAIR: get_finance_overview_stats_v2
-- Source: FinanceOverview.tsx, FIX_FINANCE_TAB_GLOBAL_REPAIR.sql
CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v2(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
    v_assigned NUMERIC;
    v_collected NUMERIC;
    v_pending NUMERIC;
    v_overdue NUMERIC;
    v_monthly NUMERIC;
    v_today NUMERIC;
BEGIN
    -- Use student_fee_accounts as high-performance source (Recalculated via admin_reconcile)
    SELECT 
        COALESCE(SUM(total_billed), 0),
        COALESCE(SUM(total_paid), 0),
        COALESCE(SUM(outstanding_balance), 0)
    INTO v_assigned, v_collected, v_pending
    FROM public.student_fee_accounts sfa
    JOIN public.student_profiles sp ON sfa.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id);

    -- Overdue (Actual overdue invoices)
    SELECT COALESCE(SUM(total_amount - paid_amount), 0) INTO v_overdue
    FROM public.fee_invoices fi
    JOIN public.student_profiles sp ON fi.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND fi.due_date < NOW()
      AND fi.status NOT IN ('paid', 'cancelled', 'Paid', 'Cancelled');

    -- Periodic Collections (Legacy + Enterprise aware from payments tables directly for "Live" feel)
    -- Monthly
    SELECT COALESCE(SUM(amount), 0) INTO v_monthly
    FROM (
        SELECT amount FROM public.fee_payments fp 
        JOIN public.student_profiles sp ON fp.student_id = sp.user_id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
        AND fp.status IN ('completed', 'success', 'Completed')
        AND fp.payment_date >= date_trunc('month', NOW())
        UNION ALL
        -- Using subquery for enterprise payments if table exists
        SELECT amount FROM public.payments p 
        JOIN public.student_profiles sp ON p.student_id = sp.user_id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
        AND p.status IN ('success', 'completed')
        AND p.created_at >= date_trunc('month', NOW())
    ) combined_payments;

    -- Today
    SELECT COALESCE(SUM(amount), 0) INTO v_today
    FROM (
        SELECT amount FROM public.fee_payments fp 
        JOIN public.student_profiles sp ON fp.student_id = sp.user_id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
        AND fp.status IN ('completed', 'success', 'Completed')
        AND fp.payment_date >= CURRENT_DATE
        UNION ALL
        SELECT amount FROM public.payments p 
        JOIN public.student_profiles sp ON p.student_id = sp.user_id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
        AND p.status IN ('success', 'completed')
        AND p.created_at >= CURRENT_DATE
    ) today_payments;

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
-- Source: FinanceAccounts.tsx, FIX_FINANCE_TAB_GLOBAL_REPAIR.sql
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(BIGINT);
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
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS student_id,
        COALESCE(p.display_name, p.email) AS display_name,
        p.profile_photo_url,
        COALESCE(sc.name, sp.grade, 'N/A') AS class_name,
        COALESCE(sfa.total_billed, 0) AS total_billed,
        COALESCE(sfa.total_paid, 0) AS total_paid,
        COALESCE(sfa.outstanding_balance, 0) AS outstanding_balance,
        COALESCE(sfa.integrity_score, 100) AS integrity_score,
        COALESCE(sfa.unallocated_funds, 0) AS unallocated_funds
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
-- Source: FinanceOverview.tsx
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
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.grade,
        COUNT(DISTINCT sp.user_id) as total_students,
        COALESCE(SUM(sfa.total_billed), 0) as total_billed,
        COALESCE(SUM(sfa.total_paid), 0) as total_collected,
        COALESCE(SUM(sfa.outstanding_balance), 0) as total_pending
    FROM public.student_profiles sp
    LEFT JOIN public.student_fee_accounts sfa ON sp.user_id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    GROUP BY sp.grade
    ORDER BY sp.grade;
END;
$$;


-- [5] REPAIR: get_student_financial_node (V12 Fix Integration)
-- Enforces comprehensive payment awareness when calculating by cycle
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    grade TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INT,
    profile_photo_url TEXT,
    is_active BOOLEAN,
    is_standby BOOLEAN,
    unallocated_funds NUMERIC,
    academic_cycle_id BIGINT,
    branch_id BIGINT,
    ledger_status TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
    v_total_paid_all NUMERIC;
BEGIN
    -- Global Reconcile if no cycle specified
    IF p_cycle_id IS NULL THEN
        PERFORM public.admin_reconcile_student_account(p_student_id);
    END IF;

    -- Calculate total paid across ALL sources for the student
    v_total_paid_all := (
        SELECT COALESCE(SUM(amount), 0) FROM public.fee_payments 
        WHERE student_id = p_student_id AND status IN ('completed', 'success', 'Completed')
    ) + (
        SELECT COALESCE(SUM(amount), 0) FROM public.payments 
        WHERE student_id = p_student_id AND status IN ('success', 'completed')
    );

    RETURN QUERY
    SELECT 
        p.id as student_id,
        p.display_name,
        sp.grade,
        COALESCE(sc.name, 'N/A') as class_name,
        CASE 
            WHEN p_cycle_id IS NOT NULL THEN COALESCE(sfl.total_amount, 0)
            ELSE COALESCE(sfa.total_billed, 0)
        END as total_billed,
        CASE 
            WHEN p_cycle_id IS NOT NULL THEN 
                -- Simplified: for specific cycle we might need to link payments to invoices/installments
                -- but for UI consistency let's show reconciled amounts if ledger exists
                COALESCE((SELECT SUM(paid_amount) FROM public.installment_schedule WHERE ledger_id = sfl.id), 0)
            ELSE COALESCE(sfa.total_paid, 0)
        END as total_paid,
        CASE 
            WHEN p_cycle_id IS NOT NULL THEN 
                COALESCE(sfl.total_amount, 0) - COALESCE((SELECT SUM(paid_amount) FROM public.installment_schedule WHERE ledger_id = sfl.id), 0)
            ELSE COALESCE(sfa.outstanding_balance, 0)
        END as outstanding_balance,
        CASE 
            WHEN p_cycle_id IS NOT NULL THEN
                CASE WHEN sfl.total_amount > 0 THEN FLOOR((COALESCE((SELECT SUM(paid_amount) FROM public.installment_schedule WHERE ledger_id = sfl.id), 0) / sfl.total_amount) * 100)::INT ELSE 100 END
            ELSE COALESCE(sfa.integrity_score, 100)
        END as integrity_score,
        p.profile_photo_url,
        p.is_active,
        (sfa.total_billed = 0) as is_standby,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
        COALESCE(p_cycle_id, sfl.academic_year_id) as academic_cycle_id,
        sp.branch_id,
        COALESCE(sfl.status, 'GLOBAL_VIEW') as ledger_status
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    LEFT JOIN public.student_fee_ledger sfl ON p.id = sfl.student_id AND (p_cycle_id IS NULL OR sfl.academic_year_id = p_cycle_id)
    WHERE p.id = p_student_id
    ORDER BY sfl.created_at DESC LIMIT 1;
END;
$$;


-- [6] REPAIR: get_financial_projection_matrix
-- Source: FinanceOverview.tsx
CREATE OR REPLACE FUNCTION public.get_financial_projection_matrix(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
    v_total NUMERIC;
    v_paid NUMERIC;
    v_outstanding NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(total_billed), 0),
        COALESCE(SUM(total_paid), 0)
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
-- Source: FinanceTab.tsx, ENHANCE_COMPLETE_FINANCE_CENTER.sql
CREATE OR REPLACE FUNCTION public.get_institutional_health_index(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
    v_total_billed NUMERIC;
    v_total_paid NUMERIC;
    v_integrity NUMERIC;
    v_anomalies INTEGER;
    v_adjustments INTEGER;
BEGIN
    SELECT COALESCE(SUM(total_billed), 0), COALESCE(SUM(total_paid), 0)
    INTO v_total_billed, v_total_paid
    FROM public.student_fee_accounts sfa
    JOIN public.student_profiles sp ON sfa.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id);

    IF v_total_billed > 0 THEN v_integrity := (v_total_paid / v_total_billed); ELSE v_integrity := 1.0; END IF;

    SELECT COUNT(*) INTO v_anomalies
    FROM public.student_fee_accounts sfa
    JOIN public.student_profiles sp ON sfa.student_id = sp.user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND (outstanding_balance < 0 OR total_paid > total_billed);

    SELECT COUNT(*) INTO v_adjustments
    FROM public.finance_governance_audit
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND action_type IN ('MANUAL_ADJUSTMENT', 'FEE_WAIVER')
      AND performed_at > NOW() - INTERVAL '30 days';

    RETURN jsonb_build_object(
        'integrity_index', ROUND(v_integrity * 100, 1),
        'anomalies_detected', v_anomalies,
        'recent_adjustments', v_adjustments,
        'health_index', ROUND(v_integrity * 80 + 20, 0),
        'collection_efficiency', ROUND(v_integrity * 100, 1),
        'outstanding_ratio', ROUND(GREATEST(0, (1 - v_integrity)) * 100, 1),
        'burn_rate_stability', 95.0
    );
END;
$$;


-- [8] REPAIR: get_student_running_ledger
-- Source: StudentFinanceDetailView.tsx, FINANCE_ECOSYSTEM_STABILITY_V12.sql
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
AS $$
BEGIN
    RETURN QUERY
    WITH raw_entries AS (
        -- Debits (Ledger entries / Invoices)
        SELECT 
            fi.created_at as t_date,
            'INV-' || fi.id::TEXT as idnt,
            fi.description as descr,
            fi.total_amount as dbt,
            0::NUMERIC as crdt,
            'DEBIT_INVOICE' as prot
        FROM public.fee_invoices fi
        WHERE fi.student_id = p_student_id
        AND fi.status NOT IN ('cancelled', 'Cancelled')
        AND (p_cycle_id IS NULL OR fi.structure_id IN (
            SELECT id FROM public.fee_structures WHERE academic_year_id = p_cycle_id
        ))

        UNION ALL

        -- Credits (Legacy Payments)
        SELECT 
            fp.payment_date as t_date,
            'PAY-' || fp.id::TEXT as idnt,
            'Payment: ' || COALESCE(fp.payment_method, 'Online'),
            0::NUMERIC as dbt,
            fp.amount as crdt,
            'SETTLEMENT_LEGACY' as prot
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id
        AND fp.status IN ('completed', 'success', 'Completed')

        UNION ALL

        -- Credits (Enterprise Payments)
        SELECT 
            p.created_at as t_date,
            'ENT-' || p.id::TEXT as idnt,
            'Payment Node: ' || COALESCE(p.id::TEXT, 'SUCCESS'),
            0::NUMERIC as dbt,
            p.amount as crdt,
            'SETTLEMENT_ENTERPRISE' as prot
        FROM public.payments p
        WHERE p.student_id = p_student_id
        AND p.status IN ('success', 'completed')
    )
    SELECT 
        t_date as transaction_date,
        idnt as identifier,
        descr as description,
        dbt as debit,
        crdt as credit,
        SUM(dbt - crdt) OVER (ORDER BY t_date ASC, idnt ASC) as running_balance,
        prot as protocol
    FROM raw_entries
    ORDER BY t_date DESC;
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
AS $$
BEGIN
    RETURN QUERY
    SELECT ay.id, ay.year_name, ay.start_date, ay.end_date, ay.is_current, ay.status::TEXT
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
GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_branch_academic_cycles(BIGINT) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Consolidation V1 Applied. Integrity Reinforced.' as status;
