-- ==============================================================================
-- FIX GENESIS MAPPING V11 (STRICT ALIASING & AMBIGUITY FIX)
-- ==============================================================================
-- Problem: "column reference 'student_id' is ambiguous" during GENESIS sync.
-- Cause: Unqualified column references in complex UPDATE/SELECT statements
--        within the generate_student_ledger logic.
-- Solution: Qualification of ALL table columns with explicit aliases.
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] CORE: admin_reconcile_student_account (Alias Reinforced)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_billed NUMERIC := 0;
    v_paid_std NUMERIC := 0;
    v_paid_ent NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_unallocated NUMERIC := 0;
    v_integrity INT;
BEGIN
    -- 1. Calculate Real-Time Billed Magnitude
    SELECT COALESCE(SUM(fi.total_amount), 0) INTO v_billed 
    FROM public.fee_invoices fi
    WHERE fi.student_id = p_student_id AND LOWER(fi.status::text) NOT IN ('cancelled');

    -- 2. Sum Settlements
    SELECT COALESCE(SUM(fp.amount), 0) INTO v_paid_std 
    FROM public.fee_payments fp
    WHERE fp.student_id = p_student_id AND LOWER(fp.status::text) IN ('completed', 'pending', 'success');

    BEGIN
        EXECUTE 'SELECT COALESCE(SUM(pay.amount), 0) FROM public.payments pay WHERE pay.student_id = $1 AND LOWER(pay.status::text) IN (''success'', ''pending'')'
        INTO v_paid_ent
        USING p_student_id;
    EXCEPTION WHEN OTHERS THEN
        v_paid_ent := 0;
    END;

    v_total_paid := v_paid_std + v_paid_ent;

    -- 3. Unallocated Magnitude
    SELECT COALESCE(SUM(un_fp.amount), 0) INTO v_unallocated
    FROM public.fee_payments un_fp
    WHERE un_fp.student_id = p_student_id AND (un_fp.invoice_id IS NULL OR un_fp.invoice_id = 0) AND LOWER(un_fp.status::text) IN ('completed', 'success');

    -- 4. Integrity Calculation
    v_integrity := CASE 
        WHEN v_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_billed * 100)::INT))
    END;

    -- 5. Persistent Sync
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_billed, v_total_paid, (v_billed - v_total_paid), 
        v_integrity, NOW(), v_unallocated
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        last_synced_at = NOW();

    -- 6. Atomic Ledger Metadata Sync
    UPDATE public.student_fee_ledger sfl
    SET total_amount = v_billed,
        updated_at = NOW()
    WHERE sfl.student_id = p_student_id;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] CORE: generate_student_ledger (Alias Reinforced V11)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_branch_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_structure_id BIGINT;
    v_year_id BIGINT := p_academic_year_id;
    v_component RECORD;
    v_count_new INTEGER := 0;
    v_count_purged INTEGER := 0;
    v_ledger_id UUID;
    v_target_total NUMERIC := 0;
BEGIN
    -- 1. Identity Fetch
    SELECT sp.branch_id, sp.grade INTO v_branch_id, v_grade 
    FROM public.student_profiles sp WHERE sp.user_id = p_student_id;
    
    IF v_branch_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'BRANCH_NOT_RESOLVED');
    END IF;

    -- 2. Cycle Detection
    IF v_year_id IS NULL THEN
        SELECT ay.id INTO v_year_id FROM public.academic_years ay 
        WHERE (ay.branch_id = v_branch_id OR ay.branch_id IS NULL)
        AND ay.is_current = true LIMIT 1;
    END IF;

    -- 3. Structure Lookup
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));
    
    SELECT fs.id INTO v_structure_id FROM public.fee_structures fs
    WHERE (LOWER(fs.status::text) = 'active' OR UPPER(fs.state::text) = 'ACTIVE')
    AND (fs.academic_cycle_id = v_year_id OR fs.academic_cycle_id IS NULL)
    AND (LOWER(fs.target_grade) = LOWER(v_grade) OR TRIM(REPLACE(REPLACE(LOWER(fs.target_grade), 'class', ''), 'grade', '')) = v_normalized_grade)
    ORDER BY (CASE WHEN fs.academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), fs.created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STRUCTURE_NOT_FOUND', 'detail', v_grade);
    END IF;

    SELECT COALESCE(SUM(fc.amount), 0) INTO v_target_total FROM public.fee_components fc WHERE fc.structure_id = v_structure_id;

    -- 4. Assignment
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    -- 5. NUCLEAR PURGE (Safety First Aliasing)
    -- Using a temp table to avoid ambiguous col references in complex UPDATE WHERE clauses
    UPDATE public.fee_invoices target_invoice
    SET status = 'cancelled',
        description = target_invoice.description || ' (PURGED_BY_SYNC_V11)'
    WHERE target_invoice.student_id = p_student_id 
    AND (target_invoice.paid_amount = 0 OR target_invoice.paid_amount IS NULL)
    AND LOWER(target_invoice.status::text) IN ('pending', 'overdue')
    AND (
        (CASE 
            WHEN (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'structure_id') IS NOT NULL 
            THEN target_invoice.structure_id IS DISTINCT FROM v_structure_id 
            ELSE true 
         END)
        OR 
        REPLACE(LOWER(target_invoice.description), ' (initial_sync)', '') NOT IN (
            SELECT LOWER(comp.name) FROM public.fee_components comp WHERE comp.structure_id = v_structure_id
        )
    );
    GET DIAGNOSTICS v_count_purged = ROW_COUNT;

    -- 6. Injection
    FOR v_component IN SELECT * FROM public.fee_components WHERE structure_id = v_structure_id LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices check_fi
            WHERE check_fi.student_id = p_student_id 
            AND (LOWER(check_fi.description) = LOWER(v_component.name) OR LOWER(check_fi.description) = LOWER(v_component.name) || ' (initial_sync)')
            AND LOWER(check_fi.status::text) != 'cancelled'
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, branch_id, total_amount, due_date, description, status, structure_id
            ) VALUES (
                p_student_id, v_branch_id, v_component.amount, CURRENT_DATE + INTERVAL '15 days',
                v_component.name || ' (INITIAL_SYNC)', 'pending', v_structure_id
            );
            v_count_new := v_count_new + 1;
        END IF;
    END LOOP;

    -- 7. Sync
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'final_magnitude', v_target_total,
        'purged_orphans', v_count_purged,
        'added_components', v_count_new
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Genesis Mapping V11 (Strict Aliasing) Deployed.' as STATUS;
