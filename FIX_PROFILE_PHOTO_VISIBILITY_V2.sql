
-- =============================================================================
-- FINANCE PROFILE PHOTO VISIBILITY REPAIR (V2)
-- =============================================================================
-- Target: Fixes "Unable to see profile photo" in Student Finance Detail View.
-- Action: 1. Adds missing columns. 2. Syncs photo data. 3. Updates Fetch RPC.
-- =============================================================================

BEGIN;

-- 1. [SCHEMA] Ensure 'student_profiles' has the photo column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.student_profiles ADD COLUMN profile_photo_url TEXT;
    END IF;
END $$;

-- 2. [DATA SYNC] Propagate Photos from Admissions to Profiles & Student Profiles
-- Sync to Main Profile (User Identity)
UPDATE public.profiles p
SET profile_photo_url = a.profile_photo_url
FROM public.admissions a
WHERE p.id = a.student_user_id
  AND p.profile_photo_url IS NULL
  AND a.profile_photo_url IS NOT NULL;

-- Sync to Student Profile (Academic Extension)
UPDATE public.student_profiles sp
SET profile_photo_url = a.profile_photo_url
FROM public.admissions a
WHERE sp.user_id = a.student_user_id
  AND sp.profile_photo_url IS NULL
  AND a.profile_photo_url IS NOT NULL;

-- 3. [RPC FIX] get_student_financial_node (Detail View)
-- Now explicitly checks all 3 potential sources for the photo.
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id UUID DEFAULT NULL
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
    academic_cycle_id UUID,
    cycle_name TEXT,
    ledger_status TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_cycle_id UUID;
    v_cycle_name TEXT;
BEGIN
    -- Resolve Cycle Context
    IF p_cycle_id IS NULL THEN
        SELECT id, name INTO v_cycle_id, v_cycle_name 
        FROM public.academic_cycles 
        WHERE status = 'active'
        LIMIT 1;
    ELSE
        v_cycle_id := p_cycle_id;
        SELECT name INTO v_cycle_name FROM public.academic_cycles WHERE id = p_cycle_id;
    END IF;

    -- Fallback if no cycle found
    IF v_cycle_id IS NULL THEN
        v_cycle_name := 'N/A';
    END IF;

    -- Ensure Ledger State is Reconciled (Using existing V1 reconciler for safety)
    PERFORM public.admin_reconcile_student_account(p_student_id);
    
    -- Future: Implement admin_reconcile_student_ledger(p_student_id, v_cycle_id)

    RETURN QUERY
    SELECT 
        p.id as student_id,
        COALESCE(p.display_name, p.email) as display_name,
        -- CRITICAL FIX: The Multi-Layer Coalesce
        COALESCE(p.profile_photo_url, sp.profile_photo_url, a.profile_photo_url) as profile_photo_url,
        COALESCE(sp.grade, 'N/A') as grade,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        -- Use Summary Account (sfa) for stability until Ledger is fully live
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
        p.is_active,
        v_cycle_id as academic_cycle_id,
        v_cycle_name as cycle_name,
        'ACTIVE'::TEXT as ledger_status
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

COMMIT;

SELECT 'SUCCESS: Profile Photo Visibility Logic Repaired and Data Synced.' as result;
