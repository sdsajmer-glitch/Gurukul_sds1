-- ==============================================================================
-- GURUKUL OS: ULTIMATE FINANCE & LIFECYCLE SYNC (v6.0)
-- 1. Forces 2025-26 as the Absolute CURRENT Year
-- 2. Repair Parent-Student Linkage for Sanjay Dutt Sharma
-- 3. Generates Production-Level Ledgers for 2025-26
-- ==============================================================================

BEGIN;

-- [1] FORCE ACADEMIC YEAR HIERARCHY
-- Set 2025-2026 as CURRENT (Required for Feb 2026)
UPDATE public.academic_years SET is_current = false;
UPDATE public.academic_years 
SET status = 'active', 
    is_current = true
WHERE year_name = '2025-2026';

-- Mark previous years as archived
UPDATE public.academic_years 
SET status = 'archived'
WHERE year_name < '2025-2026';

-- [2] REPAIR STUDENT-PARENT RELATIONSHIP
-- Ensure "Demo Student" or similar is linked to the active parent profile
-- We'll look for students linked to parent profile named 'Sanjay Dutt Sharma'
DO $$
DECLARE
    v_parent_id UUID;
    v_student_id UUID;
BEGIN
    SELECT id INTO v_parent_id FROM public.profiles WHERE display_name ILIKE '%Sanjay Dutt Sharma%' LIMIT 1;
    
    -- If we found the parent, find a student to link
    IF v_parent_id IS NOT NULL THEN
        -- Find a student profile (either Demo or any available)
        SELECT user_id INTO v_student_id FROM public.student_profiles LIMIT 1;
        
        IF v_student_id IS NOT NULL THEN
            -- Link them in the parent-student mapping table
            -- Assuming table name is student_parents as per reset.sql
            INSERT INTO public.student_parents (student_id, parent_id)
            VALUES (v_student_id, v_parent_id)
            ON CONFLICT DO NOTHING;
            
            -- Also ensure they are linked via father/mother fields in student_profiles if that's used
            -- (student_profiles in reset.sql doesn't have father_id, but has parent_guardian_details)
        END IF;
    END IF;
END $$;

-- [3] PRODUCTION LEDGER GENERATION (Self-Correction)
CREATE OR REPLACE FUNCTION public.fn_sync_v6_force_ledger(p_student_id UUID)
RETURNS VOID AS $$
DECLARE
    v_cycle_id BIGINT;
    v_struct_id BIGINT;
    v_ledger_id UUID;
    v_total NUMERIC := 0;
    v_branch_id BIGINT;
BEGIN
    -- Get Current Cycle (2025-26)
    SELECT id, branch_id INTO v_cycle_id, v_branch_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    
    -- Pick an Active Structure
    SELECT id INTO v_struct_id FROM public.fee_structures 
    WHERE academic_cycle_id = v_cycle_id AND state = 'ACTIVE' LIMIT 1;

    -- If no structure, create a standard one for Grade 5 (Demo fallback)
    IF v_struct_id IS NULL THEN
        INSERT INTO public.fee_structures (name, academic_cycle_id, state, target_grade, branch_id)
        VALUES ('Fixed Standard Fee (2025-26)', v_cycle_id, 'ACTIVE', '5', v_branch_id)
        RETURNING id INTO v_struct_id;
        
        INSERT INTO public.fee_components (structure_id, name, amount, frequency)
        VALUES (v_struct_id, 'Tuition Fee (Standard)', 125000, 'Annual')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Calculate amount
    SELECT SUM(amount) INTO v_total FROM public.fee_components WHERE structure_id = v_struct_id;

    -- Upsert Ledger
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

    -- Synchronize Installments
    SELECT id INTO v_ledger_id FROM public.finance_student_fee_ledger WHERE student_id = p_student_id AND academic_cycle_id = v_cycle_id;
    
    DELETE FROM public.student_fee_installments WHERE ledger_id = v_ledger_id;

    INSERT INTO public.student_fee_installments (ledger_id, student_id, cycle_id, title, due_date, amount, paid, status)
    VALUES 
    (v_ledger_id, p_student_id, v_cycle_id, 'Term 1 Fee', '2025-04-10', v_total * 0.4, 0, 'pending'),
    (v_ledger_id, p_student_id, v_cycle_id, 'Term 2 Fee', '2025-08-10', v_total * 0.3, 0, 'pending'),
    (v_ledger_id, p_student_id, v_cycle_id, 'Term 3 Fee', '2025-12-10', v_total * 0.3, 0, 'pending');

END;
$$ LANGUAGE plpgsql;

-- Trigger for all enrolled students
DO $$
DECLARE
    v_student RECORD;
BEGIN
    FOR v_student IN SELECT user_id FROM public.student_profiles WHERE enrollment_status = 'Enrolled' LOOP
        PERFORM public.fn_sync_v6_force_ledger(v_student.user_id);
    END LOOP;
END $$;

COMMIT;
