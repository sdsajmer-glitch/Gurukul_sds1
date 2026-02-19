-- =============================================================================
-- MASTER FINANCE RESTORATION V31 (Integrity Fix)
-- Description: Fixes "column sp.integrity_score does not exist" error.
--              Adds integrity_score and unallocated_funds to student_fee_accounts.
--              Updates get_student_fee_summary_all to fetch these from sfa.
-- =============================================================================

BEGIN;

-- [1] ENSURE COLUMNS EXIST IN STUDENT_FEE_ACCOUNTS
-- The error indicates sp.integrity_score doesn't exist, so we should standardize on sfa.
ALTER TABLE public.student_fee_accounts 
ADD COLUMN IF NOT EXISTS integrity_score INT DEFAULT 100,
ADD COLUMN IF NOT EXISTS unallocated_funds DECIMAL(15,2) DEFAULT 0;

-- [2] UPDATE RPC TO USE SFA COLUMNS
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
        p.display_name,
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
        p.profile_photo_url,
        COALESCE(sfa.integrity_score, 100) -- CHANGED: sfa.integrity_score instead of sp
    FROM public.student_profiles sp
    JOIN public.profiles p ON sp.user_id = p.id
    LEFT JOIN public.student_fee_accounts sfa ON sp.user_id = sfa.student_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    ORDER BY sp.grade ASC, p.display_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
