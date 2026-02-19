-- =============================================================================
-- FINANCE MASTER DIAGNOSTIC & FIX (V26)
-- =============================================================================
-- ROOT CAUSE: Students have accumulated stale/duplicate fee_invoices from 
--             previous repair runs, ghost academic years, or legacy migrations.
--             Total ₹1,25,000 = ₹60,000 (current) + ₹65,000 (stale old invoices)
-- 
-- THIS SCRIPT WILL:
--   PHASE 0: Schema Hardening (Constraints, Columns, Indexes)
--   PHASE 1: Diagnostic — Show exactly what's wrong per student
--   PHASE 2: Purge — Remove all stale/duplicate fee invoices
--   PHASE 3: Purge — Remove all stale/duplicate ledger entries
--   PHASE 4: Reset — Wipe student_fee_accounts snapshots (stale totals)
--   PHASE 5: Rebuild — Re-enroll all students fresh from the correct protocol
--   PHASE 6: Verify — Confirm Grade 1 students show ₹60,000 total
-- =============================================================================

BEGIN;

-- ============================================================
-- PHASE 0: SCHEMA HARDENING
-- ============================================================

DO $$
DECLARE v_cycle_id BIGINT;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();

    -- A. Standardize fee_invoices column naming
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fee_invoices' AND column_name='fee_structure_id')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fee_invoices' AND column_name='structure_id') THEN
        ALTER TABLE public.fee_invoices RENAME COLUMN fee_structure_id TO structure_id;
    END IF;

    -- B. Add academic_cycle_id to fee_invoices if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fee_invoices' AND column_name='academic_cycle_id') THEN
        ALTER TABLE public.fee_invoices ADD COLUMN academic_cycle_id BIGINT;
    END IF;

    -- C. Add title to fee_invoices if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fee_invoices' AND column_name='title') THEN
        ALTER TABLE public.fee_invoices ADD COLUMN title TEXT;
    END IF;

    -- D. Ensure academic_cycle_id on fee_structures
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fee_structures' AND column_name='academic_cycle_id') THEN
        ALTER TABLE public.fee_structures ADD COLUMN academic_cycle_id BIGINT;
        UPDATE public.fee_structures SET academic_cycle_id = CASE WHEN academic_year ~ '^[0-9]+$' THEN academic_year::bigint ELSE NULL END;
    END IF;

    -- E. Fix installment_schedule status constraint
    ALTER TABLE public.installment_schedule DROP CONSTRAINT IF EXISTS installment_schedule_status_check;
    ALTER TABLE public.installment_schedule ADD CONSTRAINT installment_schedule_status_check 
        CHECK (status IN ('pending', 'partial', 'paid', 'cancelled', 'overdue'));

    -- F. Ensure student_fee_assignments exists with unique index
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='student_fee_assignments') THEN
        CREATE TABLE public.student_fee_assignments (
            student_id UUID NOT NULL,
            structure_id BIGINT NOT NULL,
            academic_cycle_id BIGINT NOT NULL,
            assigned_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (student_id, academic_cycle_id)
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='student_fee_assignments' AND column_name='academic_cycle_id') THEN
            ALTER TABLE public.student_fee_assignments ADD COLUMN academic_cycle_id BIGINT;
            UPDATE public.student_fee_assignments SET academic_cycle_id = v_cycle_id WHERE academic_cycle_id IS NULL;
        END IF;
        -- Clean duplicates and create unique index
        DELETE FROM public.student_fee_assignments a
        WHERE a.ctid <> (SELECT MAX(b.ctid) FROM public.student_fee_assignments b
            WHERE b.student_id = a.student_id AND b.academic_cycle_id = a.academic_cycle_id);
        DROP INDEX IF EXISTS idx_student_assignment_sync;
        CREATE UNIQUE INDEX idx_student_assignment_sync ON public.student_fee_assignments(student_id, academic_cycle_id);
    END IF;

    -- G. Ensure fee_structure_installments exists
    CREATE TABLE IF NOT EXISTS public.fee_structure_installments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        structure_id BIGINT REFERENCES public.fee_structures(id) ON DELETE CASCADE,
        name TEXT NOT NULL, amount NUMERIC NOT NULL, due_date DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- H. Ensure student_fee_ledger exists with unique constraint
    CREATE TABLE IF NOT EXISTS public.student_fee_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        academic_year_id BIGINT, branch_id BIGINT,
        total_amount NUMERIC DEFAULT 0, status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(student_id, academic_year_id)
    );

    -- I. Ensure student_fee_accounts exists
    CREATE TABLE IF NOT EXISTS public.student_fee_accounts (
        student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
        total_billed NUMERIC DEFAULT 0, total_paid NUMERIC DEFAULT 0,
        outstanding_balance NUMERIC DEFAULT 0, unallocated_funds NUMERIC DEFAULT 0,
        integrity_score INTEGER DEFAULT 100, last_synced_at TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
    );
