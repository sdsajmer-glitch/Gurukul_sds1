
-- =============================================================================
-- FINANCE LEDGER RPC SIGNATURE FIX
-- =============================================================================
-- Target: Align get_student_running_ledger with frontend calls (p_cycle_id).
-- Action: Updates function signature to accept p_cycle_id (safely ignored for now).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_student_running_ledger(
    p_student_id UUID,
    p_cycle_id UUID DEFAULT NULL
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
#variable_conflict use_column
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
          -- Future: Filter by p_cycle_id via academic_year mapping if needed

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

COMMIT;

SELECT 'SUCCESS: Ledger RPC Signature Updated.' as status;
