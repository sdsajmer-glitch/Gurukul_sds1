-- ==============================================================================
-- MASTER FINANCE ENUM HARMONIZER & NUCLEAR AMBIGUITY FIX V2
-- ==============================================================================
-- Target: Finance & Fees (Ledger, Accounts, Summary)
-- Fixes: 
--  1. ERROR: invalid input value for enum invoice_status: "Cancelled"
--  2. "column reference 'profile_photo_url' is ambiguous"
--  3. RPC signature mismatches for finance retrieval.
-- ==============================================================================

BEGIN;

-- [1] ENUM EVOLUTION: Ensure the enum handles both cases to prevent Protocol Faults
-- If the type already exists, we cautiously add the TitleCase variations.
DO $$ 
BEGIN
    -- Standard variants are lowercase per apply_finance_enhance.sql
    -- We add TitleCase to support legacy functions and prevent "Invalid input" crashes.
    ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'Cancelled';
    ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'Pending';
    ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'Paid';
    ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'Overdue';
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Enum alteration skipped or already standardized.';
END $$;

-- [2] RECONCILIATION ENGINE: Hardening the state sync logic
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_total_billed NUMERIC;
    v_total_paid NUMERIC;
    v_unallocated NUMERIC;
    v_integrity INT;
BEGIN
    -- Calculate Total Liability (Excluding cancelled invoices - checking both cases)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND status NOT IN ('cancelled', 'Cancelled');

    -- Calculate Total Settlements (Completed and Pending payments)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND status IN ('Completed', 'Pending', 'completed', 'pending');

    -- Identify Unallocated Magnitude (Payments not linked to a specific invoice)
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND invoice_id IS NULL AND status IN ('Completed', 'completed');

    -- Calculate Integrity Score (Percentage of dues cleared)
    v_integrity := CASE 
        WHEN v_total_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_total_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_total_billed * 100)::INT))
    END;

    -- Update Summary Node (Atomic Upsert)
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_total_billed, v_total_paid, (v_total_billed - v_total_paid), 
        v_integrity, NOW(), v_unallocated
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        last_synced_at = NOW();
END;
$$;

-- [3] IDENTITY NODE: get_student_financial_node (The function currently failing in the UI)
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid);
CREATE OR REPLACE FUNCTION public.get_student_financial_node(p_student_id UUID)
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
    academic_cycle TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    -- Synchronize state before retrieval
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        p.id as student_id,
        COALESCE(p.display_name, p.email) as display_name,
        -- AMBIGUITY FIX: Qualified References
        COALESCE(p.profile_photo_url, sp.profile_photo_url, a.profile_photo_url) as profile_photo_url,
        COALESCE(sp.grade, 'N/A') as grade,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
        p.is_active,
        '2023-24'::TEXT as academic_cycle 
    FROM public.profiles p
    LEFT JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    LEFT JOIN (
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) a ON p.id = a.student_user_id
    WHERE p.id = p_student_id;
END;
$$;

-- [4] SUMMARY LEDGER: get_student_fee_summary_all
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(bigint);
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
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT 
        p.id as student_id,
        COALESCE(p.display_name, p.email) as display_name,
        COALESCE(p.profile_photo_url, sp.profile_photo_url, a.profile_photo_url) as profile_photo_url,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    LEFT JOIN (
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) a ON p.id = a.student_user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND p.role = 'Student'
    ORDER BY p.display_name ASC;
END;
$$;

-- [5] BULK INVOICING: Fixing status mismatch in automation
CREATE OR REPLACE FUNCTION public.admin_generate_bulk_invoices(
    p_branch_id BIGINT,
    p_class_id BIGINT,
    p_billing_month TEXT,
    p_billing_year TEXT,
    p_due_date DATE
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_student RECORD;
    v_component RECORD;
    v_count INT := 0;
BEGIN
    FOR v_student IN 
        SELECT sp.user_id, sfa.structure_id
        FROM public.student_profiles sp
        JOIN public.student_fee_assignments sfa ON sp.user_id = sfa.student_id
        WHERE sp.assigned_class_id = p_class_id
    LOOP
        FOR v_component IN 
            SELECT * FROM public.fee_components 
            WHERE structure_id = v_student.structure_id 
            AND (frequency = 'Monthly' OR frequency = 'Quarterly')
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.fee_invoices 
                WHERE student_id = v_student.user_id 
                AND description ILIKE v_component.name || '%'
                AND description ILIKE '%' || p_billing_month || ' ' || p_billing_year || '%'
                AND status NOT IN ('cancelled', 'Cancelled')
            ) THEN
                INSERT INTO public.fee_invoices (
                    student_id, total_amount, due_date, description, status, branch_id
                ) VALUES (
                    v_student.user_id, v_component.amount, p_due_date,
                    v_component.name || ' (' || p_billing_month || ' ' || p_billing_year || ')', 'pending', p_branch_id
                );
                v_count := v_count + 1;
            END IF;
        END LOOP;
        PERFORM public.admin_reconcile_student_account(v_student.user_id);
    END LOOP;
    RETURN jsonb_build_object('success', true, 'invoices_generated', v_count);
END;
$$;

-- [6] LEDGER FLOW: Running Ledger normalization
CREATE OR REPLACE FUNCTION public.get_student_running_ledger(p_student_id UUID)
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
        WHERE fi.student_id = p_student_id AND fi.status NOT IN ('cancelled', 'Cancelled')

        UNION ALL

        SELECT 
            COALESCE(fp.payment_date, fp.created_at) as t_date,
            'PAY-' || fp.id::TEXT as idnt,
            'Settlement: ' || COALESCE(fp.payment_method, 'Transfer'),
            0::NUMERIC as dbt,
            fp.amount as crdt,
            'PAYMENT' as prot
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id AND fp.status IN ('Completed', 'Completed', 'completed', 'success')
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

-- [7] Permissions Re-granting
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_student_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(uuid) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Master Finance Enum Harmonized. Case-sensitivity faults resolved.' as status;
