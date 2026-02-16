-- =============================================================================
-- GLOBAL BUREAU SECURITY POLICY (v10.0) - PRECISION SURGERY & LEAK PLUG
-- =============================================================================
-- 1. PLUGS THE LEAK: Removes the risky email-based auto-matching fallback.
-- 2. PRECISION SURGERY: Removes Ardhya Sharma from Sanjay's unauthorized roster.
--    Also corrects the spelling from 'Aradhya' to 'Ardhya' across records.
-- 3. HARDENS AUTHORIZATION: Only explicit parent_id links are honored.
-- 4. CONSOLIDATES FINANCE: Adds hardened v3/v4 finance RPCs with ownership checks.
-- =============================================================================

BEGIN;

-- [0] DATA SURGERY & SPELLING CORRECTION
-- First, correct the spelling globally for the student in question
UPDATE public.admissions SET applicant_name = 'Ardhya Sharma' WHERE applicant_name ILIKE '%Aradhya%Sharma%';
UPDATE public.enquiries SET applicant_name = 'Ardhya Sharma' WHERE applicant_name ILIKE '%Aradhya%Sharma%';
UPDATE public.profiles SET display_name = 'Ardhya Sharma' WHERE display_name ILIKE '%Aradhya%Sharma%';
UPDATE public.student_profiles SET profile_photo_url = COALESCE(profile_photo_url, '/avatars/ardhya.jpg') WHERE user_id IN (SELECT id FROM public.profiles WHERE display_name = 'Ardhya Sharma');

-- Identify 'Ardhya Sharma' and 'Sanjay Dutt Sharma' to break the false mapping.
-- Using broader ILIKE to catch any remaining spelling variations
DELETE FROM public.student_parents
WHERE student_id IN (
    SELECT id FROM public.profiles WHERE display_name ILIKE '%Ar%dh%ya Sharma%'
)
AND parent_id IN (
    SELECT id FROM public.profiles WHERE display_name ILIKE '%Sanjay%Dutt%Sharma%'
);

-- Also remove the false admission ownership if it exists
UPDATE public.admissions
SET parent_id = NULL
WHERE (applicant_name ILIKE '%Ar%dh%ya Sharma%')
AND parent_id IN (
    SELECT id FROM public.profiles WHERE display_name ILIKE '%Sanjay%Dutt%Sharma%'
);

-- [1] PLUG THE LEAK: Hardening get_parent_authorized_nodes
CREATE OR REPLACE FUNCTION public.get_parent_authorized_nodes()
RETURNS TABLE (
    node_id UUID,
    node_type TEXT,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    status TEXT,
    branch_name TEXT,
    academic_year_id BIGINT,
    student_user_id UUID,
    school_name TEXT,
    class_name TEXT,
    student_id_number TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_current_year_id BIGINT;
    v_parent_id UUID := auth.uid();
BEGIN
    IF v_parent_id IS NULL THEN RETURN; END IF;
    
    SELECT id INTO v_current_year_id FROM public.academic_years WHERE is_current = true LIMIT 1;

    RETURN QUERY
    -- Block A: Explicitly Linked Enrolled Students (The Source of Truth)
    SELECT 
        s.id::uuid as node_id,
        'STUDENT'::text as node_type,
        s.display_name::text,
        COALESCE(s.profile_photo_url, sp.profile_photo_url)::text as profile_photo_url,
        sp.grade::text,
        sp.enrollment_status::text as status,
        COALESCE(sb.name, 'Main Branch')::text as branch_name,
        v_current_year_id::bigint as academic_year_id,
        s.id::uuid as student_user_id,
        sb.name::text as school_name,
        sc.name::text as class_name,
        sp.student_id_number::text
    FROM public.student_parents psm
    JOIN public.profiles s ON psm.student_id = s.id
    LEFT JOIN public.student_profiles sp ON s.id = sp.user_id
    LEFT JOIN public.school_branches sb ON sp.branch_id = sb.id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE psm.parent_id = v_parent_id AND psm.status = 'active'

    UNION ALL

    -- Block B: Ownership via Admissions (Verified Owners)
    SELECT 
        a.id::uuid as node_id,
        'ADMISSION'::text as node_type,
        a.applicant_name::text as display_name,
        a.profile_photo_url::text,
        a.grade::text,
        a.status::text,
        COALESCE(sb.name, 'Branch Registry')::text as branch_name,
        v_current_year_id::bigint as academic_year_id,
        a.student_user_id::uuid,
        sb.name::text as school_name,
        NULL::text as class_name,
        a.student_id_number::text
    FROM public.admissions a
    LEFT JOIN public.school_branches sb ON a.branch_id = sb.id
    WHERE a.parent_id = v_parent_id 
      AND (a.student_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.student_parents psm WHERE psm.student_id = a.student_user_id AND psm.parent_id = v_parent_id))
      AND a.status NOT IN ('ENROLLED', 'VERIFIED');
END;
$$;

