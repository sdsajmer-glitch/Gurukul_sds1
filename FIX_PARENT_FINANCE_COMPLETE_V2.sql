-- =============================================================================
-- FINANCE MODULE V2 - COMPREHENSIVE REPAIR AND ENHANCEMENT
-- =============================================================================
-- Implements student-wise isolation, cycle-specific ledgers, fee breakdown,
-- accurate status reporting, and manual payment workflows.
-- =============================================================================

BEGIN;

-- [1] UTILITY FUNCTIONS

-- Ensure we always get the correct active cycle
CREATE OR REPLACE FUNCTION public.get_current_academic_cycle()
RETURNS BIGINT LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_id BIGINT;
BEGIN
    SELECT id INTO v_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
    END IF;
    RETURN v_id;
END;
$$;

-- [2] CORE DATA FETCHING (PARENT PORTAL)

-- Fetch linked students with high-level finance summary (Cycle Isolaed)
CREATE OR REPLACE FUNCTION public.get_parent_linked_students_finance_v3(
    p_parent_id UUID
)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    branch_name TEXT,
    total_due NUMERIC,
    status TEXT,
    health_score INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_cycle_id BIGINT;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();

    RETURN QUERY
    SELECT 
        s.id AS student_id,
        COALESCE(s.display_name, 'Unknown Student') AS display_name,
        COALESCE(sp.profile_photo_url, s.profile_photo_url, adm.profile_photo_url) AS profile_photo_url,
        COALESCE(sp.grade, 'N/A') AS grade,
        COALESCE(b.name, 'Main Branch') AS branch_name,
        COALESCE(
            (SELECT SUM(fi.total_amount - fi.paid_amount) 
             FROM public.fee_invoices fi 
             WHERE fi.student_id = s.id 
               AND fi.academic_cycle_id = v_cycle_id
               AND fi.status NOT IN ('cancelled', 'waived')), 
            0
        ) AS total_due,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM public.fee_invoices fi 
                WHERE fi.student_id = s.id 
                  AND fi.academic_cycle_id = v_cycle_id
                  AND fi.due_date < CURRENT_DATE 
                  AND fi.status NOT IN ('paid', 'cancelled', 'waived')
            ) THEN 'OVERDUE'
            WHEN (
                SELECT SUM(fi.total_amount - fi.paid_amount) 
                FROM public.fee_invoices fi 
                WHERE fi.student_id = s.id 
                  AND fi.academic_cycle_id = v_cycle_id
                  AND fi.status NOT IN ('cancelled', 'waived')
            ) > 0 THEN 'Pending'
            ELSE 'Paid'
        END AS status,
        COALESCE(sfa.integrity_score, 100) AS health_score
    FROM public.parent_student_relationships psr
    JOIN public.profiles s ON psr.student_id = s.id
    LEFT JOIN public.student_profiles sp ON s.id = sp.user_id
    LEFT JOIN public.admissions adm ON s.email = adm.email
    LEFT JOIN public.branches b ON sp.branch_id = b.id
    LEFT JOIN public.student_fee_accounts sfa ON s.id = sfa.student_id
    WHERE psr.parent_id = p_parent_id;
END;
$$;

-- Fetch detailed finance view for a specific student (Full Breakdown)
CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v3(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_summary JSONB;
    v_breakdown JSONB;
    v_installments JSONB;
    v_history JSONB;
    v_cycle_id BIGINT := p_cycle_id;
    v_struct_id UUID;
BEGIN
    -- Resolve Cycle
    IF v_cycle_id IS NULL THEN
        v_cycle_id := public.get_current_academic_cycle();
    END IF;

    -- Calculate Summary based on INVOICES for this cycle (more accurate than global ledger)
    SELECT jsonb_build_object(
        'total_billed', COALESCE(SUM(total_amount), 0),
        'total_paid', COALESCE(SUM(paid_amount), 0),
        'outstanding', COALESCE(SUM(total_amount - paid_amount), 0),
        'overdue', COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND status != 'paid' THEN (total_amount - paid_amount) ELSE 0 END), 0),
        'unallocated', 0 -- Placeholder for complex wallet logic
    ) INTO v_summary
    FROM public.fee_invoices
    WHERE student_id = p_student_id 
      AND academic_cycle_id = v_cycle_id
      AND status != 'cancelled';

    -- Fee Breakdown (Structure Components)
    -- Try to find the structure linked to invoices, or fallback to enrolled structure
    SELECT fee_structure_id INTO v_struct_id 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND academic_cycle_id = v_cycle_id 
    LIMIT 1;

    IF v_struct_id IS NOT NULL THEN
        -- If components exist (assuming a fee_structure_components table or json field)
        -- Fallback: Use invoices grouped by title if structure components not available
        SELECT jsonb_agg(jsonb_build_object(
            'name', title,
            'amount', total_amount,
            'type', 'Standard'
        )) INTO v_breakdown
        FROM public.fee_invoices
        WHERE student_id = p_student_id AND academic_cycle_id = v_cycle_id
        ORDER BY due_date;
    ELSE
        v_breakdown := '[]'::jsonb;
    END IF;

    -- Installments (Invoices) with Status Logic
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'amount', total_amount,
        'paid', paid_amount,
        'due_date', due_date,
        'status', CASE 
            WHEN status = 'paid' THEN 'paid'
            WHEN due_date < CURRENT_DATE AND paid_amount < total_amount THEN 'overdue'
            WHEN paid_amount > 0 THEN 'partial'
            ELSE 'pending'
        END,
        'is_overdue', (due_date < CURRENT_DATE AND status != 'paid')
    )) INTO v_installments
    FROM public.fee_invoices
    WHERE student_id = p_student_id
      AND academic_cycle_id = v_cycle_id
      AND status != 'cancelled'
    ORDER BY due_date ASC;

    -- Transaction History (Linked to this student)
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'date', payment_date,
        'amount', amount,
        'mode', payment_method,
        'status', status,
        'ref_id', transaction_id,
        'proof_url', CASE WHEN proof_url IS NOT NULL THEN proof_url ELSE NULL END
    )) INTO v_history
    FROM public.fee_payments
    WHERE student_id = p_student_id
    ORDER BY payment_date DESC;

    RETURN jsonb_build_object(
        'summary', v_summary,
        'breakdown', COALESCE(v_breakdown, '[]'::jsonb),
        'installments', COALESCE(v_installments, '[]'::jsonb),
        'history', COALESCE(v_history, '[]'::jsonb),
        'cycle_id', v_cycle_id
    );