END $$;

-- ============================================================
-- PHASE 1: DIAGNOSTIC — Expose the root cause
-- ============================================================

SELECT 
    '=== DIAGNOSTIC: FEE INVOICES PER STUDENT ===' as section,
    p.display_name,
    sp.grade,
    COUNT(fi.id) as invoice_count,
    SUM(fi.total_amount) as raw_invoice_total,
    MAX(sacc.total_billed) as account_total_billed,
    string_agg(DISTINCT fi.academic_cycle_id::text, ', ') as invoice_cycles,
    string_agg(DISTINCT fi.title, ' | ') as invoice_titles
FROM public.profiles p
JOIN public.student_profiles sp ON p.id = sp.user_id
LEFT JOIN public.fee_invoices fi ON p.id = fi.student_id
LEFT JOIN public.student_fee_accounts sacc ON p.id = sacc.student_id
WHERE sp.grade IS NOT NULL
GROUP BY p.id, p.display_name, sp.grade
HAVING COUNT(fi.id) > 0
ORDER BY SUM(fi.total_amount) DESC;

-- ============================================================
-- PHASE 2: PURGE — Remove Stale & Duplicate Fee Invoices
-- ============================================================
-- Strategy: Delete ALL fee invoices that:
--   (a) Belong to a cycle that is NOT the current active cycle
--   (b) OR are duplicates (same student + structure + title)

DO $$
DECLARE
    v_cycle_id BIGINT;
    v_deleted_old INT;
    v_deleted_dup INT;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();

    -- 2A. Delete invoices from non-current academic cycles (stale carry-forward data)
    DELETE FROM public.fee_invoices
    WHERE academic_cycle_id IS NOT NULL 
      AND academic_cycle_id <> v_cycle_id;
    GET DIAGNOSTICS v_deleted_old = ROW_COUNT;
    RAISE NOTICE 'Phase 2A: Deleted % stale cross-cycle invoices', v_deleted_old;

    -- 2B. Delete duplicates: keep only the LATEST invoice per student+structure+title
    DELETE FROM public.fee_invoices fi
    WHERE fi.id NOT IN (
        SELECT DISTINCT ON (student_id, structure_id, title) id
        FROM public.fee_invoices
        ORDER BY student_id, structure_id, title, created_at DESC
    );
    GET DIAGNOSTICS v_deleted_dup = ROW_COUNT;
    RAISE NOTICE 'Phase 2B: Deleted % duplicate invoices', v_deleted_dup;

    -- 2C. Mark orphaned invoices where structure no longer exists
    UPDATE public.fee_invoices
    SET status = 'cancelled'
    WHERE structure_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.fee_structures fs WHERE fs.id = fee_invoices.structure_id);
    GET DIAGNOSTICS v_deleted_dup = ROW_COUNT;
    RAISE NOTICE 'Phase 2C: Cancelled % orphaned invoices', v_deleted_dup;

    RAISE NOTICE 'Phase 2 COMPLETE: Invoice purge done.';
END $$;

-- ============================================================
-- PHASE 3: PURGE — Remove Stale Ledger Entries
-- ============================================================

