
-- =============================================================================
-- FINANCE IDENTITY & FORENSIC REGISTRY FIX (v2.0)
-- =============================================================================
-- Target: Corrects profile picture column names and enhances forensic artifacts.
-- =============================================================================

BEGIN;

-- 1. Rectify get_student_financial_node (The Detail View Engine)
CREATE OR REPLACE FUNCTION public.get_student_financial_node(p_student_id UUID)
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
    academic_cycle TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Reconcile state before retrieval
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        p.id as student_id,
        p.display_name,
        p.profile_photo_url,
        COALESCE(sp.grade, 'N/A') as grade,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
        p.is_active,
        '2023-24'::TEXT as academic_cycle -- Should be dynamic in full production
    FROM public.profiles p
    LEFT JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE p.id = p_student_id;
END;
$$;

-- 2. Rectify get_student_financial_nodes (The Account List Engine)
-- Ensuring the frontend gets the correct photo URL in the list view too.
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
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as student_id,
        p.display_name,
        p.profile_photo_url,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
      AND p.role = 'Student'
    ORDER BY p.display_name ASC;
END;
$$;

-- 3. Standardize Finance Governance Audit (Forensic Registry)
-- Ensure columns required by StudentFinanceDetailView exist.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_governance_audit' AND column_name = 'action_type') THEN
        ALTER TABLE public.finance_governance_audit ADD COLUMN action_type TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_governance_audit' AND column_name = 'description') THEN
        ALTER TABLE public.finance_governance_audit ADD COLUMN description TEXT;
    END IF;
END $$;

-- Update action_type based on existing action column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_governance_audit' AND column_name = 'action') THEN
        UPDATE public.finance_governance_audit SET action_type = action WHERE action_type IS NULL;
    END IF;
END $$;

COMMIT;
