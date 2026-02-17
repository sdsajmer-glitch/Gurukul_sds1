-- =============================================================================
-- FINANCE ECOSYSTEM STABILITY PROTOCOL (v13.0) — FULL FLOW CONSOLIDATION
-- =============================================================================
-- OBJECTIVE: Make the ENTIRE Finance Flow operational end-to-end:
--   Student Selection → Academic Year → Fee Validation → Ledger Generation →
--   Installment Schedule → Payment Enablement → Receipt Upload → Reconciliation
--
-- FIXES CONSOLIDATED FROM V11/V12 + NEW ENHANCEMENTS:
--   1. Case-insensitive status matching in ALL validators
--   2. Fuzzy grade matching ("Class 4" ↔ "4" normalization)
--   3. Fee Breakdown in v4 detail response
--   4. Robust lifecycle automation with proper validation
--   5. Payment receipt submission with ledger linkage
--   6. Installment schedule generation with configurable terms
--   7. Account reconciliation after every mutation
--   8. Audit logging for all financial events
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [0] FIREWALL: STATUS HARMONIZATION (Case-Insensitive Protocol)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Normalize all status values for state-machine stability
-- NOTE: fee_structures.state CHECK constraint expects UPPERCASE: ('DRAFT','VALIDATED','ACTIVE','LOCKED','ARCHIVED')
-- NOTE: fee_structures.status is a separate column (lowercase convention)
UPDATE public.academic_years SET status = LOWER(status::text)::academic_year_status
WHERE status::text != LOWER(status::text);

UPDATE public.fee_structures SET status = 'active'
WHERE LOWER(status::text) IN ('active') AND status::text != 'active';

-- State column uses UPPERCASE convention per CHECK constraint
UPDATE public.fee_structures SET state = 'ACTIVE'
WHERE state IS NOT NULL AND UPPER(state::text) = 'ACTIVE' AND state::text != 'ACTIVE';

UPDATE public.student_fee_ledger SET status = 'active'
WHERE (LOWER(status::text) IN ('active') OR status IS NULL) AND COALESCE(status::text,'') != 'active';