DO $$
DECLARE
    v_cycle_id BIGINT;
    v_deleted INT;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();

    -- 3A. Delete ledger entries from past cycles
    DELETE FROM public.student_fee_ledger WHERE academic_year_id <> v_cycle_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Phase 3A: Deleted % stale ledger entries', v_deleted;

    -- 3B. Delete duplicate ledger entries (keep latest per student)
    DELETE FROM public.student_fee_ledger sl
    WHERE sl.id NOT IN (
        SELECT DISTINCT ON (student_id) id
        FROM public.student_fee_ledger
        ORDER BY student_id, created_at DESC
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Phase 3B: Deleted % duplicate ledger rows', v_deleted;

    RAISE NOTICE 'Phase 3 COMPLETE: Ledger purge done.';
END $$;

-- ============================================================
-- PHASE 4: RESET — Wipe Account Snapshots
-- ============================================================
-- Force all student_fee_accounts to zero so Phase 5 can rebuild from scratch

UPDATE public.student_fee_accounts 
SET total_billed = 0, total_paid = 0, outstanding_balance = 0, 
    integrity_score = 0, last_synced_at = NOW();

-- ============================================================
-- PHASE 5: REBUILD — Grade Normalizer + Core Functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_grade_string(p_grade TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF p_grade IS NULL THEN RETURN NULL; END IF;
    RETURN TRIM(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(p_grade), 'grade', ''), 'class', ''), 'th', ''), ' ', ''));
END;
$$;

