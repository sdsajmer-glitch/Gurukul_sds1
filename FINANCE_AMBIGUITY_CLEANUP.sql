
-- =============================================================================
-- FINANCE AMBIGUITY & CONFLICT RESOLUTION (FINAL)
-- =============================================================================
-- Target: Resolve "Multiple node identifiers" / "Ambiguous Function" conflicts.
-- Action: 1. Nuke ALL variations of finance RPCs. 2. Re-deploy standardized BIGINT version.
-- =============================================================================

BEGIN;

-- 1. [CLEANUP] Drop ALL variations to eliminate "Candidate Function" ambiguity
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid);
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint);

-- 2. [REBUILD] The Standardized Node Resolver (BIGINT Cycle ID)
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
    academic_cycle_id BIGINT,
    cycle_name TEXT,
    ledger_status TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cycle_id BIGINT;
    v_cycle_name TEXT;
BEGIN
    -- [A] Resolve Cycle Logic
    IF p_cycle_id IS NULL THEN
        -- Auto-detect active cycle
        SELECT id, year_name INTO v_cycle_id, v_cycle_name 
        FROM public.academic_years 
        WHERE is_current = true 
        LIMIT 1;
        
        -- Fallback to latest if no active
        IF v_cycle_id IS NULL THEN
            SELECT id, year_name INTO v_cycle_id, v_cycle_name 
            FROM public.academic_years 
            ORDER BY start_date DESC 
            LIMIT 1;
        END IF;
    ELSE
        -- Use provided cycle
        v_cycle_id := p_cycle_id;
        SELECT year_name INTO v_cycle_name FROM public.academic_years WHERE id = p_cycle_id;
    END IF;

    -- Default Name
    IF v_cycle_name IS NULL THEN
        v_cycle_name := 'N/A';
    END IF;

    -- [B] State Reconciliation (Ensures data is fresh)
    -- Using the Master Reconciler from harmonizer
    PERFORM public.admin_reconcile_student_account(p_student_id);

    -- [C] The Query (Fully Qualified to avoid "Ambiguous Column" errors)
    RETURN QUERY
    SELECT 
        p.id AS student_id,
        COALESCE(p.display_name, p.email) AS display_name,
        -- Priority: Profile > Student Profile > Admission Legacy
        COALESCE(p.profile_photo_url, sp.profile_photo_url, a.profile_photo_url) AS profile_photo_url,
        COALESCE(sp.grade, 'N/A') AS grade,
        COALESCE(sc.name, 'UNASSIGNED') AS class_name,
        COALESCE(sfa.total_billed, 0) AS total_billed,
        COALESCE(sfa.total_paid, 0) AS total_paid,
        COALESCE(sfa.outstanding_balance, 0) AS outstanding_balance,
        COALESCE(sfa.integrity_score, 100) AS integrity_score,
        COALESCE(sfa.unallocated_funds, 0) AS unallocated_funds,
        p.is_active,
        v_cycle_id AS academic_cycle_id,
        v_cycle_name AS cycle_name,
        'ACTIVE'::TEXT AS ledger_status
    FROM public.profiles p
    LEFT JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN (
        -- Subquery for Admissions Photo (Distinct)
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) a ON p.id = a.student_user_id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE p.id = p_student_id;
END;
$$;

-- 3. [CLEANUP] Ledger Function cleanup too
DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid, bigint);

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
    -- Ensure Sync
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    WITH raw_entries AS (
        SELECT 
            fi.created_at AS t_date,
            'INV-' || fi.id::TEXT AS idnt,
            fi.description AS descr,
            fi.total_amount AS dbt,
            0::NUMERIC AS crdt,
            'INVOICE' AS prot
        FROM public.fee_invoices fi
        WHERE fi.student_id = p_student_id 
          AND fi.status NOT IN ('cancelled', 'Cancelled')

        UNION ALL

        SELECT 
            COALESCE(fp.payment_date, fp.created_at) AS t_date,
            'PAY-' || fp.id::TEXT AS idnt,
            'Settlement: ' || COALESCE(fp.payment_method, 'Transfer'),
            0::NUMERIC AS dbt,
            fp.amount AS crdt,
            'PAYMENT' AS prot
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id 
          AND fp.status IN ('Completed', 'Completed', 'completed', 'success')
    )
    SELECT 
        t_date AS transaction_date,
        idnt AS identifier,
        descr AS description,
        dbt AS debit,
        crdt AS credit,
        SUM(dbt - crdt) OVER (ORDER BY t_date ASC, idnt ASC) AS running_balance,
        prot AS protocol
    FROM raw_entries
    ORDER BY t_date DESC, idnt DESC;
END;
$$;

-- 4. [PERMISSIONS] Re-grant
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(uuid, bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Ambiguity Terminated. Single RPC Version Enforced.' as status;
