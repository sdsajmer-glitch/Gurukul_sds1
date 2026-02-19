-- =============================================================================
-- MASTER FINANCE RESTORATION & AMBIGUITY RESOLUTION (V23)
-- =============================================================================
-- Targets: 1. Remove ALL 'full_name' references (profiles table uses display_name/email)
--          2. Resolve ALL "Ambiguous Column" errors (profile_photo_url)
--          3. Harmonize Signatures (p_branch_id BIGINT, p_cycle_id BIGINT)
--          4. Ensure Atomic Reconciliation on Read
-- =============================================================================

BEGIN;

-- [1] NUCLEAR CLEANUP: Drop all variants to prevent signature collision
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all() CASCADE;
DROP FUNCTION IF EXISTS public.get_recent_financial_stream(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_recent_financial_stream(bigint, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_forensic_audit_logs(bigint, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_forensic_audit_logs(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_forensic_audit_logs(bigint, integer, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid, bigint) CASCADE;

-- [2] REBUILD: get_student_financial_node (Detail View Feed)
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
    -- Force Reconcile on Read (Ensures UI is never stale)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    IF v_target_cycle_id IS NULL THEN
        SELECT ay.id, ay.year_name INTO v_target_cycle_id, v_target_cycle_name 
        FROM public.academic_years ay WHERE ay.is_current = true LIMIT 1;
    ELSE
        SELECT ay.year_name INTO v_target_cycle_name FROM public.academic_years ay WHERE ay.id = v_target_cycle_id;
    END IF;

    RETURN QUERY
    SELECT 
        p.id::UUID,
        COALESCE(p.display_name, p.email)::TEXT,
        COALESCE(p.profile_photo_url, sp.profile_photo_url)::TEXT,
        sp.grade::TEXT,
        COALESCE(cls.name, 'UNASSIGNED')::TEXT,
        COALESCE(sacc.total_billed, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.total_paid, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.outstanding_balance, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.integrity_score, 100)::INTEGER,
        COALESCE(sacc.unallocated_funds, 0::NUMERIC)::NUMERIC,
        p.is_active::BOOLEAN,
        (sfl.id IS NULL OR COALESCE(sacc.total_billed, 0) = 0)::BOOLEAN as is_standby,
        v_target_cycle_id::BIGINT,
        v_target_cycle_name::TEXT,
        sp.branch_id::BIGINT,
        COALESCE(sfl.status, 'NO_LEDGER')::TEXT
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes cls ON sp.assigned_class_id = cls.id
    LEFT JOIN public.student_fee_accounts sacc ON p.id = sacc.student_id
    LEFT JOIN public.student_fee_ledger sfl ON p.id = sfl.student_id AND sfl.academic_year_id = v_target_cycle_id
    WHERE p.id = p_student_id
    LIMIT 1;
END;
$$;

-- [3] REBUILD: get_student_fee_summary_all (Accounts Dashboard Feed)
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
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id::UUID,
        COALESCE(p.display_name, p.email)::TEXT,
        COALESCE(p.profile_photo_url, sp.profile_photo_url)::TEXT,
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
      AND (LOWER(p.role) = 'student')
      AND p.is_active = true
    ORDER BY p.display_name ASC;
END;
$$;

-- [4] REBUILD: get_recent_financial_stream (Overview Deep Stream)
CREATE OR REPLACE FUNCTION public.get_recent_financial_stream(
    p_branch_id BIGINT DEFAULT NULL, 
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id TEXT,
    student_name TEXT,
    amount NUMERIC,
    status TEXT,
    performed_at TIMESTAMPTZ,
    protocol TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    (
        SELECT 
            ('PAY-' || fp.id::TEXT)::TEXT,
            COALESCE(p.display_name, p.email, 'Unknown Student')::TEXT,
            fp.amount::NUMERIC,
            fp.status::TEXT,
            fp.payment_date::TIMESTAMPTZ,
            'FINANCE_SETTLEMENT'::TEXT
        FROM public.fee_payments fp
        JOIN public.student_profiles sp ON fp.student_id = sp.user_id
        JOIN public.profiles p ON sp.user_id = p.id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
          AND LOWER(fp.status::text) IN ('completed', 'success')
        
        UNION ALL

        SELECT 
            ('ENT-' || pay.id::TEXT)::TEXT,
            COALESCE(prof.display_name, prof.email, 'Unknown Student')::TEXT,
            pay.amount::NUMERIC,
            pay.status::TEXT,
            pay.created_at::TIMESTAMPTZ,
            'ENTERPRISE_NODE'::TEXT
        FROM public.payments pay
        JOIN public.student_profiles spent ON pay.student_id = spent.user_id
        JOIN public.profiles prof ON spent.user_id = prof.id
        WHERE (p_branch_id IS NULL OR spent.branch_id = p_branch_id)
          AND LOWER(pay.status::text) IN ('success', 'completed')
    )
    ORDER BY performed_at DESC
    LIMIT p_limit;
END;
$$;

-- [5] REBUILD: get_student_running_ledger (Detail Sequential Feed)
CREATE OR REPLACE FUNCTION public.get_student_running_ledger(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    transaction_date TIMESTAMPTZ,
    description TEXT,
    identifier TEXT,
    protocol TEXT,
    debit NUMERIC,
    credit NUMERIC,
    running_balance NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_balance NUMERIC := 0;
    v_rec RECORD;
BEGIN
    FOR v_rec IN (
        SELECT created_at as t_date, 'Fee Assessment' as descr, 'BILL_' || id::text as ident, 'AUTOMATION' as prot, total_amount as deb, 0 as cred
        FROM student_fee_ledger 
        WHERE student_id = p_student_id AND (p_cycle_id IS NULL OR academic_year_id = p_cycle_id)
        
        UNION ALL
        
        SELECT payment_date as t_date, 'Fee Settlement' as descr, receipt_number as ident, 'SETTLEMENT' as prot, 0 as deb, amount as cred
        FROM fee_payments 
        WHERE student_id = p_student_id AND LOWER(status::text) IN ('success', 'completed')
        
        UNION ALL
        
        SELECT created_at as t_date, 'Enterprise Settlement' as descr, 'ENT-' || id::text as ident, 'ENTERPRISE' as prot, 0 as deb, amount as cred
        FROM payments 
        WHERE student_id = p_student_id AND LOWER(status::text) IN ('success', 'completed')
        
        ORDER BY t_date ASC
    ) LOOP
        v_balance := v_balance + v_rec.deb - v_rec.cred;
        transaction_date := v_rec.t_date;
        description := v_rec.descr;
        identifier := v_rec.ident;
        protocol := v_rec.prot;
        debit := v_rec.deb;
        credit := v_rec.cred;
        running_balance := v_balance;
        RETURN NEXT;
    END LOOP;
END;
$$;

-- [6] REBUILD: get_forensic_audit_logs (Audit Tab Feed)
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
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        'FINANCE'::TEXT,
        f.action_type,
        f.description,
        f.entity_type,
        f.entity_id::TEXT,
        f.old_value,
        f.new_value,
        COALESCE(p.display_name, p.email, 'SYSTEM_CORE'),
        f.severity,
        f.performed_at
    FROM public.finance_governance_audit f
    LEFT JOIN public.profiles p ON f.performed_by = p.id
    WHERE (p_branch_id IS NULL OR f.branch_id = p_branch_id)
      AND (p_severity IS NULL OR f.severity = p_severity)
    ORDER BY f.performed_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- [7] GRANTS
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_financial_stream(bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forensic_audit_logs(bigint, integer, integer, text) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Master Resilience V23 deployed. All p.full_name references eliminated.' as status;