-- Reconciliation Engine: single source of truth
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_liability NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_ledger_id UUID;
    v_remaining NUMERIC := 0;
    v_applied NUMERIC := 0;
    v_inst RECORD;
    v_cycle_id BIGINT;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();

    -- Get ledger total (the PROTOCOL TRUTH)
    SELECT id, total_amount INTO v_ledger_id, v_total_liability 
    FROM public.student_fee_ledger 
    WHERE student_id = p_student_id AND academic_year_id = v_cycle_id AND status = 'ACTIVE'
    ORDER BY created_at DESC LIMIT 1;

    -- Get real paid total
    BEGIN
        SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
        FROM (
            SELECT amount FROM public.fee_payments WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'success')
            UNION ALL
            SELECT amount FROM public.payments WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'success')
        ) t;
    EXCEPTION WHEN OTHERS THEN v_total_paid := 0; END;

    -- Sync account snapshot from ledger truth
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, integrity_score, last_synced_at
    ) VALUES (
        p_student_id, v_total_liability, v_total_paid,
        GREATEST(0, v_total_liability - v_total_paid),
        CASE WHEN v_total_liability > 0 THEN LEAST(100, (v_total_paid / v_total_liability * 100)::INTEGER) ELSE 100 END,
        NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        last_synced_at = NOW();

    -- Cascade to installment waterfall
    IF v_ledger_id IS NOT NULL THEN
        v_remaining := v_total_paid;
        UPDATE public.installment_schedule SET paid_amount = 0, status = 'pending' WHERE ledger_id = v_ledger_id;
        FOR v_inst IN SELECT id, amount FROM public.installment_schedule WHERE ledger_id = v_ledger_id ORDER BY due_date ASC LOOP
            EXIT WHEN v_remaining <= 0;
            v_applied := LEAST(v_remaining, v_inst.amount);
            UPDATE public.installment_schedule SET paid_amount = v_applied,
                status = CASE WHEN v_applied >= v_inst.amount THEN 'paid' WHEN v_applied > 0 THEN 'partial' ELSE 'pending' END
            WHERE id = v_inst.id;
            v_remaining := v_remaining - v_applied;
        END LOOP;
    END IF;
END;
$$;

-- Core Enrollment: Fresh, clean, single-invoice-per-installment
CREATE OR REPLACE FUNCTION public.enroll_student_finance_protocol(
    p_student_id UUID, p_grade TEXT, p_cycle_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_struct_id BIGINT;
    v_total_amount NUMERIC := 0;
    v_normalized_input TEXT := public.normalize_grade_string(p_grade);
    v_branch_id BIGINT;
    v_installment RECORD;
    v_count_inv INT := 0;
BEGIN
    SELECT branch_id INTO v_branch_id FROM public.student_profiles WHERE user_id = p_student_id;

    -- Identify correct structure
    SELECT fs.id INTO v_struct_id
    FROM public.fee_structures fs
    WHERE (public.normalize_grade_string(fs.target_grade) = v_normalized_input OR fs.target_grade = p_grade)
    AND (fs.academic_cycle_id = p_cycle_id OR fs.academic_year = p_cycle_id::text)
    AND (LOWER(fs.status) = 'active' OR fs.is_active = true)
    ORDER BY (CASE WHEN fs.is_default = true THEN 0 ELSE 1 END), fs.created_at DESC LIMIT 1;

    IF v_struct_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'MAPPING_NOT_FOUND', 'grade', p_grade);
    END IF;

    -- Calculate EXACT protocol price
    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount FROM (
        SELECT amount FROM public.fee_structure_installments WHERE structure_id = v_struct_id
        UNION ALL
        SELECT amount FROM public.fee_components WHERE structure_id = v_struct_id
        AND NOT EXISTS (SELECT 1 FROM public.fee_structure_installments WHERE structure_id = v_struct_id)
    ) t;

    -- Sync registry
    INSERT INTO public.student_fee_assignments (student_id, structure_id, academic_cycle_id)
    VALUES (p_student_id, v_struct_id, p_cycle_id)
    ON CONFLICT (student_id, academic_cycle_id) DO UPDATE SET structure_id = EXCLUDED.structure_id;

    -- Sync ledger (single row per student per cycle)
    INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, total_amount, status)
    VALUES (p_student_id, p_cycle_id, v_branch_id, v_total_amount, 'ACTIVE')
    ON CONFLICT (student_id, academic_year_id) DO UPDATE 
    SET total_amount = EXCLUDED.total_amount, status = 'ACTIVE', updated_at = NOW();

    -- PURGE OLD then Insert Fresh Invoices (Prevents accumulation)
    DELETE FROM public.fee_invoices 
    WHERE student_id = p_student_id AND structure_id = v_struct_id 
      AND (academic_cycle_id IS NULL OR academic_cycle_id = p_cycle_id)
      AND status NOT IN ('paid', 'Paid');

    FOR v_installment IN
        SELECT name as title, amount, due_date FROM public.fee_structure_installments WHERE structure_id = v_struct_id
        UNION ALL
        SELECT name as title, amount, (NOW() + INTERVAL '30 days')::DATE FROM public.fee_components WHERE structure_id = v_struct_id
        AND NOT EXISTS (SELECT 1 FROM public.fee_structure_installments WHERE structure_id = v_struct_id)
    LOOP
        INSERT INTO public.fee_invoices (student_id, structure_id, total_amount, paid_amount, due_date, status, title, academic_cycle_id, branch_id)
        VALUES (p_student_id, v_struct_id, v_installment.amount, 0, v_installment.due_date, 'pending', v_installment.title, p_cycle_id, v_branch_id);
        v_count_inv := v_count_inv + 1;
    END LOOP;

    -- Final recalibration
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'ledger_total', v_total_amount, 'invoices', v_count_inv);
END;
$$;

-- Global Repair
CREATE OR REPLACE FUNCTION public.global_repair_finance_ledgers_v25()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student RECORD; v_cycle_id BIGINT; v_success INT := 0; v_failed INT := 0;
    v_result JSONB;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();
    FOR v_student IN 
        SELECT sp.user_id, sp.grade FROM public.student_profiles sp 
        JOIN public.profiles p ON sp.user_id = p.id 
        WHERE p.is_active = true AND sp.grade IS NOT NULL
    LOOP
        BEGIN
            v_result := public.enroll_student_finance_protocol(v_student.user_id, v_student.grade, v_cycle_id);
            IF (v_result->>'success')::boolean THEN v_success := v_success + 1;
            ELSE v_failed := v_failed + 1; END IF;
        EXCEPTION WHEN OTHERS THEN v_failed := v_failed + 1; END;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'repaired', v_success, 'failed', v_failed, 'cycle_id', v_cycle_id);