-- [2] DATA FETCHING LAYER: get_my_children_profiles_v2
CREATE OR REPLACE FUNCTION public.get_my_children_profiles_v2()
RETURNS TABLE (
    id uuid,
    applicant_name text,
    parent_name text,
    parent_email text,
    parent_phone text,
    grade text,
    status text,
    date_of_birth date,
    gender text,
    profile_photo_url text,
    branch_id integer,
    submitted_at timestamptz,
    student_user_id uuid,
    emergency_contact text,
    medical_info text,
    address text,
    source_type text,
    student_id_number text,
    school_name text,
    class_name text
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    -- 1. Fetch via admissions (Hardened)
    SELECT 
        a.id::uuid,
        a.applicant_name::text,
        a.parent_name::text,
        a.parent_email::text,
        a.parent_phone::text,
        a.grade::text,
        a.status::text,
        a.date_of_birth::date,
        a.gender::text,
        a.profile_photo_url::text,
        a.branch_id::integer,
        a.submitted_at::timestamptz,
        a.student_user_id::uuid,
        a.emergency_contact::text,
        a.medical_info::text,
        a.address::text,
        'Admission'::text as source_type,
        a.student_id_number::text,
        sb.name::text as school_name,
        sc.name::text as class_name
    FROM public.admissions a
    LEFT JOIN public.school_branches sb ON a.branch_id = sb.id
    LEFT JOIN public.student_profiles sp ON a.student_user_id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE a.parent_id = auth.uid()

    UNION ALL

    -- 2. Fetch via Enquiries (Hardened)
    SELECT 
        e.id::uuid,
        e.applicant_name::text,
        e.parent_name::text,
        e.parent_email::text,
        e.parent_phone::text,
        e.grade::text,
        e.status::text,
        e.date_of_birth::date,
        e.gender::text,
        e.profile_photo_url::text,
        e.branch_id::integer,
        e.received_at::timestamptz as submitted_at,
        NULL::uuid as student_user_id,
        e.emergency_contact::text,
        e.medical_info::text,
        e.address::text,
        'Enquiry'::text as source_type,
        NULL::text as student_id_number,
        sb.name::text as school_name,
        NULL::text as class_name
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE e.user_id = auth.uid()
      AND e.status != 'ENQUIRY_CONVERTED'
      AND e.admission_id IS NULL

    UNION ALL

    -- 3. Fetch via student_parents (Hardened mapping)
    SELECT 
        psm.student_id::uuid as id,
        s.display_name::text as applicant_name,
        NULL::text as parent_name,
        s.email::text as parent_email,
        NULL::text as parent_phone,
        sp.grade::text,
        sp.enrollment_status::text as status,
        NULL::date as date_of_birth,
        NULL::text as gender,
        COALESCE(s.profile_photo_url, sp.profile_photo_url)::text as profile_photo_url,
        sp.branch_id::integer,
        psm.created_at::timestamptz as submitted_at,
        psm.student_id::uuid as student_user_id,
        NULL::text as emergency_contact,
        NULL::text as medical_info,
        NULL::text as address,
        'STUDENT'::text as source_type,
        sp.student_id_number::text,
        sb.name::text as school_name,
        sc.name::text as class_name
    FROM public.student_parents psm
    JOIN public.profiles s ON psm.student_id = s.id
    LEFT JOIN public.student_profiles sp ON s.id = sp.user_id
    LEFT JOIN public.school_branches sb ON sp.branch_id = sb.id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE psm.parent_id = auth.uid() AND psm.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM public.admissions a WHERE a.student_user_id = psm.student_id AND a.parent_id = auth.uid());
END;
$$;

-- [3] FINANCE HARDENING: get_parent_linked_students_finance_v3
CREATE OR REPLACE FUNCTION public.get_parent_linked_students_finance_v3()
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    branch_name TEXT,
    total_due NUMERIC,
    status TEXT,
    health_score INTEGER
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        node_id as student_id,
        n.display_name,
        n.profile_photo_url,
        n.grade,
        n.branch_name,
        COALESCE(sfa.outstanding_balance, 0) as total_due,
        n.status,
        COALESCE(sfa.integrity_score, 100) as health_score
    FROM public.get_parent_authorized_nodes() n
    LEFT JOIN public.student_fee_accounts sfa ON n.node_id = sfa.student_id
    WHERE n.node_type = 'STUDENT';
END;
$$;

