-- =============================================================================
-- MASTER FINANCE RESTORATION & LIFECYCLE AUTOMATION (V25.11)
-- =============================================================================
-- Targets: 1. FIX "no unique constraint matching ON CONFLICT"
--          2. FIX "column academic_cycle_id missing"
--          3. FIX "Yield Efficiency Discrepancy" (₹1,25,000 vs ₹60,000)
--          4. REPAIR "Check constraint violation" (Partial payments check)
-- =============================================================================

BEGIN;

-- [0] SCHEMA HARDENING & REGISTRY RECONSTRUCTION
DO $$ 
DECLARE
    v_default_cycle_id BIGINT;
BEGIN
    v_default_cycle_id := public.get_current_academic_cycle();

    -- 1. fee_invoices: Standardize naming
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'fee_structure_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'structure_id') THEN
            ALTER TABLE public.fee_invoices RENAME COLUMN fee_structure_id TO structure_id;
        END IF;
    END IF;

    -- 2. student_fee_assignments: RECONSTRUCT FOR UPSERT SUPPORT
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_fee_assignments') THEN
        CREATE TABLE public.student_fee_assignments (
            student_id UUID NOT NULL,
            structure_id BIGINT NOT NULL,
            academic_cycle_id BIGINT NOT NULL,
            assigned_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (student_id, academic_cycle_id)
        );
    ELSE
        -- Ensure academic_cycle_id exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_assignments' AND column_name = 'academic_cycle_id') THEN
            ALTER TABLE public.student_fee_assignments ADD COLUMN academic_cycle_id BIGINT;
            UPDATE public.student_fee_assignments SET academic_cycle_id = v_default_cycle_id WHERE academic_cycle_id IS NULL;
        END IF;

        -- Clean Duplicates Before Indexing
        -- Keep only the latest assignment per student per cycle
        DELETE FROM public.student_fee_assignments a
        WHERE a.ctid <> (
            SELECT MAX(b.ctid)
            FROM public.student_fee_assignments b
            WHERE b.student_id = a.student_id AND b.academic_cycle_id = a.academic_cycle_id
        );

        -- Establish Unique Constraint (Required for ON CONFLICT)
        DROP INDEX IF EXISTS idx_student_assignment_sync;
        CREATE UNIQUE INDEX idx_student_assignment_sync ON public.student_fee_assignments(student_id, academic_cycle_id);
    END IF;

    -- 3. installment_schedule: Partial payment support
    ALTER TABLE public.installment_schedule DROP CONSTRAINT IF EXISTS installment_schedule_status_check;
    ALTER TABLE public.installment_schedule ADD CONSTRAINT installment_schedule_status_check 
        CHECK (status IN ('pending', 'partial', 'paid', 'cancelled', 'overdue'));

    -- 4. fee_invoices: Ensure cycle tracking exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'academic_cycle_id') THEN
        ALTER TABLE public.fee_invoices ADD COLUMN academic_cycle_id BIGINT;
    END IF;
END $$;

-- [1] UTILITY: Robust Grade Normalizer
CREATE OR REPLACE FUNCTION public.normalize_grade_string(p_grade TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF p_grade IS NULL THEN RETURN NULL; END IF;
    RETURN TRIM(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(p_grade), 'grade', ''), 'class', ''), 'th', ''), ' ', ''));
END;
$$;

-- [2] TRUTH ENGINE: admin_reconcile_student_account
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_liability NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_ledger_id UUID;
    v_remaining NUMERIC := 0;
    v_applied NUMERIC := 0;
    v_inst RECORD;
    v_cycle_id BIGINT := public.get_current_academic_cycle();
