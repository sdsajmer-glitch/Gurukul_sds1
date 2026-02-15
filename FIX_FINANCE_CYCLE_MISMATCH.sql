
-- =============================================================================
-- FINANCE CYCLE ID MISMATCH & AMBIGUITY FIX
-- =============================================================================
-- Target: Align all Finance RPCs to use BIGINT Cycle IDs (matching academic_years).
-- Resolves: "Could not choose best candidate function"
-- =============================================================================

BEGIN;

-- 1. DROP Ambiguous Functions (UUID vs BIGINT versions)
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint);

DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid, bigint);


-- 2. RECREATE get_student_financial_node (BIGINT VERSION)
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
    -- Resolve Cycle Context using 'academic_years' (BIGINT)
    IF p_cycle_id IS NULL THEN
        SELECT id, year_name INTO v_cycle_id, v_cycle_name 
        FROM public.academic_years 
        WHERE is_current = true
        LIMIT 1;
        
        -- Fallback if no active cycle
        IF v_cycle_id IS NULL THEN
            SELECT id, year_name INTO v_cycle_id, v_cycle_name 
            FROM public.academic_years 
            ORDER BY start_date DESC 
            LIMIT 1;
        END IF;
    ELSE
        v_cycle_id := p_cycle_id;
        SELECT year_name INTO v_cycle_name FROM public.academic_years WHERE id = p_cycle_id;
    END IF;

    -- Fallback Name
    IF v_cycle_name IS NULL THEN
        v_cycle_name := 'N/A';
    END IF;

    -- Reconcile Account (Generic)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        p.id as student_id,
        COALESCE(p.display_name, p.email) as display_name,
        COALESCE(p.profile_photo_url, sp.profile_photo_url, a.profile_photo_url) as profile_photo_url,
        COALESCE(sp.grade, 'N/A') as grade,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
        p.is_active,
        v_cycle_id as academic_cycle_id,
        v_cycle_name as cycle_name,
        'ACTIVE'::TEXT as ledger_status
    FROM public.profiles p
    LEFT JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN (
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) a ON p.id = a.student_user_id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE p.id = p_student_id;
END;
$$;


-- 3. RECREATE get_student_running_ledger (BIGINT VERSION)
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
    -- Ensure State Sync
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    WITH raw_entries AS (
        SELECT 
            fi.created_at as t_date,
            'INV-' || fi.id::TEXT as idnt,
            fi.description as descr,
            fi.total_amount as dbt,
            0::NUMERIC as crdt,
            'INVOICE' as prot
        FROM public.fee_invoices fi
        WHERE fi.student_id = p_student_id 
          AND fi.status NOT IN ('cancelled', 'Cancelled')
          -- Note: Logic to filter by academic_year string using v_cycle_name could be added here if needed

        UNION ALL

        SELECT 
            COALESCE(fp.payment_date, fp.created_at) as t_date,
            'PAY-' || fp.id::TEXT as idnt,
            'Settlement: ' || COALESCE(fp.payment_method, 'Transfer'),
            0::NUMERIC as dbt,
            fp.amount as crdt,
            'PAYMENT' as prot
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id 
          AND fp.status IN ('Completed', 'Completed', 'completed', 'success')
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


-- 4. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(uuid, bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Cycle Ambiguity Resolved (BIGINT Standardized).' as status;
