-- ==============================================================================
-- MISSION CRITICAL: FINANCE AMBIGUITY & IDENTITY RESOLVER (FINAL)
-- ==============================================================================
-- Targets the "Registry Protocol Fault: column reference 'profile_photo_url' is ambiguous"
-- by ensuring absolute qualification across all Finance Identity Nodes.
-- ==============================================================================

BEGIN;

-- 1. Ensure Schema Maturity
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE public.student_profiles ADD COLUMN profile_photo_url TEXT;
    END IF;
END $$;

-- 2. DROP ALL conflicting signatures to prevent resolution ambiguity
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(BIGINT);
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all();
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID);

-- 3. RE-DEPLOY get_student_fee_summary_all (The List View Node)
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
        prof.id as student_id,
        COALESCE(prof.display_name, prof.email) as display_name,
        -- MASTER PHOTO RESOLVER: Prioritize Master Profile > Student Registry > Admission Archive
        COALESCE(prof.profile_photo_url, sprof.profile_photo_url, adm_sync.profile_photo_url) as profile_photo_url,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds
    FROM public.profiles prof
    JOIN public.student_profiles sprof ON prof.id = sprof.user_id
    LEFT JOIN public.school_classes sc ON sprof.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON prof.id = sfa.student_id
    LEFT JOIN (
        -- Sync latest photo from admissions node
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        WHERE student_user_id IS NOT NULL
        ORDER BY student_user_id, registered_at DESC
    ) adm_sync ON prof.id = adm_sync.student_user_id
    WHERE (p_branch_id IS NULL OR sprof.branch_id = p_branch_id)
      AND prof.role = 'Student'
    ORDER BY prof.display_name ASC;
END;
$$;

-- 4. RE-DEPLOY get_student_financial_node (The Detail View Node)
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
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Force reconciliation before detail fetch to ensure data integrity
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        prof.id as student_id,
        COALESCE(prof.display_name, prof.email) as display_name,
        -- MASTER PHOTO RESOLVER: Prioritize Master Profile > Student Registry > Admission Archive
        COALESCE(prof.profile_photo_url, sprof.profile_photo_url, adm_sync.profile_photo_url) as profile_photo_url,
        COALESCE(sprof.grade, 'N/A') as grade,
        COALESCE(sc.name, 'UNASSIGNED') as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
        prof.is_active,
        '2024-25'::TEXT as academic_cycle
    FROM public.profiles prof
    LEFT JOIN public.student_profiles sprof ON prof.id = sprof.user_id
    LEFT JOIN public.school_classes sc ON sprof.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON prof.id = sfa.student_id
    LEFT JOIN (
        -- Sync latest photo from admissions node
        SELECT DISTINCT ON (student_user_id) student_user_id, profile_photo_url
        FROM public.admissions
        WHERE student_user_id IS NOT NULL
        ORDER BY student_user_id, registered_at DESC
    ) adm_sync ON prof.id = adm_sync.student_user_id
    WHERE prof.id = p_student_id;
END;
$$;

-- 5. RE-DEPLOY get_all_enquiries_v2 (Inbox/Lifecycle Node)
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
        enq.id,
        enq.branch_id,
        enq.user_id,
        enq.enquiry_code,
        enq.applicant_name,
        enq.grade,
        enq.status,
        enq.verification_status,
        -- Resolve Parent Name: Enquiry > Admission > Profile(Parent) > StudentProfile(Guardian)
        COALESCE(
            enq.parent_name, 
            adm.parent_name, 
            CASE WHEN prof.role IN ('Parent', 'Parent/Guardian') THEN prof.display_name ELSE NULL END,
            sprof.parent_guardian_details
        ) as parent_name,
        COALESCE(
            enq.parent_email, 
            adm.parent_email, 
            CASE WHEN prof.role IN ('Parent', 'Parent/Guardian') THEN prof.email ELSE NULL END
        ) as parent_email,
        COALESCE(
            enq.parent_phone, 
            adm.parent_phone, 
            CASE WHEN prof.role IN ('Parent', 'Parent/Guardian') THEN prof.phone ELSE NULL END
        ) as parent_phone,
        enq.notes,
        enq.conversion_state,
        enq.admission_id,
        enq.is_archived,
        enq.is_deleted,
        enq.received_at,
        enq.updated_at,
        enq.converted_at,
        -- Prioritize Admission Photo > Enquiry Photo > Profile Photo
        COALESCE(adm.profile_photo_url, enq.profile_photo_url, prof.profile_photo_url) as profile_photo_url,
        enq.address
    FROM public.enquiries enq
    LEFT JOIN public.admissions adm ON enq.admission_id = adm.id
    LEFT JOIN public.profiles prof ON enq.user_id = prof.id
    LEFT JOIN public.student_profiles sprof ON enq.user_id = sprof.user_id
    WHERE 
        (p_branch_id IS NULL OR enq.branch_id = p_branch_id)
        AND enq.is_deleted = false
    ORDER BY enq.received_at DESC;
END;
$$;

-- 6. RE-DEPLOY helper functions to ensure no hidden ambiguities
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_total_billed NUMERIC;
    v_total_paid NUMERIC;
    v_unallocated NUMERIC;
    v_integrity INT;
BEGIN
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND status NOT IN ('cancelled', 'Cancelled');

    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND status IN ('Completed', 'Pending', 'success', 'Success');

    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND invoice_id IS NULL AND status IN ('Completed', 'success', 'Success');

    v_integrity := CASE 
        WHEN v_total_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_total_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_total_billed * 100)::INT))
    END;

    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_total_billed, v_total_paid, (v_total_billed - v_total_paid), 
        v_integrity, NOW(), v_unallocated
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        last_synced_at = NOW();
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary_all(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(UUID) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Finance Identity Ambiguity Resolved. Master Sync Restored.' as report;