BEGIN
    -- 1. Identify active ledger for current cycle
    SELECT id, total_amount INTO v_ledger_id, v_total_liability 
    FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND academic_year_id = v_cycle_id AND status = 'ACTIVE';

    -- 2. Calculate Real Collections
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM (
        SELECT amount FROM public.fee_payments WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'success')
        UNION ALL
        SELECT amount FROM public.payments WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'success')
    ) t;

    -- 3. Sync Account Summary (Clears ghost amounts)
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, integrity_score, last_synced_at
    )
    VALUES (
        p_student_id, v_total_liability, v_total_paid, 
        GREATEST(0, v_total_liability - v_total_paid),
        CASE WHEN v_total_liability > 0 THEN (v_total_paid / v_total_liability * 100)::INTEGER ELSE 100 END,
        NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        last_synced_at = NOW();

    -- 4. Installment Waterfall
    IF v_ledger_id IS NOT NULL THEN
        v_remaining := v_total_paid;
        UPDATE public.installment_schedule SET paid_amount = 0, status = 'pending' WHERE ledger_id = v_ledger_id;

        FOR v_inst IN SELECT id, amount FROM public.installment_schedule WHERE ledger_id = v_ledger_id ORDER BY due_date ASC LOOP
            EXIT WHEN v_remaining <= 0;
            v_applied := LEAST(v_remaining, v_inst.amount);
            UPDATE public.installment_schedule 
            SET paid_amount = v_applied,
                status = CASE WHEN v_applied >= v_inst.amount THEN 'paid' WHEN v_applied > 0 THEN 'partial' ELSE 'pending' END
            WHERE id = v_inst.id;
            v_remaining := v_remaining - v_applied;
        END LOOP;
    END IF;
END;
$$;

-- [3] CORE PROTOCOL: enroll_student_finance_protocol (V25.11 - Robust Assignment)
CREATE OR REPLACE FUNCTION public.enroll_student_finance_protocol(
    p_student_id UUID,
    p_grade TEXT,
    p_cycle_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_struct_id BIGINT;
    v_total_amount NUMERIC := 0;
    v_normalized_input TEXT := public.normalize_grade_string(p_grade);
    v_branch_id BIGINT;
BEGIN
    SELECT branch_id INTO v_branch_id FROM public.student_profiles WHERE user_id = p_student_id;

    -- 1. Identify structure
    SELECT fs.id INTO v_struct_id
    FROM public.fee_structures fs
    WHERE (public.normalize_grade_string(fs.target_grade) = v_normalized_input OR fs.target_grade = p_grade)
    AND (fs.academic_cycle_id = p_cycle_id OR fs.academic_year = p_cycle_id::text)
    AND (LOWER(fs.status) = 'active' OR fs.is_active = true)
    ORDER BY (CASE WHEN fs.is_default = true THEN 0 ELSE 1 END), fs.created_at DESC
    LIMIT 1;

    IF v_struct_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'MAPPING_NOT_FOUND');
    END IF;

    -- 2. Calculate Protocol Price
    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount FROM (
        SELECT amount FROM public.fee_structure_installments WHERE structure_id = v_struct_id
        UNION ALL
        SELECT amount FROM public.fee_components WHERE structure_id = v_struct_id 
        AND NOT EXISTS (SELECT 1 FROM public.fee_structure_installments WHERE structure_id = v_struct_id)
    ) t;

    -- 3. SYNC ASSIGNMENT (Targeting Unique Index)
    -- This uses the index 'idx_student_assignment_sync' to support the conflict clause
    INSERT INTO public.student_fee_assignments (student_id, structure_id, academic_cycle_id)
    VALUES (p_student_id, v_struct_id, p_cycle_id)
    ON CONFLICT (student_id, academic_cycle_id) DO UPDATE SET structure_id = EXCLUDED.structure_id;

    -- 4. Sync Ledger
    INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, total_amount, status)
    VALUES (p_student_id, p_cycle_id, v_branch_id, v_total_amount, 'ACTIVE')
    ON CONFLICT (student_id, academic_year_id) DO UPDATE SET total_amount = EXCLUDED.total_amount, status = 'ACTIVE';

    -- 5. Deep Recalibration
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'ledger_total', v_total_amount);
END;
$$;

-- [4] ANALYTICS REPAIR: get_fee_structures_with_metrics 
-- Force cycle-aware totals (displays ₹60,000 truth)
CREATE OR REPLACE FUNCTION public.get_fee_structures_with_metrics(p_branch_id BIGINT)
RETURNS TABLE (
    id BIGINT, name TEXT, academic_year TEXT, target_grade TEXT, currency TEXT, 
    status TEXT, state TEXT, created_at TIMESTAMPTZ, components JSONB,
    student_count BIGINT, potential_count BIGINT, base_amount NUMERIC,
    projected_revenue NUMERIC, collected_revenue NUMERIC, integrity_score INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH sb AS (
        SELECT fs.id, fs.name::TEXT, COALESCE(ay.year_name, fs.academic_year::TEXT)::TEXT as ay_name, 
               fs.target_grade::TEXT as t_grade, COALESCE(fs.currency, 'INR')::TEXT as curr,
               fs.status::TEXT, COALESCE(fs.state, 'DRAFT')::TEXT as st, fs.created_at,
               COALESCE((SELECT SUM(amount) FROM public.fee_components WHERE structure_id = fs.id), 0) as b_amt
        FROM public.fee_structures fs
        LEFT JOIN public.academic_years ay ON fs.academic_cycle_id = ay.id
        WHERE (fs.branch_id = p_branch_id OR p_branch_id IS NULL)
    ),
    gp AS (
        SELECT sp.grade, COUNT(*) as p_count FROM public.student_profiles sp
        WHERE (sp.branch_id = p_branch_id OR p_branch_id IS NULL) GROUP BY sp.grade
    ),
    m AS (
        SELECT 
            sfa.structure_id,
            COUNT(DISTINCT sfa.student_id) as s_count,
            COALESCE(SUM(sfl.total_amount), 0) as p_rev,
            COALESCE(SUM(sacc.total_paid), 0) as c_rev,
            AVG(COALESCE(sacc.integrity_score, 100))::INTEGER as avg_integrity
        FROM public.student_fee_assignments sfa
        JOIN public.student_fee_ledger sfl ON sfa.student_id = sfl.student_id AND sfa.academic_cycle_id = sfl.academic_year_id
        LEFT JOIN public.student_fee_accounts sacc ON sfa.student_id = sacc.student_id
        GROUP BY sfa.structure_id
    )
    SELECT 
        sb.id, sb.name, sb.ay_name, sb.t_grade, sb.curr, sb.status, sb.st, sb.created_at,
        NULL::JSONB,
        COALESCE(m.s_count, 0::BIGINT),
        COALESCE(gp.p_count, 0::BIGINT),
        sb.b_amt,
        COALESCE(m.p_rev, 0::NUMERIC), 
        COALESCE(m.c_rev, 0::NUMERIC),
        COALESCE(m.avg_integrity, 100)::INTEGER
    FROM sb
    LEFT JOIN m ON sb.id = m.structure_id
    LEFT JOIN gp ON sb.t_grade = gp.grade
    ORDER BY sb.created_at DESC;
END;
$$;

-- [5] REPAIR EXECUTION: Restore state
SELECT public.global_repair_finance_ledgers_v25();

COMMIT;

SELECT 'SUCCESS: Finance Master V25.11 Deployed. Unified Registry & Constraint Truth established.' as status;
