-- ==============================================================================
-- MASTER_ENROLLMENT_FINALIZATION_RESTORATION_V1.sql
-- Resolution: Relation "fee_structures" does not exist & Enrollment Logic Fix
-- Objective: Absolute Harmonization of Enrollment & Finance Nodes
-- ==============================================================================

BEGIN;

-- [1] NUCLEAR TRIGGER & FUNCTION DECOMMISSIONING
-- Remove all components known to reference the legacy 'fee_structures' table
DROP TRIGGER IF EXISTS trg_on_student_placement ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS on_profile_finance_sync ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS auto_assign_fees_on_enrollment_trigger ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS trigger_on_student_placement ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS on_enrollment_finance_init ON public.student_enrollments CASCADE;

DROP FUNCTION IF EXISTS public.admin_finalize_enrollment(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger_for_student(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.trigger_on_student_placement() CASCADE;
DROP FUNCTION IF EXISTS public.admin_reconcile_student_account(uuid) CASCADE;

-- [2] SCHEMA STABILIZATION
-- Ensure finance tables have the modern columns used by the V50+ protocol
DO $$
BEGIN
    -- Ensure academic_cycle_id exists in finance_fee_structures (fallback for academic_year)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_structures' AND column_name = 'academic_cycle_id') THEN
        ALTER TABLE public.finance_fee_structures ADD COLUMN academic_cycle_id BIGINT;
        -- Attempt to backfill from academic_years if matches exist
        UPDATE public.finance_fee_structures fs 
        SET academic_cycle_id = ay.id 
        FROM public.academic_years ay 
        WHERE fs.academic_year = ay.year_name;
    END IF;

    -- Ensure structure_id exists in fee_invoices (alias for fee_structure_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'structure_id') THEN
        ALTER TABLE public.fee_invoices ADD COLUMN structure_id BIGINT;
        UPDATE public.fee_invoices SET structure_id = fee_structure_id WHERE fee_structure_id IS NOT NULL;
    END IF;
END $$;

-- [3] REBUILD RECONCILIATION ENGINE (V51 Compatible)
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_billed        NUMERIC := 0;
    v_paid          NUMERIC := 0;
    v_unallocated   NUMERIC := 0;
    v_integrity     INTEGER;
    v_branch_id     BIGINT;
    v_grade         TEXT;
    v_structure_id  BIGINT;
    v_cycle_id      BIGINT;
BEGIN
    -- 1. Identity Fetch
    SELECT sp.branch_id, sp.grade INTO v_branch_id, v_grade 
    FROM public.student_profiles sp WHERE sp.user_id = p_student_id;

    -- 2. Cycle Detection
    SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;

    -- 3. Structure Resolution (Modern Case-Insensitive)
    SELECT id INTO v_structure_id 
    FROM public.finance_fee_structures 
    WHERE LOWER(TRIM(target_grade)) = LOWER(TRIM(v_grade)) 
    AND (academic_cycle_id = v_cycle_id OR academic_cycle_id IS NULL)
    AND LOWER(status::text) = 'active'
    ORDER BY (CASE WHEN academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), created_at DESC LIMIT 1;

    -- 4. Calculate Magnitude
    SELECT COALESCE(SUM(total_amount), 0) INTO v_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND LOWER(status::text) NOT IN ('cancelled', 'void');

    SELECT COALESCE(SUM(amount), 0) INTO v_paid 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND LOWER(status::text) IN ('completed', 'success', 'pending');

    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND (invoice_id IS NULL OR invoice_id = 0) AND LOWER(status::text) IN ('completed', 'success');

    v_integrity := CASE 
        WHEN v_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, ((v_paid / v_billed) * 100)::INTEGER))
    END;

    -- 5. Atomic State Update
    INSERT INTO public.finance_student_profiles (
        student_id, branch_id, grade, structure_id,
        total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds, financial_status
    )
    VALUES (
        p_student_id, v_branch_id, v_grade, v_structure_id,
        v_billed, v_paid, GREATEST(0, v_billed - v_paid), 
        v_integrity, NOW(), v_unallocated, 
        CASE WHEN (v_billed - v_paid) > 0 THEN 'OVERDUE' ELSE 'ACTIVE' END
    )
    ON CONFLICT (student_id) DO UPDATE SET
        branch_id = EXCLUDED.branch_id,
        grade = EXCLUDED.grade,
        structure_id = COALESCE(EXCLUDED.structure_id, finance_student_profiles.structure_id),
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        financial_status = EXCLUDED.financial_status,
        last_synced_at = NOW();
END;
$$;

-- [4] REBUILD FINANCE HANDSHAKE
CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_grade            TEXT;
    v_branch_id        BIGINT;
    v_cycle_id         BIGINT;
    v_structure_id     BIGINT;
    v_structure_name   TEXT;
    v_total_amount     NUMERIC;
    v_invoice_id       BIGINT;
