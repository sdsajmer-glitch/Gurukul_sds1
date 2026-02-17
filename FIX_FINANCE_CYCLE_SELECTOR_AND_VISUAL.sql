-- ==============================================================================
-- FIX FINANCE CYCLE SELECTOR & VISUAL ENHANCEMENTS
-- ==============================================================================
-- 1. Updates get_student_financial_node to return cycle_name for UI display.
-- 2. Ensures the cycle selector dropdown works correctly.
-- 3. Fixes visual issues with large names.
-- ==============================================================================

-- Drop the old function signature to allow return type change
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID, BIGINT);

CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    grade TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INT,
    profile_photo_url TEXT,
    is_active BOOLEAN,
    is_standby BOOLEAN,
    unallocated_funds NUMERIC,
    academic_cycle_id BIGINT,
    cycle_name TEXT,        -- NEW: For UI display
    cycle_status TEXT,      -- NEW: For UI status badge
    branch_id BIGINT,
    ledger_status TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_cycle_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            p.id as student_id,
            p.display_name,
            sp.grade,
            sc.name as class_name,
            COALESCE(sfl.total_amount, 0) as total_billed,
            COALESCE((SELECT SUM(ins.paid_amount) FROM public.installment_schedule ins WHERE ins.ledger_id = sfl.id), 0) as total_paid,
            COALESCE(sfl.total_amount, 0) - COALESCE((SELECT SUM(ins.paid_amount) FROM public.installment_schedule ins WHERE ins.ledger_id = sfl.id), 0) as outstanding_balance,
            CASE 
                WHEN sfl.total_amount > 0 THEN 
                    LEAST(100, FLOOR((COALESCE((SELECT SUM(ins.paid_amount) FROM public.installment_schedule ins WHERE ins.ledger_id = sfl.id), 0) / sfl.total_amount) * 100))::INT
                ELSE 100 
            END as integrity_score,
            COALESCE(p.profile_photo_url, sp.profile_photo_url)::text as profile_photo_url,
            p.is_active,
            (sfl.id IS NULL) as is_standby,
            COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
            COALESCE(sfl.academic_year_id, p_cycle_id) as academic_cycle_id,
            (SELECT year_name FROM public.academic_years WHERE id = p_cycle_id) as cycle_name,
            (SELECT status::text FROM public.academic_years WHERE id = p_cycle_id) as cycle_status,
            sp.branch_id,
            COALESCE(sfl.status, 'NO_LEDGER')::text as ledger_status
        FROM public.profiles p
        JOIN public.student_profiles sp ON p.id = sp.user_id
        LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
        LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
        LEFT JOIN public.student_fee_ledger sfl ON p.id = sfl.student_id AND sfl.academic_year_id = p_cycle_id
        WHERE p.id = p_student_id;
    ELSE
        -- Global View (Default to Current Cycle if possible, or Aggregate)
        -- For simplicity, we return the student's primary branch current cycle info if available, 
        -- or just 'GLOBAL_VIEW' metadata.
        
        -- Attempt to find current active cycle for this student's branch
        RETURN QUERY
        SELECT 
            p.id as student_id,
            p.display_name,
            sp.grade,
            sc.name as class_name,
            COALESCE(sfa.total_billed, 0) as total_billed,
            COALESCE(sfa.total_paid, 0) as total_paid,
            COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
            COALESCE(sfa.integrity_score, 100) as integrity_score,
            COALESCE(p.profile_photo_url, sp.profile_photo_url)::text as profile_photo_url,
            p.is_active,
            (COALESCE(sfa.total_billed, 0) = 0) as is_standby,
            COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
            (SELECT id FROM public.academic_years WHERE branch_id = sp.branch_id AND is_current = true LIMIT 1) as academic_cycle_id,
            (SELECT year_name FROM public.academic_years WHERE branch_id = sp.branch_id AND is_current = true LIMIT 1) as cycle_name,
            'active'::text as cycle_status,
            sp.branch_id,
            'GLOBAL_VIEW'::text as ledger_status
        FROM public.profiles p
        JOIN public.student_profiles sp ON p.id = sp.user_id
        LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
        LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
        WHERE p.id = p_student_id;
    END IF;
END;
$$;
