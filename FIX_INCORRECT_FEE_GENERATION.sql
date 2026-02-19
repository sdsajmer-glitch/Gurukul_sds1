-- =============================================================================
-- FIX FEE CALCULATION MISMATCH & REMOVE GHOST INVOICES
-- Description: Detects students with "Orphaned" financial states (Invoices but no Structure).
--              Voids incorrect "Genesis" invoices (125k) and re-applies correct Grade structure (60k).
-- =============================================================================

BEGIN;

-- 1. Create a Helper to "Reset & Re-Assess" a Student
CREATE OR REPLACE FUNCTION public.admin_reset_student_fee_structure(p_student_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_grade TEXT;
    v_structure_id BIGINT;
    v_payment_count INT;
    v_invoice_count INT;
BEGIN
    -- 1. Check for Payments (Safety Protocol)
    SELECT COUNT(*) INTO v_payment_count FROM fee_payments WHERE student_id = p_student_id AND status = 'completed';
    IF v_payment_count > 0 THEN
        RETURN 'SKIPPED: Student has active payments. Cannot auto-reset.';
    END IF;

    -- 2. Get Student Grade
    SELECT grade INTO v_grade FROM student_profiles WHERE user_id = p_student_id;
    IF v_grade IS NULL THEN
        RETURN 'ERROR: Student has no grade assigned.';
    END IF;

    -- 3. Find Correct Fee Structure for Grade
    SELECT id INTO v_structure_id 
    FROM fee_structures 
    WHERE target_grade = v_grade 
      AND status = 'Active' 
      AND is_default = true
    ORDER BY created_at DESC 
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN 'ERROR: No active fee structure found for Grade ' || v_grade;
    END IF;

    -- 4. Purge "Ghost" Invoices (Unpaid only)
    DELETE FROM fee_invoices 
    WHERE student_id = p_student_id 
      AND status IN ('pending', 'draft', 'overdue')
      AND paid_amount = 0;

    -- 5. Clear Old/Bad Assignments
    DELETE FROM student_fee_assignments WHERE student_id = p_student_id;

    -- 6. Assign Correct Structure
    INSERT INTO student_fee_assignments (student_id, structure_id, status)
    VALUES (p_student_id, v_structure_id, 'Active');

    -- 7. Regenerate Ledger (Create new Invoice)
    -- Assuming generate_student_ledger or similar exists, or we auto-create invoice here.
    -- Let's use the standard flow if possible, or manual insert.
    
    -- Manual Invoice Creation for robust fix
    INSERT INTO fee_invoices (
        student_id,
        structure_id,
        total_amount,
        due_date,
        description,
        status,
        branch_id
    )
    SELECT 
        p_student_id,
        v_structure_id,
        (SELECT SUM(amount) FROM fee_components WHERE structure_id = v_structure_id),
        (CURRENT_DATE + INTERVAL '30 days'),
        'Academic Fee Assessment (Corrected)',
        'pending',
        (SELECT branch_id FROM student_profiles WHERE user_id = p_student_id)
    WHERE EXISTS (SELECT 1 FROM fee_components WHERE structure_id = v_structure_id);

    -- 8. Sync Ledger Summary
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_sync_student_ledger_summary') THEN
        -- Trigger manually by update if needed, but the INSERT above handles it via trigger
        PERFORM public.recalculate_all_student_ledgers((SELECT branch_id FROM student_profiles WHERE user_id = p_student_id));
    END IF;

    RETURN 'SUCCESS: Reset to Grade ' || v_grade || ' Structure.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bulk Fix for "Genesis Protocol" Orphans
-- Finds all students with total_billed > 0 but NO payments and NO structure link
DO $$
DECLARE
    r RECORD;
    v_res TEXT;
BEGIN
    FOR r IN 
        SELECT sp.user_id 
        FROM student_profiles sp
        JOIN student_fee_accounts sfa ON sp.user_id = sfa.student_id
        LEFT JOIN student_fee_assignments sfas ON sp.user_id = sfas.student_id
        WHERE sfa.total_billed > 0 
          AND sfa.total_paid = 0
          AND sfas.id IS NULL -- "Orphan" state
    LOOP
        v_res := public.admin_reset_student_fee_structure(r.user_id);
    END LOOP;
END $$;

COMMIT;
