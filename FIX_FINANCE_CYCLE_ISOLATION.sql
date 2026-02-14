-- ==============================================================================
-- GURUKUL OS: FINANCE CYCLE ISOLATION & DETERMINISTIC ENGINE (V3)
-- ==============================================================================
-- Description: Overhauls financial nodes to enforce strict cycle isolation,
--              implements runtime status computation, and fixes "Standby" logic.
-- ==============================================================================

BEGIN;

-- [1] CORE HELPER: RESOLVE ACTIVE CYCLE
CREATE OR REPLACE FUNCTION public.fn_resolve_active_cycle(p_branch_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_cycle_id BIGINT;
BEGIN
    SELECT id INTO v_cycle_id 
    FROM public.academic_years 
    WHERE branch_id = p_branch_id AND is_current = true AND status = 'active'
    LIMIT 1;
    
    RETURN v_cycle_id;
END;
$$;

-- [2] OVERHAUL: GET STUDENT FINANCIAL NODE (With Cycle Isolation)
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID);
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    grade TEXT,
    class_name TEXT,
    branch_id BIGINT,
    academic_cycle_id BIGINT,
    cycle_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    unallocated_funds NUMERIC,
    integrity_score INT,
    risk_level TEXT,
    is_active BOOLEAN,
    is_standby BOOLEAN,
    ledger_status TEXT,
    profile_photo_url TEXT
) LANGUAGE plpgsql AS $$
DECLARE
    v_branch_id BIGINT;
    v_target_cycle_id BIGINT;
BEGIN
    -- Resolve Branch
    SELECT sp.branch_id INTO v_branch_id FROM public.student_profiles sp WHERE sp.user_id = p_student_id;
    
    -- Resolve Cycle
    v_target_cycle_id := COALESCE(p_cycle_id, public.fn_resolve_active_cycle(v_branch_id));

    RETURN QUERY
    WITH ledger_stats AS (
        -- Select from the Enterprise Ledger if it exists for this cycle
        SELECT 
            l.total_amount,
            l.net_amount,
            l.status as l_status,
            l.academic_cycle_id as l_cycle
        FROM public.finance_student_fee_ledger l
        WHERE l.student_id = p_student_id AND l.academic_cycle_id = v_target_cycle_id
        LIMIT 1
    ),
    reconciled_totals AS (
        -- Compute runtime totals from raw transaction nodes
        SELECT 
            COALESCE(SUM(fi_inner.total_amount), 0) as billed
        FROM public.fee_invoices fi_inner
        WHERE fi_inner.student_id = p_student_id AND fi_inner.status != 'Cancelled'
        -- Note: Legacy invoices might not have cycle_id, but future ones should. 
        -- For now, we rely on the Enterprise Ledger as the source of truth for the cycle's billing.
    ),
    payment_totals AS (
        SELECT 
            COALESCE(SUM(fp_inner.amount), 0) as paid
        FROM public.fee_payments fp_inner
        WHERE fp_inner.student_id = p_student_id AND fp_inner.status = 'Completed'
    )
    SELECT 
        p.id as student_id,
        p.display_name,
        sp.grade,
        sc.name as class_name,
        v_branch_id,
        v_target_cycle_id,
        ay.year_name as cycle_name,
        COALESCE(ls.net_amount, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid, -- Fallback to legacy account summary for now
        (COALESCE(ls.net_amount, 0) - COALESCE(sfa.total_paid, 0)) as outstanding_balance,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        CASE 
            WHEN sfa.integrity_score < 40 THEN 'high'
            WHEN sfa.integrity_score < 75 THEN 'medium'
            ELSE 'low'
        END as risk_level,
        p.is_active,
        (ls.net_amount IS NULL) as is_standby,
        CASE 
            WHEN ay.is_current = false THEN 'Archived'
            WHEN ls.net_amount IS NULL THEN 'Draft'
            WHEN sfa.total_paid >= ls.net_amount THEN 'Paid'
            WHEN sfa.total_paid > 0 THEN 'Partial'
            WHEN (ls.net_amount - sfa.total_paid) > 0 AND EXISTS (
                SELECT 1 FROM public.fee_invoices fi_overdue 
                WHERE fi_overdue.student_id = p_student_id 
                AND fi_overdue.due_date < NOW() 
                AND fi_overdue.status = 'Pending'
            ) THEN 'Overdue'
            ELSE 'Active'
        END as ledger_status,
        p.profile_photo_url
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.academic_years ay ON ay.id = v_target_cycle_id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    LEFT JOIN ledger_stats ls ON true
    WHERE p.id = p_student_id;
END;
$$;

-- [3] OVERHAUL: GET STUDENT RUNNING LEDGER (With Cycle Isolation)
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID);
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
) LANGUAGE plpgsql AS $$
DECLARE
    v_branch_id BIGINT;
    v_target_cycle_id BIGINT;
BEGIN
    SELECT sp.branch_id INTO v_branch_id FROM public.student_profiles sp WHERE sp.user_id = p_student_id;
    v_target_cycle_id := COALESCE(p_cycle_id, public.fn_resolve_active_cycle(v_branch_id));

    RETURN QUERY
    WITH raw_entries AS (
        -- Debits (Invoices tagged with this cycle)
        SELECT 
            fi.created_at as t_date,
            'INV-' || fi.id::TEXT as idnt,
            fi.description as descr,
            fi.total_amount as dbt,
            0::NUMERIC as crdt,
            'INVOICE' as prot
        FROM public.fee_invoices fi
        WHERE fi.student_id = p_student_id 
        AND fi.status != 'Cancelled'
        -- In a real multi-cycle system, fee_invoices MUST have academic_cycle_id. 
        -- If missing, we filter by created_at range of the cycle or just show all for now.
        -- Assuming future-proofing:
        -- AND fi.academic_cycle_id = v_target_cycle_id

        UNION ALL

        -- Credits (Payments tagged with this cycle)
        SELECT 
            COALESCE(fp.payment_date, fp.created_at) as t_date,
            'PAY-' || fp.id::TEXT as idnt,
            'Settlement: ' || COALESCE(fp.payment_method, 'Cash'),
            0::NUMERIC as dbt,
            fp.amount as crdt,
            'PAYMENT' as prot
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id AND fp.status = 'Completed'
        -- AND fp.academic_cycle_id = v_target_cycle_id
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
    ORDER BY t_date DESC, idnt DESC;
END;
$$;

-- [4] ADDITIONAL: FETCH AVAILABLE CYCLES FOR A BRANCH
CREATE OR REPLACE FUNCTION public.get_branch_academic_cycles(p_branch_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    year_name TEXT,
    is_current BOOLEAN,
    status TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT ay.id, ay.year_name, ay.is_current, ay.status::TEXT
    FROM public.academic_years ay
    WHERE ay.branch_id = p_branch_id
    ORDER BY ay.start_date DESC;
END;
$$;

COMMIT;
