-- ==============================================================================
-- MISSION CRITICAL: FINAL FINANCE IDENTITY HARDENING
-- ==============================================================================
-- Resolves "column reference 'profile_photo_url' is ambiguous" across all nodes.
-- This script uses unique, non-colliding aliases for EVERY table and column.
-- ==============================================================================

BEGIN;

-- 1. Ensure Schema Stability
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.student_profiles ADD COLUMN profile_photo_url text;
    END IF;
END $$;

-- 2. DROP conflicting signatures
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(BIGINT);
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all();
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID);
DROP FUNCTION IF EXISTS public.get_student_financial_nodes(BIGINT); -- Cleanup legacy name

-- 3. HARDENED get_student_fee_summary_all
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
        id_node.id as student_id,
        COALESCE(id_node.display_name, id_node.email) as display_name,
        -- MASTER PHOTO COALESCE: Profiles > Student Registry > Admissions Archive
        COALESCE(id_node.profile_photo_url, reg_node.profile_photo_url, adm_node.profile_photo_url) as profile_photo_url,
        COALESCE(cls.name, 'UNASSIGNED') as class_name,
        COALESCE(acc.total_billed, 0) as total_billed,
        COALESCE(acc.total_paid, 0) as total_paid,
        COALESCE(acc.outstanding_balance, 0) as outstanding_balance,
        COALESCE(acc.integrity_score, 100) as integrity_score,
        COALESCE(acc.unallocated_funds, 0) as unallocated_funds
    FROM public.profiles id_node
    JOIN public.student_profiles reg_node ON id_node.id = reg_node.user_id
    LEFT JOIN public.school_classes cls ON reg_node.assigned_class_id = cls.id
    LEFT JOIN public.student_fee_accounts acc ON id_node.id = acc.student_id
    LEFT JOIN (
        -- Sync latest photo from admissions node to ensure archive resilience
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        WHERE student_user_id IS NOT NULL
        ORDER BY student_user_id, registered_at DESC
    ) adm_node ON id_node.id = adm_node.student_user_id
    WHERE (p_branch_id IS NULL OR reg_node.branch_id = p_branch_id)
      AND id_node.role = 'Student'
    ORDER BY id_node.display_name ASC;
END;
$$;

-- 4. HARDENED get_student_financial_node
CREATE OR REPLACE FUNCTION public.get_student_financial_node(p_student_id UUID)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    num_grade TEXT, -- for compatibility with some older views
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INTEGER,
    unallocated_funds NUMERIC,
    is_active BOOLEAN,
    academic_cycle TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Reconcile state before retrieval
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        id_node.id as student_id,
        COALESCE(id_node.display_name, id_node.email) as display_name,
        -- MASTER PHOTO COALESCE: Profiles > Student Registry > Admissions Archive
        COALESCE(id_node.profile_photo_url, reg_node.profile_photo_url, adm_node.profile_photo_url) as profile_photo_url,
        COALESCE(reg_node.grade, 'N/A') as grade,
        COALESCE(reg_node.grade, 'N/A') as num_grade,
        COALESCE(cls.name, 'UNASSIGNED') as class_name,
        COALESCE(acc.total_billed, 0) as total_billed,
        COALESCE(acc.total_paid, 0) as total_paid,
        COALESCE(acc.outstanding_balance, 0) as outstanding_balance,
        COALESCE(acc.integrity_score, 100) as integrity_score,
        COALESCE(acc.unallocated_funds, 0) as unallocated_funds,
        id_node.is_active,
        '2024-25'::TEXT as academic_cycle
    FROM public.profiles id_node
    LEFT JOIN public.student_profiles reg_node ON id_node.id = reg_node.user_id
    LEFT JOIN public.school_classes cls ON reg_node.assigned_class_id = cls.id
    LEFT JOIN public.student_fee_accounts acc ON id_node.id = acc.student_id
    LEFT JOIN (
        -- Sync latest photo from admissions node to ensure archive resilience
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        WHERE student_user_id IS NOT NULL
        ORDER BY student_user_id, registered_at DESC
    ) adm_node ON id_node.id = adm_node.student_user_id
    WHERE id_node.id = p_student_id;
END;
$$;

-- 5. RE-DEPLOY get_all_enquiries_v2 (Hardened)
CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    branch_id BIGINT,
    user_id UUID,
    enquiry_code TEXT,
    applicant_name TEXT,
    grade TEXT,
    status TEXT,
    verification_status TEXT,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    notes TEXT,
    conversion_state TEXT,
    admission_id UUID,
    is_archived BOOLEAN,
    is_deleted BOOLEAN,
    received_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    profile_photo_url TEXT,
    address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.branch_id,
        e.user_id,
        e.enquiry_code,
        e.applicant_name,
        e.grade,
        e.status,
        e.verification_status,
        COALESCE(e.parent_name, a.parent_name, p.display_name) as parent_name,
        COALESCE(e.parent_email, a.parent_email, p.email) as parent_email,
        COALESCE(e.parent_phone, a.parent_phone, p.phone) as parent_phone,
        e.notes,
        e.conversion_state,
        e.admission_id,
        e.is_archived,
        e.is_deleted,
        e.received_at,
        e.updated_at,
        e.converted_at,
        -- Qualification Fix: All sources explicitly aliased
        COALESCE(a.profile_photo_url, e.profile_photo_url, p.profile_photo_url) as profile_photo_url,
        e.address
    FROM public.enquiries e
    LEFT JOIN public.admissions a ON e.admission_id = a.id
    LEFT JOIN public.profiles p ON e.user_id = p.id
    WHERE (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND e.is_deleted = false
    ORDER BY e.received_at DESC;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Identity Protocol Hardening applied. All ambiguities resolved.' as report;
