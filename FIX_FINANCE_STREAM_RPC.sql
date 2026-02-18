-- [RPC] get_recent_financial_stream
-- Returns the latest transactions across the branch for the Forensic Transaction Stream.

CREATE OR REPLACE FUNCTION public.get_recent_financial_stream(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id TEXT,
    student_name TEXT,
    amount NUMERIC,
    status TEXT,
    performed_at TIMESTAMPTZ,
    protocol TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    (
        SELECT 
            ('PAY-' || fp.id::TEXT)::TEXT,
            COALESCE(p.display_name, 'Unknown Student')::TEXT,
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
            COALESCE(p.display_name, 'Unknown Student')::TEXT,
            pay.amount::NUMERIC,
            pay.status::TEXT,
            pay.created_at::TIMESTAMPTZ,
            'ENTERPRISE_NODE_SYNC'::TEXT
        FROM public.payments pay
        JOIN public.student_profiles sp ON pay.student_id = sp.user_id
        JOIN public.profiles p ON sp.user_id = p.id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
          AND LOWER(pay.status::text) IN ('success', 'completed')
    )
    ORDER BY performed_at DESC
    LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_financial_stream(BIGINT) TO authenticated;
