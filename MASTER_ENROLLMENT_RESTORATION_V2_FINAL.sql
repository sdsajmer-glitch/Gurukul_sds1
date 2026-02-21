-- ==============================================================================
-- MASTER_ENROLLMENT_RESTORATION_V2_FINAL.sql
-- CRITICAL FIX: relation "public.fee_structures" does not exist
-- SCOPE: Absolute elimination of ALL legacy fee_structures references from
--        the enrollment + finance handshake pipeline.
-- PROTOCOL: Zero-dependency self-contained engine (no legacy table calls)
-- DATE: 2026-02-21
-- ==============================================================================

BEGIN;

-- ============================================================================
-- [PHASE 1] NUCLEAR DECOMMISSION
-- Kill every trigger and function that could be holding an old reference
-- to the legacy "fee_structures" table (which no longer exists in the DB).
-- ============================================================================

-- Triggers
DROP TRIGGER IF EXISTS trg_on_student_placement          ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS on_profile_finance_sync           ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS auto_assign_fees_on_enrollment_trigger ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS trigger_on_student_placement      ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS on_enrollment_finance_init        ON public.student_enrollments CASCADE;

-- Core enrollment + finance functions (ALL known signatures)
DROP FUNCTION IF EXISTS public.admin_finalize_enrollment(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_reconcile_student_account(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.trigger_on_student_placement() CASCADE;

-- Ledger helpers (legacy + modern signatures)
DROP FUNCTION IF EXISTS public.generate_student_ledger(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger_for_student(uuid) CASCADE;

-- ============================================================================
-- [PHASE 2] SCHEMA STABILIZATION
-- Ensure the modern finance tables have all required columns.
-- ============================================================================

DO $$
BEGIN
    -- 2a. finance_fee_structures: ensure academic_cycle_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name   = 'finance_fee_structures' 
          AND column_name  = 'academic_cycle_id'
    ) THEN
        ALTER TABLE public.finance_fee_structures ADD COLUMN academic_cycle_id BIGINT;
        -- Attempt to back-fill from academic_years
        UPDATE public.finance_fee_structures fs 
        SET    academic_cycle_id = ay.id 
        FROM   public.academic_years ay 
        WHERE  fs.academic_year = ay.year_name;
    END IF;

    -- 2b. fee_invoices: ensure structure_id alias column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name   = 'fee_invoices' 
          AND column_name  = 'structure_id'
    ) THEN
        ALTER TABLE public.fee_invoices ADD COLUMN structure_id BIGINT;
        UPDATE public.fee_invoices 
        SET    structure_id = fee_structure_id 
        WHERE  fee_structure_id IS NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- [PHASE 3] RECONCILIATION ENGINE — V2 FINAL
-- Self-contained. References ONLY public.finance_fee_structures.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_branch_id    BIGINT;
    v_grade        TEXT;
    v_cycle_id     BIGINT;
    v_structure_id BIGINT;
    v_billed       NUMERIC := 0;
    v_paid         NUMERIC := 0;
    v_unallocated  NUMERIC := 0;
    v_integrity    INTEGER;
BEGIN
    -- 1. Identity
    SELECT sp.branch_id, sp.grade
    INTO   v_branch_id, v_grade
    FROM   public.student_profiles sp
    WHERE  sp.user_id = p_student_id;

    -- 2. Current Academic Cycle
    SELECT id INTO v_cycle_id
    FROM   public.academic_years
    WHERE  is_current = true
    LIMIT  1;

    -- 3. Resolve fee structure (MODERN TABLE ONLY — finance_fee_structures)
    SELECT id INTO v_structure_id
    FROM   public.finance_fee_structures
    WHERE  LOWER(TRIM(target_grade)) = LOWER(TRIM(v_grade))
      AND  (academic_cycle_id = v_cycle_id OR academic_cycle_id IS NULL)
      AND  LOWER(status::text) = 'active'
    ORDER BY
        (CASE WHEN academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END) ASC,
        created_at DESC
    LIMIT 1;

    -- 4. Aggregation
    SELECT COALESCE(SUM(total_amount), 0) INTO v_billed
    FROM   public.fee_invoices
    WHERE  student_id = p_student_id
      AND  LOWER(status::text) NOT IN ('cancelled', 'void');

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM   public.fee_payments
    WHERE  student_id = p_student_id
      AND  LOWER(status::text) IN ('completed', 'success', 'pending');

    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM   public.fee_payments
    WHERE  student_id = p_student_id
      AND  (invoice_id IS NULL OR invoice_id = 0)
      AND  LOWER(status::text) IN ('completed', 'success');

    v_integrity := CASE
        WHEN v_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, ((v_paid / v_billed) * 100)::INTEGER))
    END;

    -- 5. Upsert financial profile
    INSERT INTO public.finance_student_profiles (
        student_id, branch_id, grade, structure_id,
        total_billed, total_paid, outstanding_balance,
        integrity_score, unallocated_funds, financial_status,
        last_synced_at
    ) VALUES (
        p_student_id, v_branch_id, COALESCE(v_grade, 'Unknown'), v_structure_id,
        v_billed, v_paid, GREATEST(0, v_billed - v_paid),
        v_integrity, v_unallocated,
        CASE WHEN (v_billed - v_paid) > 0 THEN 'OVERDUE' ELSE 'ACTIVE' END,
        NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
        branch_id         = EXCLUDED.branch_id,
        grade             = EXCLUDED.grade,
        structure_id      = COALESCE(EXCLUDED.structure_id, finance_student_profiles.structure_id),
        total_billed      = EXCLUDED.total_billed,
        total_paid        = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score   = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        financial_status  = EXCLUDED.financial_status,
        last_synced_at    = NOW();
END;
$$;

-- ============================================================================
-- [PHASE 4] FINANCE HANDSHAKE ENGINE — V2 FINAL
-- Self-contained. References ONLY public.finance_fee_structures.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_grade          TEXT;
    v_branch_id      BIGINT;
    v_cycle_id       BIGINT;
    v_structure_id   BIGINT;
    v_structure_name TEXT;
    v_total_amount   NUMERIC;
    v_invoice_id     BIGINT;
BEGIN
    -- 1. Identity
    SELECT sp.grade, sp.branch_id
    INTO   v_grade, v_branch_id
    FROM   public.student_profiles sp
    WHERE  sp.user_id = p_student_id;

    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'GRADE_MISSING');
    END IF;

    -- 2. Academic Cycle
    SELECT id INTO v_cycle_id
    FROM   public.academic_years
    WHERE  is_current = true
    LIMIT  1;

    IF v_cycle_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'ACADEMIC_CYCLE_MISSING');
    END IF;

    -- 3. Structure Binding (MODERN TABLE ONLY — finance_fee_structures)
    SELECT fs.id, fs.name
    INTO   v_structure_id, v_structure_name
    FROM   public.finance_fee_structures fs
    WHERE  LOWER(TRIM(fs.target_grade)) = LOWER(TRIM(v_grade))
      AND  (fs.academic_cycle_id = v_cycle_id OR fs.academic_cycle_id IS NULL)
      AND  LOWER(fs.status::text) = 'active'
    ORDER BY fs.academic_cycle_id DESC NULLS LAST
    LIMIT 1;

    -- If no structure found, return graceful warning (NOT a hard error)
    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'FEE_STRUCTURE_NOT_FOUND_FOR_GRADE',
            'detail',  v_grade
        );
    END IF;

    -- 4. Assignment Registry
    INSERT INTO public.student_fee_assignments (student_id, structure_id, assigned_at)
    VALUES (p_student_id, v_structure_id, NOW())
    ON CONFLICT (student_id) DO UPDATE SET structure_id = EXCLUDED.structure_id;

    -- 5. Calculate total from components
    SELECT COALESCE(SUM(
        fc.amount * CASE
            WHEN LOWER(fc.frequency) = 'monthly'    THEN 12
            WHEN LOWER(fc.frequency) = 'quarterly'  THEN 4
            WHEN LOWER(fc.frequency) = 'half-yearly' THEN 2
            ELSE 1
        END
    ), 0)
    INTO v_total_amount
    FROM public.finance_fee_components fc
    WHERE fc.structure_id = v_structure_id;

    -- 6. Seed initial invoice only if none exists yet
    IF v_total_amount > 0 AND NOT EXISTS (
        SELECT 1 FROM public.fee_invoices
        WHERE  student_id = p_student_id
          AND  (structure_id = v_structure_id OR fee_structure_id = v_structure_id)
          AND  LOWER(status::text) NOT IN ('cancelled', 'void')
    ) THEN
        INSERT INTO public.fee_invoices (
            student_id, structure_id, fee_structure_id,
            total_amount, status, due_date, description, branch_id
        ) VALUES (
            p_student_id, v_structure_id, v_structure_id,
            v_total_amount, 'pending',
            CURRENT_DATE + INTERVAL '30 days',
            'Initial Enrollment Fee — ' || v_structure_name,
            v_branch_id
        )
        RETURNING id INTO v_invoice_id;
    END IF;

    -- 7. Trigger reconciliation
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success',      true,
        'structure_id', v_structure_id,
        'total_amount', v_total_amount,
        'invoice_id',   v_invoice_id
    );