END;
$$;

-- [3] MANUAL PAYMENT SUBMISSION

CREATE OR REPLACE FUNCTION public.submit_manual_payment_receipt(
    p_student_id UUID,
    p_amount NUMERIC,
    p_transaction_date DATE,
    p_transaction_ref TEXT,
    p_payment_mode TEXT,
    p_proof_url TEXT,
    p_invoice_ids UUID[] DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    INSERT INTO public.fee_payments (
        student_id,
        amount,
        payment_date,
        payment_method,
        transaction_id,
        status,
        proof_url,
        notes
    )
    VALUES (
        p_student_id,
        p_amount,
        p_transaction_date,
        p_payment_mode,
        p_transaction_ref,
        'Pending Verification',
        p_proof_url,
        'Manual Receipt Upload'
    )
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'message', 'Receipt submitted for verification'
    );
END;
$$;

-- [4] PAYMENT PROCESSING (ENHANCED)

CREATE OR REPLACE FUNCTION public.process_payment_success_v2(
    p_payment_id UUID,
    p_transaction_ref TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student_id UUID;
    v_amount NUMERIC;
    v_remaining NUMERIC;
    v_invoice RECORD;
BEGIN
    -- 1. Get Payment Details
    SELECT student_id, amount INTO v_student_id, v_amount
    FROM public.fee_payments
    WHERE id = p_payment_id;

    IF v_student_id IS NULL THEN 
        RAISE EXCEPTION 'Payment ID not found';
    END IF;

    -- 2. Update Payment Status
    UPDATE public.fee_payments
    SET status = 'Completed',
        transaction_id = p_transaction_ref,
        verified_at = NOW()
    WHERE id = p_payment_id;

    -- 3. Auto-Allocation Logic (Waterfall)
    v_remaining := v_amount;

    FOR v_invoice IN 
        SELECT id, total_amount, paid_amount 
        FROM public.fee_invoices 
        WHERE student_id = v_student_id 
          AND status != 'paid' 
          AND status != 'cancelled'
        ORDER BY due_date ASC
    LOOP
        IF v_remaining <= 0 THEN EXIT; END IF;

        DECLARE
            v_due NUMERIC := v_invoice.total_amount - v_invoice.paid_amount;
            v_pay NUMERIC := LEAST(v_remaining, v_due);
        BEGIN
            UPDATE public.fee_invoices
            SET paid_amount = paid_amount + v_pay,
                status = CASE 
                    WHEN (paid_amount + v_pay) >= total_amount THEN 'paid' 
                    ELSE 'partial' 
                END,
                updated_at = NOW()
            WHERE id = v_invoice.id;

            v_remaining := v_remaining - v_pay;
        END;
    END LOOP;

    -- 4. Reconcile Ledger
    PERFORM public.admin_reconcile_student_account(v_student_id);
END;
$$;

-- [5] RECONCILIATION ENGINE (Self-Healing)

CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_billed NUMERIC;
    v_total_paid NUMERIC;
    v_outstanding NUMERIC;
    v_unallocated NUMERIC;
    v_cycle_id BIGINT;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();

    -- Calculate Totals
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_billed
    FROM public.fee_invoices
    WHERE student_id = p_student_id AND status != 'cancelled';

    SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_paid
    FROM public.fee_invoices
    WHERE student_id = p_student_id AND status != 'cancelled';

    v_outstanding := v_total_billed - v_total_paid;

    -- Update Summary Account (Upsert)
    INSERT INTO public.student_fee_accounts (
        student_id, 
        total_billed, 
        total_paid, 
        outstanding_balance, 
        integrity_score, 
        last_synced_at,
        is_active
    ) VALUES (
        p_student_id,
        v_total_billed,
        v_total_paid,
        v_outstanding,
        100,
        NOW(),
        true
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        last_synced_at = NOW();
END;
$$;

-- [6] PAYMENT INITIATION (Mock Gateway)

CREATE OR REPLACE FUNCTION public.initiate_parent_payment(
    p_student_id UUID,
    p_amount NUMERIC,
    p_invoice_ids UUID[]
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    INSERT INTO public.fee_payments (
        student_id,
        amount,
        payment_date,
        payment_method,
        status,
        notes
    )
    VALUES (
        p_student_id,
        p_amount,
        NOW(),
        'ONLINE',
        'Pending',
        'Platform Invoice Payment'
    )
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'gateway_url', '/payment/checkout?id=' || v_payment_id,
        'status', 'initiated'
    );
END;
$$;

COMMIT;
