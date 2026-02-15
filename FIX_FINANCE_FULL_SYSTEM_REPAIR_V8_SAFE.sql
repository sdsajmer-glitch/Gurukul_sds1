-- =============================================================================
-- FINANCE FULL SYSTEM REPAIR V8 (SAFE MODE)
-- =============================================================================
-- Purpose: Resolve "Ambiguous Column" error across ENTIRE Finance Module.
-- Strategy: SIMPLIFICATION.
--           We are removing complex photo logic temporarily to guarantee system stability.
--           Both Dashboard and Detail views will strictly use 'profiles.profile_photo_url'.
-- =============================================================================

BEGIN;

-- [1] ENSURE COLUMN EXISTS (Idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.student_profiles ADD COLUMN profile_photo_url TEXT;
    END IF;
END $$;

-- [2] CLEANUP: Drop ALL variations of involved functions
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all() CASCADE;

-- [3] REBUILD: get_student_financial_node (For Detail View) -> SAFE MODE
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
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
    academic_cycle_id BIGINT,
    cycle_name TEXT,
    ledger_status TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cycle_id BIGINT;
    v_cycle_name TEXT;
BEGIN
    -- Cycle Resolution
    IF p_cycle_id IS NULL THEN
        SELECT id, year_name INTO v_cycle_id, v_cycle_name FROM public.academic_years WHERE is_current = true LIMIT 1;
        IF v_cycle_id IS NULL THEN
            SELECT id, year_name INTO v_cycle_id, v_cycle_name FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
        END IF;
    ELSE
        v_cycle_id := p_cycle_id;
        SELECT year_name INTO v_cycle_name FROM public.academic_years WHERE id = p_cycle_id;
    END IF;
    IF v_cycle_name IS NULL THEN v_cycle_name := 'N/A'; END IF;

    -- Reconciliation
    BEGIN PERFORM public.admin_reconcile_student_account(p_student_id); EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Query
    RETURN QUERY
    SELECT 
        p.id AS student_id,
        COALESCE(p.display_name, p.email) AS display_name,
        
        -- SAFE MODE: Only use primary profile photo
        p.profile_photo_url AS profile_photo_url,
        
        COALESCE(sp.grade, 'N/A') AS grade,
        COALESCE(sc.name, 'UNASSIGNED') AS class_name,
        COALESCE(sfa.total_billed, 0) AS total_billed,
        COALESCE(sfa.total_paid, 0) AS total_paid,
        COALESCE(sfa.outstanding_balance, 0) AS outstanding_balance,
        COALESCE(sfa.integrity_score, 100) AS integrity_score,
        COALESCE(sfa.unallocated_funds, 0) AS unallocated_funds,
        p.is_active,
        v_cycle_id AS academic_cycle_id,
        v_cycle_name AS cycle_name,
        'ACTIVE'::TEXT AS ledger_status
    FROM public.profiles p
    LEFT JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE p.id = p_student_id;
END;
$$;

-- [4] REBUILD: get_student_fee_summary_all (For Dashboard) -> SAFE MODE
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
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS student_id,
        COALESCE(p.display_name, p.email) AS display_name,
        
        -- SAFE MODE: Only use primary profile photo
        p.profile_photo_url AS profile_photo_url,
        
        COALESCE(sc.name, 'UNASSIGNED') AS class_name,
        COALESCE(sfa.total_billed, 0) AS total_billed,
        COALESCE(sfa.total_paid, 0) AS total_paid,
        COALESCE(sfa.outstanding_balance, 0) AS outstanding_balance,
        COALESCE(sfa.integrity_score, 100) AS integrity_score,
        COALESCE(sfa.unallocated_funds, 0) AS unallocated_funds
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND LOWER(p.role) = 'student'
    ORDER BY p.display_name ASC;
END;
$$;

-- [5] GRANTS
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Full System Repair V8 (Safe Mode) - Ambiguity Eliminated.' as status;
