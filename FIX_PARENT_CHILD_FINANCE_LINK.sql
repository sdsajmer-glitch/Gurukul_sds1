-- ==============================================================================
-- FIX: PARENT-CHILD FINANCE LINKAGE (v7.1)
-- 1. Unifies how Children are found (Alings Finance with Family Nodes)
-- 2. Populates student_parents from admissions data
-- 3. Updates the RPC to be resilient to missing relationships
-- ==============================================================================

BEGIN;

-- [0] ENSURE TABLE EXISTS (Schema Safety)
CREATE TABLE IF NOT EXISTS public.student_parents (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    relationship text,
    is_primary boolean DEFAULT false,
    UNIQUE(student_id, parent_id)
);

-- [1] BACKFILL RELATIONSHIPS
-- Automatically link parents to their children based on successful admissions
INSERT INTO public.student_parents (parent_id, student_id, relationship)
SELECT parent_id, student_user_id, 'Parent'
FROM public.admissions
WHERE student_user_id IS NOT NULL 
  AND parent_id IS NOT NULL
  AND status IN ('ENROLLED', 'VERIFIED', 'APPROVED')
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- Also try linking by email for older records if any
INSERT INTO public.student_parents (parent_id, student_id, relationship)
SELECT p.id, a.student_user_id, 'Parent'
FROM public.admissions a
JOIN public.profiles p ON LOWER(a.parent_email) = LOWER(p.email)
WHERE a.student_user_id IS NOT NULL 
  AND a.status IN ('ENROLLED', 'VERIFIED', 'APPROVED')
  AND p.id != a.student_user_id -- Ensure no self-linkage
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- [2] ENHANCED RPC: get_parent_linked_students_finance_v2
-- This RPC is used by the FinanceTab to populate the student dropdown
CREATE OR REPLACE FUNCTION public.get_parent_linked_students_finance_v2(p_parent_id UUID)
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
BEGIN
    RETURN QUERY
    WITH linked_students AS (
        -- Strategy A: Direct relationships table (student_parents)
        SELECT ps.student_id FROM public.student_parents ps WHERE ps.parent_id = p_parent_id
        UNION
        -- Strategy B: Admissions where user is the parent
        SELECT student_user_id FROM public.admissions WHERE parent_id = p_parent_id AND student_user_id IS NOT NULL
        UNION
        -- Strategy C: Email match
        SELECT student_user_id FROM public.admissions a 
        JOIN public.profiles p ON LOWER(a.parent_email) = LOWER(p.email)
        WHERE p.id = p_parent_id AND student_user_id IS NOT NULL
    )
    SELECT 
        s.id AS student_id,
        COALESCE(s.display_name, (SELECT applicant_name FROM public.admissions WHERE student_user_id = s.id LIMIT 1), 'Unknown Student') AS display_name,
        COALESCE(s.profile_photo_url, sp.profile_photo_url, (SELECT profile_photo_url FROM public.admissions WHERE student_user_id = s.id LIMIT 1)) AS profile_photo_url,
        COALESCE(sp.grade, (SELECT grade FROM public.admissions WHERE student_user_id = s.id LIMIT 1), 'N/A') AS grade,
        COALESCE(sb.name, 'Main Branch') AS branch_name,
        COALESCE(fl.outstanding_balance, 0) AS total_due,
        CASE 
            WHEN fl.outstanding_balance > 0 THEN 'Pending'
            WHEN fl.total_billed > 0 AND fl.outstanding_balance = 0 THEN 'Paid'
            ELSE 'No Dues'
        END AS status,
        100 AS health_score
    FROM linked_students ls
    JOIN public.profiles s ON ls.student_id = s.id
    LEFT JOIN public.student_profiles sp ON s.id = sp.user_id
    LEFT JOIN public.school_branches sb ON sp.branch_id = sb.id
    -- Join with our Unified Ledger (finance_student_fee_ledger)
    LEFT JOIN (
        SELECT student_id, SUM(outstanding_balance) as outstanding_balance, SUM(total_billed) as total_billed
        FROM public.finance_student_fee_ledger
        WHERE academic_cycle_id = (SELECT id FROM public.academic_years WHERE is_current = true LIMIT 1)
        GROUP BY student_id
    ) fl ON s.id = fl.student_id;
END;
$$;

-- [3] ENSURE RECENT DATA IS ACTIVE
UPDATE public.academic_years SET is_current = false;
UPDATE public.academic_years SET status = 'active', is_current = true WHERE year_name = '2025-2026';

COMMIT;