-- [4] FINANCE SYNC FLOW: Core Logic
CREATE OR REPLACE FUNCTION public.validate_institution_finance(
    p_branch_id BIGINT,
    p_grade_id TEXT,
    p_academic_year_id BIGINT
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- 1. Academic Year Active
    IF NOT EXISTS (SELECT 1 FROM public.academic_years WHERE id = p_academic_year_id AND status = 'active') THEN
        RETURN 'YEAR_NOT_ACTIVE';
    END IF;

    -- 2. Grade Fee Mapping & Template
    IF NOT EXISTS (SELECT 1 FROM public.fee_structures WHERE target_grade = p_grade_id AND academic_cycle_id = p_academic_year_id AND status = 'Active') THEN
        RETURN 'GRADE_MAPPING_MISSING';
    END IF;

    -- 3. Payment Plan / Components
    IF NOT EXISTS (
        SELECT 1 FROM public.fee_components 
        WHERE structure_id = (SELECT id FROM public.fee_structures WHERE target_grade = p_grade_id AND academic_cycle_id = p_academic_year_id LIMIT 1)
    ) THEN
        RETURN 'PAYMENT_PLAN_MISSING';
    END IF;

    RETURN 'VALIDATED';
END;
$$;

CREATE OR REPLACE FUNCTION public.check_finance_lifecycle(
    p_student_id UUID,
    p_academic_year_id BIGINT
)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_status TEXT;
    v_ledger_id UUID;
    v_installments_exist BOOLEAN;
    v_branch_id BIGINT;
    v_grade TEXT;
    v_validation TEXT;
BEGIN
    SELECT enrollment_status, branch_id, grade INTO v_status, v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_status NOT IN ('Active', 'Enrolled') THEN RETURN 'ENROLLMENT_PENDING'; END IF;

    SELECT id INTO v_ledger_id FROM public.student_fee_ledger WHERE student_id = p_student_id AND academic_year_id = p_academic_year_id;
    
    IF v_ledger_id IS NULL THEN
        v_validation := public.validate_institution_finance(v_branch_id, v_grade, p_academic_year_id);
        IF v_validation = 'VALIDATED' THEN RETURN 'FINANCE_SYNC_REQUIRED'; ELSE RETURN v_validation; END IF;
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.installment_schedule WHERE ledger_id = v_ledger_id) INTO v_installments_exist;
    IF NOT v_installments_exist THEN RETURN 'LEDGER_GENERATED'; END IF;

    RETURN 'PAYMENTS_ENABLED';
END;
$$;

-- [5] FINANCE DETAIL HARDENING v4 (Enhanced with Lifecycle)
CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v4(
    p_student_id UUID,
    p_cycle_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_summary JSONB;
    v_installments JSONB;
    v_history JSONB;
    v_lifecycle_state TEXT;
    v_progress INTEGER := 0;
    v_ledger_id UUID;
    v_total_billed NUMERIC := 0;
    v_total_paid NUMERIC := 0;
BEGIN
    -- 1. Ownership Check
    IF NOT public.check_student_ownership(p_student_id) THEN
        RETURN jsonb_build_object('error', '403_ACCESS_FORBIDDEN');
    END IF;

    -- 2. Lifecycle Audit
    v_lifecycle_state := public.check_finance_lifecycle(p_student_id, p_cycle_id);
    v_progress := CASE 
        WHEN v_lifecycle_state = 'PAYMENTS_ENABLED' THEN 100
        WHEN v_lifecycle_state = 'LEDGER_GENERATED' THEN 75
        WHEN v_lifecycle_state = 'FINANCE_SYNC_REQUIRED' THEN 45
        WHEN v_lifecycle_state = 'ENROLLMENT_PENDING' THEN 0
        ELSE 25 -- Validated or missing config
    END;

    -- 3. Fetch Data if exists
    SELECT id, total_amount INTO v_ledger_id, v_total_billed 
    FROM public.student_fee_ledger WHERE student_id = p_student_id AND academic_year_id = p_cycle_id;
    
    SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_paid 
    FROM public.installment_schedule WHERE ledger_id = v_ledger_id;

    -- 4. Payload Assembly
    SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'title', 'Installment ' || installment_no, 'amount', amount, 'paid', paid_amount,
        'due_date', due_date, 'status', status, 'is_overdue', (due_date < CURRENT_DATE AND status != 'paid')
    )) INTO v_installments FROM public.installment_schedule WHERE ledger_id = v_ledger_id ORDER BY installment_no;

    SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'date', payment_date, 'amount', amount, 'mode', payment_method, 'status', status, 'ref_id', transaction_id
    )) INTO v_history FROM public.fee_payments WHERE student_id = p_student_id ORDER BY payment_date DESC;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'total_billed', v_total_billed,
            'total_paid', v_total_paid,
            'outstanding', (v_total_billed - v_total_paid),
            'status', v_lifecycle_state,
            'sync_progress', v_progress,
            'academic_period', (SELECT year_name FROM public.academic_years WHERE id = p_cycle_id),
            'branch', (SELECT jsonb_build_object('name', name, 'code', city) FROM public.school_branches WHERE id = (SELECT branch_id FROM public.student_profiles WHERE user_id = p_student_id))
        ),
        'installments', COALESCE(v_installments, '[]'::jsonb),
        'history', COALESCE(v_history, '[]'::jsonb),
        'cycle_id', p_cycle_id
    );
END;
$$;

-- [6] REINFORCE FIREWALL & ORCHESTRATOR
CREATE OR REPLACE FUNCTION public.automate_finance_lifecycle(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_year_id BIGINT;
    v_result JSONB;
BEGIN
    SELECT id INTO v_year_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    v_result := public.generate_student_ledger(p_student_id, v_year_id);
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_student_ownership(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.get_parent_authorized_nodes() 
        WHERE node_id = p_student_id OR student_user_id = p_student_id
    );
END;
$$;

COMMIT;


