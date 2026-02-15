-- =============================================================================
-- PARENT FINANCE SYSTEM - RPC ENHANCEMENT
-- =============================================================================
-- Enhancing get_student_finance_detail_v2 to include proof URLs for history
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v2(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL -- Optional Cycle Filter
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_summary JSONB;
    v_installments JSONB;
    v_history JSONB;
    v_cycle_id BIGINT := p_cycle_id;
BEGIN
    -- Resolve Cycle if Null
    IF v_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    END IF;

    -- Summary Stats
    SELECT jsonb_build_object(
        'total_billed', COALESCE(total_billed, 0),
        'total_paid', COALESCE(total_paid, 0),
        'outstanding', COALESCE(outstanding_balance, 0),
        'unallocated', COALESCE(unallocated_funds, 0)
    ) INTO v_summary
    FROM public.student_fee_accounts
    WHERE student_id = p_student_id;

    -- Installments (Invoices)
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'amount', total_amount,
        'paid', paid_amount,
        'due_date', due_date,
        'status', status,
        'is_overdue', (due_date < NOW() AND status NOT IN ('paid', 'cancelled', 'Success', 'Completed'))
    )) INTO v_installments
    FROM public.fee_invoices
    WHERE student_id = p_student_id
      AND (v_cycle_id IS NULL OR academic_cycle_id = v_cycle_id)
    ORDER BY due_date ASC;

    -- Transaction History (Enhanced with Proof URL)
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'date', payment_date,
        'amount', amount,
        'mode', payment_method,
        'status', status,
        'ref_id', transaction_id,
        'proof_url', proof_document_url
    )) INTO v_history
    FROM public.fee_payments
    WHERE student_id = p_student_id
    ORDER BY payment_date DESC;

    RETURN jsonb_build_object(
        'summary', COALESCE(v_summary, '{"total_billed":0, "total_paid":0, "outstanding":0, "unallocated":0}'::jsonb),
        'installments', COALESCE(v_installments, '[]'::jsonb),
        'history', COALESCE(v_history, '[]'::jsonb),
        'cycle_id', v_cycle_id
    );
END;
$$;

COMMIT;