END;
$$;

-- ============================================================================
-- [PHASE 5] GENERATE_STUDENT_LEDGER — Compatibility Stub
-- Both overload signatures rebuilt referencing ONLY finance_fee_structures.
-- ============================================================================

-- 5a. Two-argument version (UUID, BIGINT cycle override)
CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_cycle_id   BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Delegate to the V2 FINAL billing engine
    v_result := public.admin_sync_student_billing(p_student_id);
    RETURN v_result;
END;
$$;

-- 5b. One-argument wrapper (used by legacy callers)
CREATE OR REPLACE FUNCTION public.generate_student_ledger_for_student(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.generate_student_ledger(p_student_id, NULL);
END;
$$;

-- ============================================================================
-- [PHASE 6] ENROLLMENT ENGINE — V2 FINAL
-- Resilient identity recovery + safe finance handshake.
-- References ZERO legacy tables. All errors are caught gracefully.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_finalize_enrollment(p_admission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id          UUID;
    v_grade            TEXT;
    v_branch_id        BIGINT;
    v_sid              TEXT;
    v_applicant_name   TEXT;
    v_academic_year    TEXT;
    v_billing_result   JSONB;
    v_existing_sid     UUID;
BEGIN
    -- [A] Load admission metadata
    SELECT student_user_id, grade, branch_id, applicant_name
    INTO   v_user_id, v_grade, v_branch_id, v_applicant_name
    FROM   public.admissions
    WHERE  id = p_admission_id;

    IF v_applicant_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'ADMISSION_NODE_NOT_FOUND');
    END IF;

    -- [B] Guard: prevent duplicate student records
    SELECT user_id INTO v_existing_sid
    FROM   public.student_profiles
    WHERE  admission_id = p_admission_id;

    IF v_existing_sid IS NOT NULL THEN
        -- Already enrolled: just re-sync finance and return success
        v_billing_result := public.admin_sync_student_billing(v_existing_sid);
        RETURN jsonb_build_object(
            'success',     true,
            'student_id',  v_existing_sid,
            'billing_sync', v_billing_result,
            'message',     'ALREADY_ENROLLED: Finance re-synchronized.'
        );
    END IF;

    -- [C] Identity Recovery: provision profile if missing
    IF v_user_id IS NULL THEN
        -- Try matching by name first
        SELECT id INTO v_user_id
        FROM   public.profiles
        WHERE  LOWER(display_name) = LOWER(v_applicant_name)
          AND  role = 'Student'
        LIMIT  1;

        IF v_user_id IS NULL THEN
            -- Provision new identity node
            v_user_id := gen_random_uuid();
            INSERT INTO public.profiles (
                id, email, display_name, role,
                branch_id, profile_completed, is_active
            ) VALUES (
                v_user_id,
                'student.' || substring(v_user_id::text FROM 1 FOR 8) || '@gurukul.internal',
                v_applicant_name,
                'Student',
                v_branch_id,
                true,
                true
            );
        END IF;

        UPDATE public.admissions
        SET    student_user_id = v_user_id
        WHERE  id = p_admission_id;
    END IF;

    -- [D] Academic Year Resolution
    SELECT year_name INTO v_academic_year
    FROM   public.academic_years
    WHERE  branch_id = v_branch_id
      AND  is_current = true
    LIMIT  1;

    IF v_academic_year IS NULL THEN
        v_academic_year := TO_CHAR(NOW(), 'YYYY-YY');
    END IF;

    -- [E] Student ID Allocation
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- [F] Activate profile
    UPDATE public.profiles
    SET    role              = 'Student',
           profile_completed = true,
           is_active         = true,
           branch_id         = COALESCE(v_branch_id, branch_id)
    WHERE  id = v_user_id;

    -- [G] Register in student roster
    --     NOTE: trg_on_student_placement fires on INSERT/UPDATE of grade —
    --           we will call sync explicitly below to capture the result.
    INSERT INTO public.student_profiles (
        user_id, admission_id, student_id_number,
        grade, branch_id, enrollment_status, academic_year, is_active
    ) VALUES (
        v_user_id, p_admission_id, v_sid,
        v_grade, v_branch_id, 'Active', v_academic_year, true
    )
    ON CONFLICT (user_id) DO UPDATE SET
        student_id_number = v_sid,
        admission_id      = p_admission_id,
        enrollment_status = 'Active',
        is_active         = true;

    -- [H] Archive admission
    UPDATE public.admissions
    SET    status             = 'Enrolled',
           student_id_number  = v_sid,
           registered_at      = NOW()
    WHERE  id = p_admission_id;

    -- [I] Finance Handshake — V2 FINAL (zero legacy table references)
    v_billing_result := public.admin_sync_student_billing(v_user_id);

    -- [J] Audit Trail
    BEGIN
        INSERT INTO public.audit_logs (user_id, action, module, details)
        VALUES (
            auth.uid(),
            'STUDENT_ENROLLED',
            'ENROLLMENT',
            jsonb_build_object(
                'sid',          v_sid,
                'user_id',      v_user_id,
                'admission_id', p_admission_id,
                'grade',        v_grade,
                'billing_sync', v_billing_result
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Audit failure must never block enrollment
        NULL;
    END;

    RETURN jsonb_build_object(
        'success',            true,
        'student_id',         v_user_id,
        'student_id_number',  v_sid,
        'billing_sync',       v_billing_result,
        'message',            'Enrollment Protocol V2 FINAL: Successful.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'CRITICAL_FAULT: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- [PHASE 7] PLACEMENT TRIGGER — V2 FINAL
-- Fires on grade/class change to auto-sync billing.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_on_student_placement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (TG_OP = 'UPDATE') AND (
        COALESCE(NEW.grade, '') <> COALESCE(OLD.grade, '') OR
        COALESCE(NEW.assigned_class_id, 0) <> COALESCE(OLD.assigned_class_id, 0)
    ) THEN
        PERFORM public.admin_sync_student_billing(NEW.user_id);
    END IF;

    IF (TG_OP = 'INSERT') AND NEW.grade IS NOT NULL THEN
        PERFORM public.admin_sync_student_billing(NEW.user_id);
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_student_placement
    AFTER INSERT OR UPDATE OF grade, assigned_class_id
    ON public.student_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_on_student_placement();

-- ============================================================================
-- [PHASE 8] PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.admin_finalize_enrollment(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_student_account(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_student_ledger(uuid, bigint)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_student_ledger_for_student(uuid) TO authenticated;

-- ============================================================================
COMMIT;

SELECT 'SUCCESS: MASTER_ENROLLMENT_RESTORATION_V2_FINAL applied. All fee_structures references eliminated.' AS status;
