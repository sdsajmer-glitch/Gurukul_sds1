-- =============================================================================
-- FINANCE ENROLLMENT -> BILLING AUTO-BRIDGE
-- =============================================================================
-- Finalizes the event-driven Billing Lifecycle.
-- Ensures that any student enrollment IMMEDIATELY triggers ledger generation.
-- Runs a one-time global repair to eliminate existing ₹0 ghost states.
-- =============================================================================

BEGIN;

-- 1. Correct the Automation Trigger Function
CREATE OR REPLACE FUNCTION public.trigger_enroll_finance_v2()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_cycle_id BIGINT;
    v_grade TEXT;
BEGIN
    -- Resolve Strictly Current Cycle
    v_cycle_id := public.get_current_academic_cycle();
    
    -- Resolve Grade from Profile
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = NEW.student_id;
    
    -- If trigger on student_enrollments, we might have grade in the row too
    IF v_grade IS NULL AND to_jsonb(NEW) ? 'grade_level' THEN
        v_grade := NEW.grade_level;
    END IF;

    -- Fire Protocol
    IF v_grade IS NOT NULL AND v_cycle_id IS NOT NULL THEN
        PERFORM public.enroll_student_finance_protocol(
            NEW.student_id,
            v_grade,
            v_cycle_id
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2. Bind Trigger to student_enrollments (Primary Event)
DROP TRIGGER IF EXISTS on_enrollment_finance_init ON public.student_enrollments;
CREATE TRIGGER on_enrollment_finance_init
    AFTER INSERT ON public.student_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_enroll_finance_v2();

-- 3. Bind Trigger to student_profiles (Secondary/Update Event)
-- This ensures that if a student is manually created or grade updated, finance is initialized.
DROP TRIGGER IF EXISTS on_profile_finance_sync ON public.student_profiles;
CREATE TRIGGER on_profile_finance_sync
    AFTER INSERT OR UPDATE OF grade ON public.student_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_enroll_finance_v2();

-- 4. Execute Global Repair (Idempotent)
-- This will scan all students and fix those with missing ledgers or ₹0 states.
SELECT public.global_repair_finance_ledgers();

COMMIT;

SELECT 'SUCCESS: Finance Enrollment -> Billing Bridge Active. Global repair executed.' as status;
