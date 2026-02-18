-- [RPC] get_finance_overview_stats_v3
-- Enhanced version of overview stats including 30d expenses.

CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v3(p_branch_id BIGINT DEFAULT NULL)
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
    v_expense_30d NUMERIC;
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

    -- Calculate 30d Expenses
    BEGIN
        SELECT COALESCE(SUM(amount), 0::NUMERIC) INTO v_expense_30d
        FROM public.expenses
        WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
          AND expense_date >= NOW() - INTERVAL '30 days'
          AND LOWER(status::text) NOT IN ('cancelled', 'rejected');
    EXCEPTION WHEN OTHERS THEN v_expense_30d := 0; END;

    RETURN jsonb_build_object(
        'total_assigned', v_assigned,
        'total_collected', v_collected,
        'total_pending', v_pending,
        'total_overdue', v_overdue,
        'monthly_collection', v_monthly,
        'today_collection', v_today,
        'total_expense_30d', v_expense_30d,
        'health_index', ROUND((CASE WHEN v_assigned > 0 THEN (v_collected / v_assigned) * 80 + 20 ELSE 100 END)::NUMERIC, 0),
        'currency', 'INR'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_finance_overview_stats_v3(BIGINT) TO authenticated;