BEGIN
    -- 1. Identity & Context
    SELECT sp.grade, sp.branch_id INTO v_grade, v_branch_id FROM public.student_profiles sp WHERE sp.user_id = p_student_id;
    SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    
    IF v_grade IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'GRADE_MISSING'); END IF;
    IF v_cycle_id IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'ACADEMIC_CYCLE_MISSING'); END IF;

    -- 2. Structure Binding
    SELECT fs.id, fs.name INTO v_structure_id, v_structure_name
    FROM public.finance_fee_structures fs
    WHERE LOWER(TRIM(fs.target_grade)) = LOWER(TRIM(v_grade)) 
    AND (fs.academic_cycle_id = v_cycle_id OR fs.academic_cycle_id IS NULL)
    AND LOWER(fs.status::text) = 'active'
    ORDER BY fs.academic_cycle_id DESC NULLS LAST LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'FEE_STRUCTURE_NOT_FOUND_FOR_GRADE', 'detail', v_grade);
    END IF;

    -- 3. Assignment & Ledger Generation
    INSERT INTO public.student_fee_assignments (student_id, structure_id, assigned_at)
    VALUES (p_student_id, v_structure_id, NOW())
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    SELECT COALESCE(SUM(fc.amount * CASE 
        WHEN LOWER(fc.frequency) = 'monthly' THEN 12 
        WHEN LOWER(fc.frequency) = 'quarterly' THEN 4 
        ELSE 1 END), 0)
    INTO v_total_amount
    FROM public.finance_fee_components fc
    WHERE fc.structure_id = v_structure_id;

    -- 4. Annual Invoice Purge & Seed
    IF v_total_amount > 0 AND NOT EXISTS (
        SELECT 1 FROM public.fee_invoices 
        WHERE student_id = p_student_id AND (structure_id = v_structure_id OR fee_structure_id = v_structure_id)
        AND LOWER(status::text) NOT IN ('cancelled', 'void')
    ) THEN
        INSERT INTO public.fee_invoices (
            student_id, structure_id, fee_structure_id, total_amount, status, due_date, description, branch_id
        ) VALUES (
            p_student_id, v_structure_id, v_structure_id, v_total_amount, 'pending', 
            CURRENT_DATE + INTERVAL '30 days', 'Initial Enrollment Fee — ' || v_structure_name, v_branch_id
        ) RETURNING id INTO v_invoice_id;
    END IF;

    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'structure_id', v_structure_id, 'total_amount', v_total_amount);
END;
$$;

-- [5] REBUILD ENROLLMENT ENGINE (Frictionless Master)
CREATE OR REPLACE FUNCTION public.admin_finalize_enrollment(p_admission_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id UUID;
    v_grade TEXT;
    v_branch_id BIGINT;
    v_sid TEXT;
    v_applicant_name TEXT;
    v_academic_year TEXT;
    v_billing_result JSONB;
BEGIN
    -- 1. Identity Load
    SELECT student_user_id, grade, branch_id, applicant_name
    INTO v_user_id, v_grade, v_branch_id, v_applicant_name
    FROM public.admissions WHERE id = p_admission_id;

    IF v_applicant_name IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'ADMISSION_NODE_NOT_FOUND'); END IF;

    -- 2. Recovery: Provision Identity if missing
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO public.profiles (id, email, display_name, role, branch_id, profile_completed, is_active)
        VALUES (v_user_id, 'student.' || substring(v_user_id::text from 1 for 8) || '@gurukul.internal', v_applicant_name, 'Student', v_branch_id, true, true);
        UPDATE public.admissions SET student_user_id = v_user_id WHERE id = p_admission_id;
    END IF;

    -- 3. Temporal Resolution
    SELECT year_name INTO v_academic_year FROM public.academic_years WHERE branch_id = v_branch_id AND is_current = true LIMIT 1;
    IF v_academic_year IS NULL THEN v_academic_year := TO_CHAR(NOW(), 'YYYY-YY'); END IF;

    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- 4. Roster Registration
    UPDATE public.profiles SET role = 'Student', is_active = true WHERE id = v_user_id;

    INSERT INTO public.student_profiles (user_id, admission_id, student_id_number, grade, branch_id, enrollment_status, is_active, academic_year)
    VALUES (v_user_id, p_admission_id, v_sid, v_grade, v_branch_id, 'Active', true, v_academic_year)
    ON CONFLICT (user_id) DO UPDATE SET 
        enrollment_status = 'Active', 
        student_id_number = v_sid,
        admission_id = p_admission_id;

    -- 5. Admission Archiving
    UPDATE public.admissions SET status = 'Enrolled', student_id_number = v_sid, registered_at = now() WHERE id = p_admission_id;

    -- 6. Financial Handshake (Modern V51+ Path)
    -- This call is now safe from "fee_structures" errors
    v_billing_result := public.admin_sync_student_billing(v_user_id);

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'billing_sync', v_billing_result,
        'message', 'Enrollment Protocol Successful.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'CRITICAL_FAULT: ' || SQLERRM);
END;
$$;

-- [6] REBUILD PLACEMENT TRIGGER
CREATE OR REPLACE FUNCTION public.trigger_on_student_placement()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') AND (COALESCE(NEW.grade, '') <> COALESCE(OLD.grade, '') OR COALESCE(NEW.assigned_class_id, 0) <> COALESCE(OLD.assigned_class_id, 0)) THEN
        PERFORM public.admin_sync_student_billing(NEW.user_id);
    END IF;
    IF (TG_OP = 'INSERT') AND NEW.grade IS NOT NULL THEN
        PERFORM public.admin_sync_student_billing(NEW.user_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_student_placement
    AFTER INSERT OR UPDATE OF grade, assigned_class_id ON public.student_profiles
    FOR EACH ROW EXECUTE FUNCTION public.trigger_on_student_placement();

-- [7] PERMISSIONS
GRANT EXECUTE ON FUNCTION public.admin_finalize_enrollment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(uuid) TO authenticated;

COMMIT;

SELECT 'SUCCESS: Enrollment Master Protocol Restored.' as status;
