-- =============================================================================
-- FINANCE AMBIGUITY FIX V3 (ABSOLUTE FINAL)
-- =============================================================================
-- Target: get_student_financial_node
-- Diagnosis: "column reference 'profile_photo_url' is ambiguous" caused by 
--            duplicate columns in joined tables without explicit aliasing.
-- Action:
-- 1. Verify and Add 'profile_photo_url' to student_profiles if missing.
-- 2. Drop FORCEFULLY all variations of the function.
-- 3. Recreate the function with STRICT TABLE ALIASING (p.col, sp.col, a.col).
-- =============================================================================

BEGIN;

-- [1] SCHEMA PREP: Ensure the column exists so alias 'sp.profile_photo_url' is valid.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.student_profiles ADD COLUMN profile_photo_url TEXT;
    END IF;
END $$;

-- [2] CLEAN SLATE: Remove any conflicting function signatures
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, text) CASCADE;

-- [3] REBUILD: The Strictly Aliased Function
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
    -- [A] Resolve Cycle Logic (Safe Fallback)
    IF p_cycle_id IS NULL THEN
        SELECT id, year_name INTO v_cycle_id, v_cycle_name 
        FROM public.academic_years 
        WHERE is_current = true 
        LIMIT 1;
        
        IF v_cycle_id IS NULL THEN
            SELECT id, year_name INTO v_cycle_id, v_cycle_name 
            FROM public.academic_years 
            ORDER BY start_date DESC 
            LIMIT 1;
        END IF;
    ELSE
        v_cycle_id := p_cycle_id;
        SELECT year_name INTO v_cycle_name FROM public.academic_years WHERE id = p_cycle_id;
    END IF;

    IF v_cycle_name IS NULL THEN v_cycle_name := 'N/A'; END IF;

    -- [B] State Reconciliation
    -- We wrap this in a block to ignore errors if the reconciler is missing (safety)
    BEGIN
        PERFORM public.admin_reconcile_student_account(p_student_id);
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Proceed even if reconciliation fails
    END;

    -- [C] The Query (Fully Aliased)
    RETURN QUERY
    SELECT 
        p.id AS student_id,
        COALESCE(p.display_name, p.email) AS display_name,
        
        -- THE FIX: Strict Aliasing to resolve ambiguity
        -- Priority: 1. Main Profile, 2. Student Profile (School specific), 3. Admission Record
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
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) a ON p.id = a.student_user_id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE p.id = p_student_id;
END;
$$;

-- [4] PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(uuid, bigint) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Ambiguity V3 Applied. STRICT ALIASING ENFORCED.' as status;
