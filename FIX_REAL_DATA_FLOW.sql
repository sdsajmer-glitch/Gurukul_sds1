-- ==============================================================================
-- GURUKUL OS: REAL-TIME FINANCE SYNCHRONIZATION (v5.1)
-- Fix: Academic Year 2025-26 -> active & current
-- Fix: Realistic Ledger Generation for Demo Student
-- ==============================================================================

BEGIN;

-- [1] FIX ACADEMIC YEAR STATUS
-- Set 2025-26 as the active, current year
UPDATE public.academic_years 
SET status = 'active', 
    is_current = true
WHERE year_name = '2025-2026';

-- Ensure other years are not current
UPDATE public.academic_years 
SET is_current = false 
WHERE year_name != '2025-2026';

-- [2] ENSURE FEE STRUCTURE IS ACTIVE
UPDATE public.fee_structures 
SET state = 'ACTIVE' 
WHERE name = 'Standard Grade 5 Fee (2025-26)';

-- [3] MASTER LEDGER GENERATOR
CREATE OR REPLACE FUNCTION public.demo_generate_real_ledger(p_student_id UUID)
RETURNS VOID AS $$
DECLARE
    v_cycle_id BIGINT;
    v_struct_id BIGINT;
    v_ledger_id UUID;
    v_total NUMERIC := 0;
    v_branch_id BIGINT;
BEGIN
    -- Get Current Cycle
    SELECT id, branch_id INTO v_cycle_id, v_branch_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    
    -- Pick a structure
    SELECT id INTO v_struct_id FROM public.fee_structures 
    WHERE academic_cycle_id = v_cycle_id AND state = 'ACTIVE' LIMIT 1;

    -- Calculate total
    SELECT SUM(amount) INTO v_total FROM public.fee_components WHERE structure_id = v_struct_id;

    -- Create/Update REAL Ledger
    INSERT INTO public.finance_student_fee_ledger (
        student_id, branch_id, academic_cycle_id, fee_structure_id, 
        total_billed, total_paid, outstanding_balance, status
    )
    VALUES (
        p_student_id, v_branch_id, v_cycle_id, v_struct_id, 
        v_total, 0, v_total, 'active'
    )
    ON CONFLICT (student_id, academic_cycle_id) DO UPDATE 
    SET fee_structure_id = EXCLUDED.fee_structure_id,
        total_billed = EXCLUDED.total_billed,
        outstanding_balance = EXCLUDED.total_billed - finance_student_fee_ledger.total_paid;

    -- Get ledger ID
    SELECT id INTO v_ledger_id FROM public.finance_student_fee_ledger 
    WHERE student_id = p_student_id AND academic_cycle_id = v_cycle_id;

    -- Generate REAL Installments
    DELETE FROM public.student_fee_installments WHERE ledger_id = v_ledger_id;

    INSERT INTO public.student_fee_installments (
        ledger_id, student_id, cycle_id, title, due_date, amount, paid, status
    )
    VALUES 
    (v_ledger_id, p_student_id, v_cycle_id, 'Admission & Term 1 Fee', '2025-04-10', v_total * 0.4, 0, 'pending'),
    (v_ledger_id, p_student_id, v_cycle_id, 'Second Installment', '2025-08-10', v_total * 0.3, 0, 'pending'),
    (v_ledger_id, p_student_id, v_cycle_id, 'Final Term Fee', '2025-12-10', v_total * 0.3, 0, 'pending');

END;
$$ LANGUAGE plpgsql;

-- [4] TRIGGER FOR ACTIVE STUDENTS
DO $$
DECLARE
    v_student RECORD;
BEGIN
    FOR v_student IN SELECT user_id FROM public.student_profiles WHERE enrollment_status = 'Enrolled' LOOP
        PERFORM public.demo_generate_real_ledger(v_student.user_id);
    END LOOP;
END $$;

COMMIT;
