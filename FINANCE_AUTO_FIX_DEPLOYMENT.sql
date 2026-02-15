-- =============================================================================
-- FINANCE AUTO-FIX & DEPLOYMENT SCRIPT (V2)
-- =============================================================================
-- Target: Resolves "column grade does not exist" and activates auto-billing.
-- Action: Rebuilds Finance Engine + Lifecycle Triggers + Global Repair.
-- =============================================================================

BEGIN;

-- [1] REBUILD CORE ENGINE (Fixed Column Mapping)
CREATE OR REPLACE FUNCTION public.enroll_student_finance_protocol(
    p_student_id UUID,
    p_grade TEXT,
    p_cycle_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_struct_id UUID;
    v_installment RECORD;
    v_count INTEGER := 0;
BEGIN
    -- 1. Identify active structure (FIXED: target_grade instead of grade)
    SELECT id INTO v_struct_id
    FROM public.fee_structures
    WHERE target_grade = p_grade 
      AND academic_cycle_id = p_cycle_id 
      AND status = 'Active'
    LIMIT 1;

    IF v_struct_id IS NULL THEN
        -- Fallback to name-based match if target_grade is null for some reason
        SELECT id INTO v_struct_id
        FROM public.fee_structures
        WHERE name ILIKE '%' || p_grade || '%' 
          AND academic_cycle_id = p_cycle_id 
          AND status = 'Active'
        LIMIT 1;
    END IF;

    IF v_struct_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Structural Fault: No Active Fee Structure for Grade ' || p_grade);
    END IF;

    -- 2. Deploy Installment Schedule (Idempotent)
    FOR v_installment IN 
        SELECT id, name, amount, due_date FROM public.fee_structure_installments WHERE fee_structure_id = v_struct_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
              AND fee_structure_id = v_struct_id 
              AND title = v_installment.name
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, fee_structure_id, total_amount, paid_amount, 
                due_date, status, title, academic_cycle_id
            )
            VALUES (
                p_student_id, v_struct_id, v_installment.amount, 0,
                v_installment.due_date, 'pending', v_installment.name, p_cycle_id
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 3. Synchronize Account Snapshot
    -- Using internal call to ensure consistency
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'invoices_generated', v_count);
END;
$$;

-- [2] REBUILD REPAIR ENGINE
CREATE OR REPLACE FUNCTION public.global_repair_finance_ledgers()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student RECORD;
    v_cycle_id BIGINT;
    v_count INTEGER := 0;
    v_res JSONB;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();
    
    FOR v_student IN 
        SELECT sp.user_id, sp.grade 
        FROM public.student_profiles sp
        JOIN public.profiles p ON sp.user_id = p.id
        WHERE p.is_active = true AND sp.grade IS NOT NULL
    LOOP
        v_res := public.enroll_student_finance_protocol(v_student.user_id, v_student.grade, v_cycle_id);
        IF (v_res->>'success')::BOOLEAN THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'students_repaired', v_count);
END;
$$;

-- [3] REBUILD AUTOMATION TRIGGER
CREATE OR REPLACE FUNCTION public.trigger_enroll_finance_v2()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_cycle_id BIGINT;
    v_grade TEXT;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();
    
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = NEW.student_id;
    
    IF v_grade IS NULL AND to_jsonb(NEW) ? 'grade_level' THEN
        v_grade := NEW.grade_level;
    END IF;

    IF v_grade IS NOT NULL AND v_cycle_id IS NOT NULL THEN
        PERFORM public.enroll_student_finance_protocol(NEW.student_id, v_grade, v_cycle_id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- [4] BIND TRIGGERS (Re-Bind)
DROP TRIGGER IF EXISTS on_enrollment_finance_init ON public.student_enrollments;
CREATE TRIGGER on_enrollment_finance_init
    AFTER INSERT ON public.student_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_enroll_finance_v2();

DROP TRIGGER IF EXISTS on_profile_finance_sync ON public.student_profiles;
CREATE TRIGGER on_profile_finance_sync
    AFTER INSERT OR UPDATE OF grade ON public.student_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_enroll_finance_v2();

-- [5] RUN GLOBAL REPAIR
SELECT public.global_repair_finance_ledgers();

COMMIT;

SELECT 'SUCCESS: Finance System Rebuilt and Synchronized.' as status;