-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE: validate_institution_finance (CASE-INSENSITIVE + FUZZY GRADE)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_institution_finance(
    p_branch_id BIGINT,
    p_grade_id TEXT,
    p_academic_year_id BIGINT
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_normalized_grade TEXT;
    v_structure_id BIGINT;
BEGIN
    -- Normalize grade: strip "Class " prefix for fuzzy matching
    v_normalized_grade := TRIM(REPLACE(REPLACE(p_grade_id, 'Class ', ''), 'class ', ''));

    -- 1. Academic Year must be Active or Current (case-insensitive)
    IF NOT EXISTS (
        SELECT 1 FROM public.academic_years 
        WHERE id = p_academic_year_id 
        AND LOWER(status::text) IN ('active', 'current')
    ) THEN
        RETURN 'YEAR_NOT_ACTIVE';
    END IF;

    -- 2. Grade Fee Structure must exist with fuzzy matching + case-insensitive status
    -- state column uses UPPERCASE ('ACTIVE'), status column uses lowercase ('active')
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = p_academic_year_id 
    AND (
        LOWER(COALESCE(status::text, '')) = 'active' 
        OR UPPER(COALESCE(state::text, '')) = 'ACTIVE'
    )
    AND (
        target_grade = p_grade_id 
        OR target_grade = v_normalized_grade
        OR TRIM(REPLACE(REPLACE(target_grade, 'Class ', ''), 'class ', '')) = v_normalized_grade
    )
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN 'GRADE_MAPPING_MISSING';
    END IF;

    -- 3. Fee Components must exist for this structure
    IF NOT EXISTS (
        SELECT 1 FROM public.fee_components WHERE structure_id = v_structure_id
    ) THEN
        RETURN 'PAYMENT_PLAN_MISSING';
    END IF;

    RETURN 'VALIDATED';
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] CORE: validate_finance_readiness (Simplified proxy)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_finance_readiness(
    p_student_id UUID,
    p_branch_id BIGINT,
    p_academic_year_id BIGINT
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_grade TEXT;
BEGIN
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    RETURN public.validate_institution_finance(p_branch_id, COALESCE(v_grade, ''), p_academic_year_id);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [3] CORE: is_payment_enabled (Hardened Check)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_payment_enabled(
    p_student_id UUID,
    p_academic_year_id BIGINT
)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_ledger_id UUID;
    v_cycle_status TEXT;
BEGIN
    -- 1. Academic cycle must be active
    SELECT status::text INTO v_cycle_status FROM public.academic_years WHERE id = p_academic_year_id;
    IF v_cycle_status IS NULL OR (LOWER(v_cycle_status) NOT IN ('active', 'current')) THEN
        RETURN FALSE;
    END IF;

    -- 2. Ledger must exist
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND academic_year_id = p_academic_year_id;
    
    IF v_ledger_id IS NULL THEN RETURN FALSE; END IF;

    -- 3. Installments must exist
    RETURN EXISTS (SELECT 1 FROM public.installment_schedule WHERE ledger_id = v_ledger_id);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [4] CORE: generate_installments (Configurable Term Split)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.generate_installments(p_ledger_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_amount NUMERIC;
    v_academic_year_id BIGINT;
    v_year_start DATE;
    v_term_count INTEGER := 4;  -- Default: Quarterly
    v_per_term NUMERIC;
    v_remainder NUMERIC;
    i INTEGER;
BEGIN
    -- Fetch ledger context
    SELECT total_amount, academic_year_id INTO v_total_amount, v_academic_year_id
    FROM public.student_fee_ledger WHERE id = p_ledger_id;
    
    IF v_total_amount IS NULL OR v_total_amount <= 0 THEN RETURN; END IF;

    -- Get academic year start date
    SELECT COALESCE(start_date, CURRENT_DATE) INTO v_year_start
    FROM public.academic_years WHERE id = v_academic_year_id;

    -- Clear existing installments for this ledger (idempotent)
    DELETE FROM public.installment_schedule WHERE ledger_id = p_ledger_id AND paid_amount = 0;

    -- Check if any exist already (partial payments - don't regenerate)
    IF EXISTS (SELECT 1 FROM public.installment_schedule WHERE ledger_id = p_ledger_id) THEN
        RETURN;
    END IF;

    -- Calculate split
    v_per_term := FLOOR(v_total_amount / v_term_count);
    v_remainder := v_total_amount - (v_per_term * v_term_count);

    -- Generate installments
    FOR i IN 1..v_term_count LOOP
        INSERT INTO public.installment_schedule (
            ledger_id, installment_no, amount, paid_amount, due_date, status
        ) VALUES (
            p_ledger_id,
            i,
            CASE WHEN i = 1 THEN v_per_term + v_remainder ELSE v_per_term END,
            0,
            v_year_start + ((i - 1) * 90 * INTERVAL '1 day')::INTERVAL,
            'pending'
        );
    END LOOP;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [5] CORE: generate_student_ledger (Fuzzy Match + Case-Insensitive)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_branch_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_structure_id BIGINT;
    v_total_fee NUMERIC := 0;
    v_ledger_id UUID;
    v_validation TEXT;
BEGIN
    -- 1. Fetch Student Context
    SELECT branch_id, grade INTO v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_NOT_FOUND');
    END IF;

    v_normalized_grade := TRIM(REPLACE(REPLACE(v_grade, 'Class ', ''), 'class ', ''));
    
    -- 2. Validate readiness
    v_validation := public.validate_institution_finance(v_branch_id, v_grade, p_academic_year_id);
    IF v_validation != 'VALIDATED' THEN
        RETURN jsonb_build_object('success', false, 'error', v_validation);
    END IF;

    -- 3. Fetch Fee Structure (Fuzzy Match)
    -- state column uses UPPERCASE ('ACTIVE'), status column uses lowercase ('active')
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = p_academic_year_id 
    AND (LOWER(COALESCE(status::text, '')) = 'active' OR UPPER(COALESCE(state::text, '')) = 'ACTIVE')
    AND (
        target_grade = v_grade 
        OR target_grade = v_normalized_grade
        OR TRIM(REPLACE(REPLACE(target_grade, 'Class ', ''), 'class ', '')) = v_normalized_grade
    )
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRADE_MAPPING_MISSING');
    END IF;

    -- 4. Calculate Total Fee from Components
    SELECT COALESCE(SUM(amount), 0) INTO v_total_fee 
    FROM public.fee_components WHERE structure_id = v_structure_id;

    IF v_total_fee <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'ZERO_FEE_AMOUNT');
    END IF;

    -- 5. UPSERT Ledger (Idempotent)
    INSERT INTO public.student_fee_ledger (
        student_id, academic_year_id, branch_id, total_amount, status
    ) VALUES (
        p_student_id, p_academic_year_id, v_branch_id, v_total_fee, 'active'
    )
    ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        status = 'active',
        updated_at = NOW()
    RETURNING id INTO v_ledger_id;

    -- 6. Generate Installment Schedule
    PERFORM public.generate_installments(v_ledger_id);

    -- 7. Reconcile Account Totals
    BEGIN
        PERFORM public.admin_reconcile_student_account(p_student_id);
    EXCEPTION WHEN OTHERS THEN
        -- Non-fatal: reconciliation is a best-effort sync
        NULL;
    END;

    -- 8. Audit Log
    INSERT INTO public.finance_audit_logs (action_type, description, metadata)
    VALUES (
        'LEDGER_GENERATED', 
        'Generated ledger for student ' || p_student_id::text,
        jsonb_build_object(
            'student_id', p_student_id,
            'academic_year_id', p_academic_year_id,
            'total_fee', v_total_fee,
            'ledger_id', v_ledger_id,
            'structure_id', v_structure_id
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'ledger_id', v_ledger_id, 
        'total_amount', v_total_fee,
        'structure_id', v_structure_id
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [6] CORE: automate_finance_lifecycle (FULL ORCHESTRATOR)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.automate_finance_lifecycle(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_year_id BIGINT;
    v_branch_id BIGINT;
    v_grade TEXT;
    v_validation TEXT;
    v_result JSONB;
BEGIN
    -- 1. Get current academic year
    SELECT id INTO v_year_id FROM public.academic_years 
    WHERE is_current = true 
    AND LOWER(status::text) IN ('active', 'current')
    LIMIT 1;
    
    IF v_year_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_ACTIVE_ACADEMIC_YEAR');
    END IF;

    -- 2. Get student context
    SELECT branch_id, grade INTO v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_PROFILE_NOT_FOUND');
    END IF;

    -- 3. Pre-validate before ledger generation
    v_validation := public.validate_institution_finance(v_branch_id, v_grade, v_year_id);
    IF v_validation != 'VALIDATED' THEN
        RETURN jsonb_build_object('success', false, 'error', v_validation, 'detail', 
            'Institutional configuration not ready: ' || v_validation);
    END IF;

    -- 4. Generate ledger + installments
    v_result := public.generate_student_ledger(p_student_id, v_year_id);
    
    RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [7] CORE: check_finance_lifecycle (Lifecycle State Machine)
-- ═══════════════════════════════════════════════════════════════════════════════
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
    -- Student enrollment check
    SELECT enrollment_status, branch_id, grade INTO v_status, v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_status IS NULL OR UPPER(v_status) NOT IN ('ACTIVE', 'ENROLLED') THEN 
        RETURN 'ENROLLMENT_PENDING'; 
    END IF;

    -- Ledger existence check
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND academic_year_id = p_academic_year_id;
    
    IF v_ledger_id IS NULL THEN
        -- Check if we COULD generate (institutional config ready?)
        v_validation := public.validate_institution_finance(v_branch_id, v_grade, p_academic_year_id);
        IF v_validation = 'VALIDATED' THEN 
            RETURN 'FINANCE_SYNC_REQUIRED'; 
        ELSE 
            RETURN v_validation; 
        END IF;
    END IF;

    -- Installment check
    SELECT EXISTS (
        SELECT 1 FROM public.installment_schedule WHERE ledger_id = v_ledger_id
    ) INTO v_installments_exist;
    
    IF NOT v_installments_exist THEN 
        RETURN 'LEDGER_GENERATED'; 
    END IF;

    RETURN 'PAYMENTS_ENABLED';
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [8] CORE: get_student_finance_detail_v4 (FULL PAYLOAD + BREAKDOWN)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v4(
    p_student_id UUID,
    p_cycle_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_summary JSONB;
    v_installments JSONB;
    v_history JSONB;
    v_breakdown JSONB;
    v_lifecycle_state TEXT;
    v_progress INTEGER := 0;
    v_ledger_id UUID;
    v_total_billed NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_structure_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_sync_phase TEXT;
BEGIN
    -- 1. Ownership Check
    IF NOT public.check_student_ownership(p_student_id) THEN
        RETURN jsonb_build_object('error', '403_ACCESS_FORBIDDEN');
    END IF;

    -- 2. Lifecycle State Audit
    v_lifecycle_state := public.check_finance_lifecycle(p_student_id, p_cycle_id);
    v_progress := CASE 
        WHEN v_lifecycle_state = 'PAYMENTS_ENABLED' THEN 100
        WHEN v_lifecycle_state = 'LEDGER_GENERATED' THEN 75
        WHEN v_lifecycle_state = 'FINANCE_SYNC_REQUIRED' THEN 50
        WHEN v_lifecycle_state = 'ENROLLMENT_PENDING' THEN 10
        WHEN v_lifecycle_state = 'YEAR_NOT_ACTIVE' THEN 15
        WHEN v_lifecycle_state = 'GRADE_MAPPING_MISSING' THEN 25
        WHEN v_lifecycle_state = 'PAYMENT_PLAN_MISSING' THEN 35
        ELSE 20
    END;

    v_sync_phase := CASE 
        WHEN v_lifecycle_state = 'PAYMENTS_ENABLED' THEN 'OPERATIONAL'
        WHEN v_lifecycle_state = 'LEDGER_GENERATED' THEN 'INSTALLMENT_PENDING'
        WHEN v_lifecycle_state = 'FINANCE_SYNC_REQUIRED' THEN 'SYNC_READY'
        WHEN v_lifecycle_state = 'ENROLLMENT_PENDING' THEN 'ENROLLMENT_HOLD'
        ELSE 'VERIFICATION'
    END;

    -- 3. Fetch Ledger Data (if exists)
    SELECT id, total_amount INTO v_ledger_id, v_total_billed 
    FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND academic_year_id = p_cycle_id;
    
    SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_paid 
    FROM public.installment_schedule WHERE ledger_id = v_ledger_id;

    -- 4. Installment Schedule
    SELECT jsonb_agg(row_data ORDER BY inst_no) INTO v_installments
    FROM (
        SELECT jsonb_build_object(
            'id', id, 
            'title', 'Installment ' || installment_no, 
            'amount', amount, 
            'paid', paid_amount,
            'due_date', due_date, 
            'status', status, 
            'is_overdue', (due_date < CURRENT_DATE AND LOWER(status) != 'paid')
        ) as row_data, installment_no as inst_no
        FROM public.installment_schedule 
        WHERE ledger_id = v_ledger_id 
        ORDER BY installment_no
    ) sub;

    -- 5. Payment History
    SELECT jsonb_agg(jsonb_build_object(
        'id', id, 
        'date', payment_date, 
        'amount', amount, 
        'mode', payment_method, 
        'status', status, 
        'ref_id', transaction_id
    ) ORDER BY payment_date DESC) INTO v_history 
    FROM public.fee_payments 
    WHERE student_id = p_student_id;

    -- 6. Fee Breakdown (Components from Grade Structure)
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    v_normalized_grade := TRIM(REPLACE(REPLACE(COALESCE(v_grade, ''), 'Class ', ''), 'class ', ''));
    
    -- state column uses UPPERCASE ('ACTIVE'), status column uses lowercase ('active')
    SELECT id INTO v_structure_id FROM public.fee_structures 
    WHERE academic_cycle_id = p_cycle_id 
    AND (LOWER(COALESCE(status::text, '')) = 'active' OR UPPER(COALESCE(state::text, '')) = 'ACTIVE')
    AND (
        target_grade = v_grade 
        OR target_grade = v_normalized_grade
        OR TRIM(REPLACE(REPLACE(target_grade, 'Class ', ''), 'class ', '')) = v_normalized_grade
    )
    LIMIT 1;

    SELECT jsonb_agg(jsonb_build_object(
        'name', name,
        'amount', amount,
        'type', 'Academic Fee',
        'frequency', COALESCE(frequency, 'Annual')
    )) INTO v_breakdown
    FROM public.fee_components 
    WHERE structure_id = v_structure_id;

    -- 7. Assemble Full Payload
    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'total_billed', COALESCE(v_total_billed, 0),
            'total_paid', COALESCE(v_total_paid, 0),
            'outstanding', COALESCE(v_total_billed, 0) - COALESCE(v_total_paid, 0),
            'status', v_lifecycle_state,
            'sync_progress', v_progress,
            'sync_phase', v_sync_phase,
            'grade', v_grade,
            'academic_period', (SELECT year_name FROM public.academic_years WHERE id = p_cycle_id),
            'branch', (
                SELECT jsonb_build_object(
                    'name', name, 
                    'code', COALESCE(city, 'HQ'),
                    'address', address,
                    'city', city
                ) 
                FROM public.school_branches 
                WHERE id = (SELECT branch_id FROM public.student_profiles WHERE user_id = p_student_id)
            )
        ),
        'installments', COALESCE(v_installments, '[]'::jsonb),
        'breakdown', COALESCE(v_breakdown, '[]'::jsonb),
        'history', COALESCE(v_history, '[]'::jsonb),
        'cycle_id', p_cycle_id
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [9] REPORTING: get_student_financial_node (Cycle-Aware)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID);
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    grade TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INT,
    profile_photo_url TEXT,
    is_active BOOLEAN,
    is_standby BOOLEAN,
    unallocated_funds NUMERIC,
    academic_cycle_id BIGINT,
    branch_id BIGINT,
    ledger_status TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_cycle_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            p.id as student_id,
            p.display_name,
            sp.grade,
            sc.name as class_name,
            COALESCE(sfl.total_amount, 0) as total_billed,
            COALESCE((SELECT SUM(ins.paid_amount) FROM public.installment_schedule ins WHERE ins.ledger_id = sfl.id), 0) as total_paid,
            COALESCE(sfl.total_amount, 0) - COALESCE((SELECT SUM(ins.paid_amount) FROM public.installment_schedule ins WHERE ins.ledger_id = sfl.id), 0) as outstanding_balance,
            CASE 
                WHEN sfl.total_amount > 0 THEN 
                    LEAST(100, FLOOR((COALESCE((SELECT SUM(ins.paid_amount) FROM public.installment_schedule ins WHERE ins.ledger_id = sfl.id), 0) / sfl.total_amount) * 100))::INT
                ELSE 100 
            END as integrity_score,
            COALESCE(p.profile_photo_url, sp.profile_photo_url)::text as profile_photo_url,
            p.is_active,
            (sfl.id IS NULL) as is_standby,
            COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
            sfl.academic_year_id as academic_cycle_id,
            sp.branch_id,
            COALESCE(sfl.status, 'NO_LEDGER')::text as ledger_status
        FROM public.profiles p
        JOIN public.student_profiles sp ON p.id = sp.user_id
        LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
        LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
        LEFT JOIN public.student_fee_ledger sfl ON p.id = sfl.student_id AND sfl.academic_year_id = p_cycle_id
        WHERE p.id = p_student_id;
    ELSE
        -- Global View
        BEGIN
            PERFORM public.admin_reconcile_student_account(p_student_id);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        
        RETURN QUERY
        SELECT 
            p.id as student_id,
            p.display_name,
            sp.grade,
            sc.name as class_name,
            COALESCE(sfa.total_billed, 0) as total_billed,
            COALESCE(sfa.total_paid, 0) as total_paid,
            COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
            COALESCE(sfa.integrity_score, 100) as integrity_score,
            COALESCE(p.profile_photo_url, sp.profile_photo_url)::text as profile_photo_url,
            p.is_active,
            (COALESCE(sfa.total_billed, 0) = 0) as is_standby,
            COALESCE(sfa.unallocated_funds, 0) as unallocated_funds,
            NULL::BIGINT as academic_cycle_id,
            sp.branch_id,
            'GLOBAL_VIEW'::text as ledger_status
        FROM public.profiles p
        JOIN public.student_profiles sp ON p.id = sp.user_id
        LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
        LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
        WHERE p.id = p_student_id;
    END IF;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [10] REPORTING: get_student_running_ledger (Cycle-Filtered Forensic Ledger)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID);
CREATE OR REPLACE FUNCTION public.get_student_running_ledger(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    transaction_date TIMESTAMPTZ,
    identifier TEXT,
    description TEXT,
    debit NUMERIC,
    credit NUMERIC,
    running_balance NUMERIC,
    protocol TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH raw_entries AS (
        -- Debits (Ledger entries)
        SELECT 
            sfl.created_at as t_date,
            'LEDGER-' || sfl.academic_year_id::TEXT as idnt,
            'Tuition Fees (' || ay.year_name || ')' as descr,
            sfl.total_amount as dbt,
            0::NUMERIC as crdt,
            'ACADEMIC_CYCLE' as prot
        FROM public.student_fee_ledger sfl
        JOIN public.academic_years ay ON sfl.academic_year_id = ay.id
        WHERE sfl.student_id = p_student_id
        AND (p_cycle_id IS NULL OR sfl.academic_year_id = p_cycle_id)

        UNION ALL

        -- Credits (Payments)
        SELECT 
            fp.payment_date as t_date,
            'PAY-' || fp.id::TEXT as idnt,
            'Payment: ' || COALESCE(fp.payment_method, 'Online') as descr,
            0::NUMERIC as dbt,
            fp.amount as crdt,
            'SETTLEMENT' as prot
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id
    )
    SELECT 
        t_date as transaction_date,
        idnt as identifier,
        descr as description,
        dbt as debit,
        crdt as credit,
        SUM(dbt - crdt) OVER (ORDER BY t_date ASC, idnt ASC) as running_balance,
        prot as protocol
    FROM raw_entries
    ORDER BY t_date DESC;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [11] PAYMENT: submit_manual_payment_receipt (Full Flow with Reconciliation)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_manual_payment_receipt(
    p_student_id UUID,
    p_amount NUMERIC,
    p_transaction_date DATE DEFAULT CURRENT_DATE,
    p_transaction_ref TEXT DEFAULT '',
    p_payment_mode TEXT DEFAULT 'NEFT',
    p_proof_url TEXT DEFAULT '',
    p_invoice_ids UUID[] DEFAULT '{}'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_payment_id UUID;
    v_remaining NUMERIC;
    v_inst RECORD;
    v_applied NUMERIC;
BEGIN
    -- 1. Ownership Check
    IF NOT public.check_student_ownership(p_student_id) THEN
        RETURN jsonb_build_object('success', false, 'error', '403_ACCESS_FORBIDDEN');
    END IF;

    -- 2. Insert Payment Record
    INSERT INTO public.fee_payments (
        student_id, amount, payment_date, payment_method, 
        transaction_id, receipt_url, status
    ) VALUES (
        p_student_id, p_amount, p_transaction_date, p_payment_mode,
        COALESCE(NULLIF(p_transaction_ref, ''), 'TXN-' || gen_random_uuid()::text),
        p_proof_url,
        'pending_verification'
    ) RETURNING id INTO v_payment_id;

    -- 3. Auto-Allocate to Unpaid Installments (FIFO by due_date)
    v_remaining := p_amount;
    
    FOR v_inst IN 
        SELECT ins.id, ins.amount, ins.paid_amount
        FROM public.installment_schedule ins
        JOIN public.student_fee_ledger sfl ON ins.ledger_id = sfl.id
        WHERE sfl.student_id = p_student_id 
        AND LOWER(ins.status) != 'paid'
        ORDER BY ins.due_date ASC
    LOOP
        EXIT WHEN v_remaining <= 0;
        
        v_applied := LEAST(v_remaining, v_inst.amount - v_inst.paid_amount);
        
        IF v_applied > 0 THEN
            UPDATE public.installment_schedule 
            SET paid_amount = paid_amount + v_applied,
                status = CASE 
                    WHEN (paid_amount + v_applied) >= amount THEN 'paid' 
                    ELSE 'partial' 
                END,
                updated_at = NOW()
            WHERE id = v_inst.id;
            
            v_remaining := v_remaining - v_applied;
        END IF;
    END LOOP;

    -- 4. Reconcile Account Totals
    BEGIN
        PERFORM public.admin_reconcile_student_account(p_student_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 5. Audit Log
    INSERT INTO public.finance_audit_logs (action_type, description, metadata)
    VALUES (
        'PAYMENT_SUBMITTED', 
        'Manual payment receipt submitted for ' || p_student_id::text,
        jsonb_build_object(
            'student_id', p_student_id,
            'amount', p_amount,
            'payment_id', v_payment_id,
            'mode', p_payment_mode,
            'ref', p_transaction_ref,
            'auto_allocated', p_amount - v_remaining
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'payment_id', v_payment_id,
        'amount', p_amount,
        'allocated', p_amount - v_remaining,
        'unallocated', v_remaining
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [12] HELPER: get_branch_academic_cycles
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_branch_academic_cycles(p_branch_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    year_name TEXT,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN,
    status academic_year_status
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT ay.id, ay.year_name, ay.start_date, ay.end_date, ay.is_current, ay.status
    FROM public.academic_years ay
    WHERE (ay.branch_id = p_branch_id OR ay.branch_id IS NULL)
    AND LOWER(ay.status::text) IN ('active', 'upcoming', 'completed', 'current')
    ORDER BY ay.start_date DESC;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [13] HELPER: check_student_ownership (Reinforced)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_student_ownership(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.get_parent_authorized_nodes() 
        WHERE node_id = p_student_id OR student_user_id = p_student_id
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [14] MASS SYNC: Heal all stuck student nodes
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_student RECORD;
    v_current_year_id BIGINT;
    v_count INTEGER := 0;
BEGIN
    SELECT id INTO v_current_year_id FROM public.academic_years 
    WHERE is_current = true AND LOWER(status::text) IN ('active', 'current')
    LIMIT 1;
    
    IF v_current_year_id IS NOT NULL THEN
        FOR v_student IN 
            SELECT sp.user_id 
            FROM public.student_profiles sp
            LEFT JOIN public.student_fee_ledger sfl 
                ON sp.user_id = sfl.student_id AND sfl.academic_year_id = v_current_year_id
            WHERE UPPER(sp.enrollment_status) IN ('ACTIVE', 'ENROLLED')
            AND sfl.id IS NULL
        LOOP
            BEGIN
                PERFORM public.automate_finance_lifecycle(v_student.user_id);
                v_count := v_count + 1;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Failed to sync student %: %', v_student.user_id, SQLERRM;
            END;
        END LOOP;
        RAISE NOTICE 'V13 Mass Sync: Repaired % stuck student nodes.', v_count;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [15] PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.validate_institution_finance(BIGINT, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_finance_readiness(UUID, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_payment_enabled(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_installments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_student_ledger(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.automate_finance_lifecycle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_finance_lifecycle(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_finance_detail_v4(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_manual_payment_receipt(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_branch_academic_cycles(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_student_ownership(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [16] AUDIT LOG
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.finance_audit_logs (action_type, description, metadata)
VALUES (
    'SYSTEM_UPDATE', 
    'Executed Finance Ecosystem Stability Protocol v13.0 — Full Flow Consolidation', 
    '{
        "version": "13.0", 
        "scope": "full_flow_consolidation",
        "fixes": [
            "case_insensitive_status_matching",
            "fuzzy_grade_matching",
            "fee_breakdown_in_v4",
            "robust_lifecycle_automation",
            "payment_receipt_auto_allocation",
            "installment_generation",
            "mass_sync_healing"
        ]
    }'::jsonb
);

COMMIT;

SELECT 'SUCCESS: Finance Ecosystem Stability Protocol v13.0 — Full Flow Consolidated' as status;
