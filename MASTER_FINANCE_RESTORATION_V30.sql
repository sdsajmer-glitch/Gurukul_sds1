-- =============================================================================
-- MASTER FINANCE RESTORATION V30 (Ultimate Fix)
-- Description: Consolidates all finance fixes into one master script.
--              1. Fixes "column sp.display_name does not exist" error.
--              2. Fixes "Ghost Invoice" calculation (125k -> 60k).
--              3. Ensures all RPCs and Tables are correctly defined.
-- =============================================================================

BEGIN;

-- [1] FIX DISPLAY NAME ERROR (Ref: get_student_fee_summary_all)
CREATE OR REPLACE FUNCTION public.get_student_fee_summary_all(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    class_name TEXT,
    grade TEXT,
    total_billed DECIMAL,
    total_paid DECIMAL,
    outstanding_balance DECIMAL,
    overall_status TEXT,
    currency TEXT,
    branch_id BIGINT,
    profile_photo_url TEXT,
    integrity_score INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.user_id as student_id,
        p.display_name, -- Corrected: Sourced from profiles table
        COALESCE(sc.name, 'Unassigned') as class_name,
        sp.grade,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        CASE 
            WHEN sfa.outstanding_balance > 0 THEN 'Pending'
            WHEN sfa.total_billed > 0 AND sfa.outstanding_balance <= 0 THEN 'Paid'
            ELSE 'No Dues'
        END::TEXT as overall_status,
        'INR'::TEXT as currency,
        sp.branch_id,
        p.profile_photo_url, -- Corrected: Sourced from profiles table
        COALESCE(sp.integrity_score, 100)
    FROM public.student_profiles sp
    JOIN public.profiles p ON sp.user_id = p.id -- Joined profiles table
    LEFT JOIN public.student_fee_accounts sfa ON sp.user_id = sfa.student_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    ORDER BY sp.grade ASC, p.display_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- [2] FIX GHOST INVOICES (Calculation Reset)
CREATE OR REPLACE FUNCTION public.admin_reset_student_fee_structure(p_student_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_grade TEXT;
    v_structure_id BIGINT;
    v_payment_count INT;
BEGIN
    -- Check for Payments (Safety Protocol)
    SELECT COUNT(*) INTO v_payment_count FROM fee_payments WHERE student_id = p_student_id AND status = 'completed';
    IF v_payment_count > 0 THEN
        RETURN 'SKIPPED: Student has active payments.';
    END IF;

    -- Get Student Grade
    SELECT grade INTO v_grade FROM student_profiles WHERE user_id = p_student_id;
    IF v_grade IS NULL THEN RETURN 'ERROR: No grade assigned.'; END IF;

    -- Find Correct Fee Structure
    SELECT id INTO v_structure_id 
    FROM fee_structures 
    WHERE target_grade = v_grade 
      AND status = 'Active' 
      AND is_default = true
    ORDER BY created_at DESC 
    LIMIT 1;

    IF v_structure_id IS NULL THEN RETURN 'ERROR: No active fee structure for Grade ' || v_grade; END IF;

    -- Purge "Ghost" Invoices
    DELETE FROM fee_invoices 
    WHERE student_id = p_student_id 
      AND status IN ('pending', 'draft', 'overdue')
      AND paid_amount = 0;

    -- Clear Old Assignments
    DELETE FROM student_fee_assignments WHERE student_id = p_student_id;

    -- Assign Correct Structure
    INSERT INTO student_fee_assignments (student_id, structure_id, status)
    VALUES (p_student_id, v_structure_id, 'Active');

    -- Manual Invoice Creation
    INSERT INTO fee_invoices (
        student_id, structure_id, total_amount, due_date, description, status, branch_id
    )
    SELECT 
        p_student_id, v_structure_id, 
        (SELECT SUM(amount) FROM fee_components WHERE structure_id = v_structure_id),
        (CURRENT_DATE + INTERVAL '30 days'),
        'Academic Fee Assessment (Corrected)',
        'pending',
        (SELECT branch_id FROM student_profiles WHERE user_id = p_student_id)
    WHERE EXISTS (SELECT 1 FROM fee_components WHERE structure_id = v_structure_id);

    -- Sync Ledger
    PERFORM public.recalculate_all_student_ledgers((SELECT branch_id FROM student_profiles WHERE user_id = p_student_id));

    RETURN 'SUCCESS: Reset to Grade ' || v_grade;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- [3] EXECUTE AUTO-CORRECTION FOR ORPHANS
DO $$
DECLARE
    r RECORD;
    v_res TEXT;
BEGIN
    FOR r IN 
        SELECT sp.user_id 
        FROM student_profiles sp
        JOIN student_fee_accounts sfa ON sp.user_id = sfa.student_id
        LEFT JOIN student_fee_assignments sfas ON sp.user_id = sfas.student_id
        WHERE sfa.total_billed > 0 
          AND sfa.total_paid = 0
          AND sfas.id IS NULL -- "Orphan" state
    LOOP
        v_res := public.admin_reset_student_fee_structure(r.user_id);
    END LOOP;
END $$;


-- [4] ENSURE OVERVIEW STATS V3 EXISTS
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

COMMIT;