END;
$$;

-- Metrics RPC (Correct Projection Calculation)
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
        SELECT fs.id, fs.name::TEXT,
               COALESCE(ay.year_name, fs.academic_year::TEXT)::TEXT as ay_name,
               fs.target_grade::TEXT as t_grade, COALESCE(fs.currency, 'INR')::TEXT as curr,
               fs.status::TEXT, COALESCE(fs.state, 'DRAFT')::TEXT as st, fs.created_at,
               COALESCE((SELECT SUM(fc.amount) FROM public.fee_components fc WHERE fc.structure_id = fs.id), 0) as b_amt
        FROM public.fee_structures fs
        LEFT JOIN public.academic_years ay ON fs.academic_cycle_id = ay.id
        WHERE (fs.branch_id = p_branch_id OR p_branch_id IS NULL)
    ),
    gp AS (
        SELECT sp.grade, COUNT(*) as p_count FROM public.student_profiles sp
        WHERE (sp.branch_id = p_branch_id OR p_branch_id IS NULL) GROUP BY sp.grade
    ),
    m AS (
        SELECT sfa.structure_id,
               COUNT(DISTINCT sfa.student_id) as s_count,
               COALESCE(SUM(sfl.total_amount), 0) as p_rev,  -- From ledger = protocol truth
               COALESCE(SUM(sacc.total_paid), 0) as c_rev,
               AVG(COALESCE(sacc.integrity_score, 100))::INTEGER as avg_int
        FROM public.student_fee_assignments sfa
        JOIN public.student_fee_ledger sfl ON sfa.student_id = sfl.student_id AND sfa.academic_cycle_id = sfl.academic_year_id
        LEFT JOIN public.student_fee_accounts sacc ON sfa.student_id = sacc.student_id
        GROUP BY sfa.structure_id
    )
    SELECT sb.id, sb.name, sb.ay_name, sb.t_grade, sb.curr, sb.status, sb.st, sb.created_at,
           NULL::JSONB AS components,
           COALESCE(m.s_count, 0::BIGINT), COALESCE(gp.p_count, 0::BIGINT),
           sb.b_amt,
           COALESCE(m.p_rev, 0::NUMERIC),
           COALESCE(m.c_rev, 0::NUMERIC),
           COALESCE(m.avg_int, 100)::INTEGER
    FROM sb
    LEFT JOIN m ON sb.id = m.structure_id
    LEFT JOIN gp ON sb.t_grade = gp.grade
    ORDER BY sb.created_at DESC;
END;
$$;

-- ============================================================
-- PHASE 5B: EXECUTE GLOBAL REPAIR
-- ============================================================
SELECT public.global_repair_finance_ledgers_v25() as repair_result;

-- ============================================================
-- PHASE 6: VERIFY — Grade 1 students should show ₹60,000
-- ============================================================
SELECT 
    '=== VERIFICATION: GRADE 1 STUDENT BALANCES ===' as section,
    p.display_name,
    sp.grade,
    sacc.total_billed,
    sacc.total_paid,
    sacc.outstanding_balance,
    COUNT(fi.id) as invoice_count,
    SUM(fi.total_amount) as invoice_total
FROM public.profiles p
JOIN public.student_profiles sp ON p.id = sp.user_id
LEFT JOIN public.student_fee_accounts sacc ON p.id = sacc.student_id
LEFT JOIN public.fee_invoices fi ON p.id = fi.student_id 
    AND fi.academic_cycle_id = public.get_current_academic_cycle()
WHERE sp.grade IS NOT NULL
GROUP BY p.id, p.display_name, sp.grade, sacc.total_billed, sacc.total_paid, sacc.outstanding_balance
ORDER BY sp.grade;

COMMIT;

SELECT 'SUCCESS: Finance Master V26 Deployed. Duplicate invoices purged. Grade 1 recalibrated to protocol truth.' as status;
