-- =============================================================================
-- FINANCE AMBIGUITY FIX V2 (NUCLEAR OPTION)
-- =============================================================================
-- Target: Force removal of ALL overloaded versions of get_student_financial_node
-- Reason: Previous drops may have missed specific signatures (e.g., Integer vs BigInt)
-- Action: Drop everything with CASCADE, then rebuild the single authoritative source.
-- =============================================================================

BEGIN;

-- 1. [NUCLEAR DROP] Clear the board
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, integer) CASCADE; -- Catch int signatures
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, text) CASCADE;    -- Catch text signatures

-- 2. [REBUILD] The Authoritative Node Resolver
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
    -- [A] Resolve Cycle Logic
    IF p_cycle_id IS NULL THEN
        -- Auto-detect active cycle
        SELECT id, year_name INTO v_cycle_id, v_cycle_name 
        FROM public.academic_years 
        WHERE is_current = true 
        LIMIT 1;
        
        -- Fallback to latest if no active
        IF v_cycle_id IS NULL THEN
            SELECT id, year_name INTO v_cycle_id, v_cycle_name 
            FROM public.academic_years 
            ORDER BY start_date DESC 
            LIMIT 1;
        END IF;
    ELSE
        -- Use provided cycle
        v_cycle_id := p_cycle_id;
        SELECT year_name INTO v_cycle_name FROM public.academic_years WHERE id = p_cycle_id;
    END IF;

    -- Default Name
    IF v_cycle_name IS NULL THEN
        v_cycle_name := 'N/A';
    END IF;

    -- [B] State Reconciliation (Ensure finance audit is up to date)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    -- [C] The Query (Fully Qualified Columns to prevent Ambiguity)
    RETURN QUERY
    SELECT 
        p.id AS student_id,
        COALESCE(p.display_name, p.email) AS display_name,
        -- AMBIGUITY KILLER: Explicitly prefer Profile > StudentProfile > Admission
        COALESCE(p.profile_photo_url, sp.profile_photo_url, a.profile_photo_url) AS profile_photo_url,
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
    LEFT JOIN (
        -- Subquery for Admissions Photo (Distinct)
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) a ON p.id = a.student_user_id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE p.id = p_student_id;
END;
$$;

-- 3. [PERMISSIONS]
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(uuid, bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Ambiguity V2 Applied. All overloaded functions dropped.' as status;
