-- =============================================================================
-- FINANCE REPAIR PROTOCOL: DUPLICATION FIX
-- =============================================================================
-- OBJECTIVE: Resolve double-billing issue caused by duplicate fee structures or
--            duplicate fee components.
--
-- TARGET:
-- 1. Identify and archive duplicate Active Fee Structures for the same Grade.
-- 2. Remove duplicate Fee Components within the same structure.
-- 3. Recalculate and repair Student Fee Ledgers that have incorrect totals.
-- 4. Regenerate Installments for repaired ledgers.
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] DIAGNOSTIC & REPAIR: DEDUPLICATE FEE STRUCTURES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Keep only the LATEST created 'ACTIVE' structure for each Grade + Cycle.
-- Archive the rest.

WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY academic_cycle_id, target_grade 
               ORDER BY created_at DESC, id DESC
           ) as rn
    FROM public.fee_structures
    WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
)
UPDATE public.fee_structures
SET status = 'archived', state = 'ARCHIVED'
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] DIAGNOSTIC & REPAIR: DEDUPLICATE FEE COMPONENTS
-- ═══════════════════════════════════════════════════════════════════════════════
-- Remove components that are exact duplicates (name + amount) within the same structure
-- keeping the one with the lowest ID.

DELETE FROM public.fee_components
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY structure_id, name, amount 
                   ORDER BY id ASC
               ) as rn
        FROM public.fee_components
    ) t WHERE t.rn > 1
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- [3] CORE REPAIR: RECALCULATE STUDENT LEDGERS (THE FIX)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Force update all active ledgers to match the sum of their fee structure components.

DO $$
DECLARE
    v_ledger RECORD;
    v_real_total NUMERIC;
    v_structure_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_count INTEGER := 0;
BEGIN
    FOR v_ledger IN 
        SELECT sfl.id, sfl.student_id, sfl.academic_year_id, sfl.total_amount, sp.grade
        FROM public.student_fee_ledger sfl
        JOIN public.student_profiles sp ON sfl.student_id = sp.user_id
        WHERE sfl.status = 'active'
    LOOP
        -- 1. Find the Correct Fee Structure (using strict V13 logic)
        v_normalized_grade := TRIM(REPLACE(REPLACE(v_ledger.grade, 'Class ', ''), 'class ', ''));
        
        SELECT id INTO v_structure_id FROM public.fee_structures 
        WHERE academic_cycle_id = v_ledger.academic_year_id
        AND (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
        AND (
            target_grade = v_ledger.grade 
            OR target_grade = v_normalized_grade
            OR TRIM(REPLACE(REPLACE(target_grade, 'Class ', ''), 'class ', '')) = v_normalized_grade
        )
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_structure_id IS NOT NULL THEN
            -- 2. Calculate Correct Total
            SELECT COALESCE(SUM(amount), 0) INTO v_real_total 
            FROM public.fee_components WHERE structure_id = v_structure_id;

            -- 3. Validation: If mismatch detected (e.g. 132000 vs 66000), Repair it
            IF v_real_total > 0 AND v_real_total != v_ledger.total_amount THEN
                
                -- Update Ledger
                UPDATE public.student_fee_ledger 
                SET total_amount = v_real_total, updated_at = NOW()
                WHERE id = v_ledger.id;
                
                -- Advanced Repair: Handle Partial Payments
                v_structure_id := v_structure_id; -- no-op, just context
                
                -- Delete purely pending installments
                DELETE FROM public.installment_schedule 
                WHERE ledger_id = v_ledger.id AND paid_amount = 0;

                -- Check what's paid so far
                SELECT COALESCE(SUM(paid_amount), 0) INTO v_real_total 
                FROM public.installment_schedule WHERE ledger_id = v_ledger.id;

                -- Calculate remaining correct balance
                v_real_total := v_real_total; -- Total paid
                -- Re-fetch correct fee total (v_real_total was repurposed, reset it)
                SELECT COALESCE(SUM(amount), 0) INTO v_real_total 
                FROM public.fee_components WHERE structure_id = v_structure_id;

                -- If remaining needed, generate new installments for the delta
                IF (v_real_total - (SELECT COALESCE(SUM(paid_amount), 0) FROM public.installment_schedule WHERE ledger_id = v_ledger.id)) > 0 THEN
                     -- Standard generation will see existing rows? 
                     -- V13 generate_installments aborts if ANY rows exist.
                     -- We need a custom generation here for the repair.
                     
                     INSERT INTO public.installment_schedule (
                        ledger_id, installment_no, amount, paid_amount, due_date, status
                     ) VALUES (
                        v_ledger.id,
                        (SELECT COALESCE(MAX(installment_no), 0) + 1 FROM public.installment_schedule WHERE ledger_id = v_ledger.id),
                        (v_real_total - (SELECT COALESCE(SUM(paid_amount), 0) FROM public.installment_schedule WHERE ledger_id = v_ledger.id)),
                        0,
                        (SELECT COALESCE(start_date, CURRENT_DATE) + INTERVAL '6 months' FROM public.academic_years WHERE id = v_ledger.academic_year_id),
                        'pending'
                     );
                END IF;

                v_count := v_count + 1;
                RAISE NOTICE 'Repaired Ledger for Student %: Old % -> New %', v_ledger.student_id, v_ledger.total_amount, v_real_total;
            END IF;
        END IF;
    END LOOP;
    RAISE NOTICE 'Total Ledgers Repaired: %', v_count;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [4] VERIFICATION: RECONCILE ACCOUNTS
-- ═══════════════════════════════════════════════════════════════════════════════
-- Re-run reconciliation for all affected students to ensure Summary Cards are correct.

DO $$
DECLARE
    v_st_id UUID;
BEGIN
    FOR v_st_id IN SELECT student_id FROM public.student_fee_ledger WHERE updated_at > (NOW() - INTERVAL '1 minute')
    LOOP
        PERFORM public.admin_reconcile_student_account(v_st_id);
    END LOOP;
END $$;

COMMIT;

SELECT 'SUCCESS: Duplication Repair Protocol Executed. Ledgers Synchronized.' as status;
