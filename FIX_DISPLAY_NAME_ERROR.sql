-- =============================================================================
-- FIX DISPLAY NAME ATTRIBUTE DESYNC
-- Description: Corrects the get_student_fee_summary_all function to fetch 
--              display_name from the 'profiles' table instead of 'student_profiles'.
--              Fixes Error: "column sp.display_name does not exist".
-- =============================================================================

BEGIN;

-- Redefine the RPC with correct JOINs
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
        END::TEXT as overall_status, -- Explicit cast for safety
        'INR'::TEXT as currency,
        sp.branch_id,
        p.profile_photo_url, -- Corrected: Sourced from profiles table
        COALESCE(sp.integrity_score, 100)
    FROM public.student_profiles sp
    JOIN public.profiles p ON sp.user_id = p.id -- Joined profiles table
    LEFT JOIN public.student_fee_accounts sfa ON sp.user_id = sfa.student_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    ORDER BY sp.grade ASC, p.display_name ASC; -- Ordered by profile name
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
