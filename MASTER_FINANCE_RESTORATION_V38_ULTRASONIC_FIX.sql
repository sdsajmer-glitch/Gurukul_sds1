-- =============================================================================
-- MASTER_FINANCE_RESTORATION_V38_ULTRASONIC_FIX
-- =============================================================================
-- Target: Resolve 'profile_photo_url' ambiguity and RPC signature mismatches.
-- Action: 1. Adds missing columns. 2. Drops all stale RPCs. 3. Rebuilds Master RPC.
-- =============================================================================

BEGIN;

-- [1] SCHEMA HARDENING (Idempotent)
DO $$ 
BEGIN
    -- Ensure profile_photo_url exists in key identity tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.profiles ADD COLUMN profile_photo_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.student_profiles ADD COLUMN profile_photo_url TEXT;
    END IF;

    -- Ensure finance_student_profiles has financial_status if missing (V36+ requirement)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'finance_student_profiles' AND column_name = 'financial_status') THEN
        ALTER TABLE public.finance_student_profiles ADD COLUMN financial_status TEXT DEFAULT 'ACTIVE';
    END IF;
END $$;

-- [2] DATA SYNC (Propagate Photos)
UPDATE public.profiles p
SET profile_photo_url = a.profile_photo_url
FROM public.admissions a
WHERE p.id = a.student_user_id
  AND (p.profile_photo_url IS NULL OR p.profile_photo_url = '')
  AND a.profile_photo_url IS NOT NULL;

UPDATE public.student_profiles sp
SET profile_photo_url = a.profile_photo_url
FROM public.admissions a
WHERE sp.user_id = a.student_user_id
  AND (sp.profile_photo_url IS NULL OR sp.profile_photo_url = '')
  AND a.profile_photo_url IS NOT NULL;

-- [3] NUCLEAR CLEANUP: Drop ALL variations of the target function
-- This clears the "Multiple node identifiers" / "Ambiguous" fault in Supabase registry.
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, text) CASCADE;

-- [4] REBUILD: get_student_financial_node (The Detail View Function)
-- This version contains ALL columns required by StudentFinanceDetailView.tsx
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
    ledger_status TEXT,
    branch_id BIGINT,
    next_due_date DATE,
    next_due_amount NUMERIC,
    gross_billed NUMERIC,
    scholarship_amount NUMERIC
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cycle_id BIGINT;
    v_cycle_name TEXT;
BEGIN
    -- [A] Resolve Cycle Logic (Matches academic_years which V37 uses)
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

    -- [B] Reconciliation (Ensure cache is fresh)
    BEGIN
        PERFORM public.admin_reconcile_student_account(p_student_id);
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Safety for legacy nodes
    END;

    -- [C] Core Query with Explicit Aliasing to avoid "profile_photo_url" ambiguity
    RETURN QUERY
    SELECT 
        p.id AS student_id,
        COALESCE(p.display_name, p.email)::TEXT AS display_name,
        
        -- AGGRESSIVE UNAMBIGUOUS PHOTO FETCH
        COALESCE(
            p.profile_photo_url,          -- 1. Master Profile
            sp.profile_photo_url,         -- 2. Student Profile 
            adm_node.adm_photo            -- 3. Admissions Identity
        )::TEXT AS profile_photo_url,
        
        COALESCE(sp.grade, 'N/A')::TEXT AS grade,
        COALESCE(sc.name, 'UNASSIGNED')::TEXT AS class_name,
        COALESCE(fsp.total_billed, 0)::NUMERIC AS total_billed,
        COALESCE(fsp.total_paid, 0)::NUMERIC AS total_paid,
        COALESCE(fsp.outstanding_balance, 0)::NUMERIC AS outstanding_balance,
        COALESCE(fsp.integrity_score, 100)::INTEGER AS integrity_score,
        COALESCE(fsp.unallocated_funds, 0)::NUMERIC AS unallocated_funds,
        p.is_active::BOOLEAN,
        v_cycle_id AS academic_cycle_id,
        v_cycle_name::TEXT AS cycle_name,
        COALESCE(fsp.financial_status, 'ACTIVE')::TEXT AS ledger_status,
        sp.branch_id::BIGINT,
        
        -- Derived Metrics
        (SELECT MIN(due_date) FROM public.fee_invoices WHERE student_id = p.id AND LOWER(status::text) = 'pending')::DATE AS next_due_date,
        (SELECT total_amount FROM public.fee_invoices WHERE student_id = p.id AND LOWER(status::text) = 'pending' ORDER BY due_date ASC LIMIT 1)::NUMERIC AS next_due_amount,
        COALESCE(fsp.total_billed, 0)::NUMERIC AS gross_billed,
        0::NUMERIC AS scholarship_amount -- Placeholder until scholarship engine integration v2
        
    FROM public.profiles p
    LEFT JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.finance_student_profiles fsp ON p.id = fsp.student_id
    LEFT JOIN (
        -- Subquery for admissions to absolute-isolate column names
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url AS adm_photo
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) adm_node ON p.id = adm_node.student_user_id
    WHERE p.id = p_student_id;
END;
$$;

-- [5] REBUILD: get_student_fee_summary_all (List View)
-- Ensures the dashboard also uses the unambiguous photo logic
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
    unallocated_funds NUMERIC,
    overall_status TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS student_id,
        COALESCE(p.display_name, p.email)::TEXT AS display_name,
        
        COALESCE(
            p.profile_photo_url, 
            sp.profile_photo_url, 
            adm_node.adm_photo
        )::TEXT AS profile_photo_url,
        
        COALESCE(sc.name, 'UNASSIGNED')::TEXT AS class_name,
        COALESCE(fsp.total_billed, 0)::NUMERIC AS total_billed,
        COALESCE(fsp.total_paid, 0)::NUMERIC AS total_paid,
        COALESCE(fsp.outstanding_balance, 0)::NUMERIC AS outstanding_balance,
        COALESCE(fsp.integrity_score, 100)::INTEGER AS integrity_score,
        COALESCE(fsp.unallocated_funds, 0)::NUMERIC AS unallocated_funds,
        COALESCE(fsp.financial_status, 'ACTIVE')::TEXT AS overall_status
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.finance_student_profiles fsp ON p.id = fsp.student_id
    LEFT JOIN (
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url AS adm_photo
        FROM public.admissions
        ORDER BY student_user_id, registered_at DESC
    ) adm_node ON p.id = adm_node.student_user_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND p.role = 'Student'
    ORDER BY p.display_name ASC;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Master Finance Restoration V38 (ULTRASONIC_FIX) Deployed. Ambiguity Resolved.' as status;
