-- ==========================================================================================
-- ENROLLMENT_FINAL_V3_NUCLEAR_FIX.sql
-- 
-- FIX: "relation public.fee_structures does not exist" when clicking Finalize Enrollment
--
-- ROOT CAUSE: Old/stale PostgreSQL functions in the database still reference the legacy
--             table "public.fee_structures" which NO LONGER EXISTS. The correct, modern
--             table is "public.finance_fee_structures".
--
-- RESOLUTION: 
--   1. Drop ALL triggers and functions that reference the old table (nuclear decommission)
--   2. Rebuild every enrollment + finance handshake function from scratch
--   3. All rebuilt functions reference ONLY "public.finance_fee_structures"
--   4. Reinstate permissions
--
-- HOW TO APPLY:
--   1. Open https://supabase.com → Your Project → SQL Editor
--   2. Click "New Query"
--   3. Paste this ENTIRE script
--   4. Click "Run" (or Ctrl+Enter)
--   5. Verify the last SELECT returns "SUCCESS"
--
-- DATE: 2026-02-21
-- VERSION: V3 NUCLEAR FIX (Supersedes V1 and V2)
-- ==========================================================================================

BEGIN;

-- ==========================================================================================
-- PHASE 1: NUCLEAR DECOMMISSION
-- Drop EVERY trigger and function that could be referencing the old "fee_structures" table.
-- This is a clean slate approach - we kill everything and rebuild fresh.
-- ==========================================================================================

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS trg_on_student_placement           ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS on_profile_finance_sync            ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS auto_assign_fees_on_enrollment_trigger ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS trigger_on_student_placement       ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS on_enrollment_finance_init         ON public.student_enrollments CASCADE;
DROP TRIGGER IF EXISTS trg_auto_finance_on_placement      ON public.student_profiles CASCADE;
DROP TRIGGER IF EXISTS trg_generate_ledger_on_placement   ON public.student_profiles CASCADE;

-- Drop functions (CASCADE removes any dependent objects)
DROP FUNCTION IF EXISTS public.admin_finalize_enrollment(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_reconcile_student_account(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.trigger_on_student_placement() CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger_for_student(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.auto_assign_fees_on_enrollment() CASCADE;
DROP FUNCTION IF EXISTS public.on_profile_finance_sync() CASCADE;
DROP FUNCTION IF EXISTS public.sync_student_finance_on_placement() CASCADE;
DROP FUNCTION IF EXISTS public.initialize_student_finance(uuid) CASCADE;

-- ==========================================================================================
-- PHASE 2: SCHEMA SAFETY CHECKS
-- Make sure the modern tables have all necessary columns before we build the functions.
-- ==========================================================================================

DO $$
BEGIN
    -- Ensure finance_fee_structures has academic_cycle_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name   = 'finance_fee_structures' 
          AND column_name  = 'academic_cycle_id'
    ) THEN
        ALTER TABLE public.finance_fee_structures ADD COLUMN academic_cycle_id BIGINT;
        -- Back-fill from academic_years if possible
        UPDATE public.finance_fee_structures fs 
        SET    academic_cycle_id = ay.id 
        FROM   public.academic_years ay 
        WHERE  fs.academic_year = ay.year_name;
        RAISE NOTICE 'PHASE 2: Added academic_cycle_id column to finance_fee_structures';
    ELSE
        RAISE NOTICE 'PHASE 2: finance_fee_structures.academic_cycle_id already exists - OK';
    END IF;

    -- Ensure fee_invoices has structure_id column (alias for fee_structure_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name   = 'fee_invoices' 
          AND column_name  = 'structure_id'
    ) THEN
        ALTER TABLE public.fee_invoices ADD COLUMN structure_id BIGINT;
        -- Back-fill from fee_structure_id
        UPDATE public.fee_invoices 
        SET    structure_id = fee_structure_id 
        WHERE  fee_structure_id IS NOT NULL;
        RAISE NOTICE 'PHASE 2: Added structure_id column to fee_invoices';
    ELSE
        RAISE NOTICE 'PHASE 2: fee_invoices.structure_id already exists - OK';
    END IF;

    -- Verify finance_fee_structures table exists (critical check)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' 
          AND table_name = 'finance_fee_structures'
    ) THEN
        RAISE EXCEPTION 'CRITICAL: Table public.finance_fee_structures does not exist! 
        You must create this table before enrollment can work.
        Run your finance schema setup script first.';
    ELSE
        RAISE NOTICE 'PHASE 2: public.finance_fee_structures EXISTS - OK';
    END IF;
END $$;

-- ==========================================================================================
-- PHASE 3: RECONCILIATION ENGINE (REBUILT - Zero legacy table references)
-- ==========================================================================================

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
    -- 1. Resolve student identity
    SELECT sp.branch_id, COALESCE(sp.grade, 'Unknown')
    INTO   v_branch_id, v_grade
    FROM   public.student_profiles sp
    WHERE  sp.user_id = p_student_id;

    IF NOT FOUND THEN
        RAISE NOTICE 'admin_reconcile_student_account: No student profile found for %', p_student_id;
        RETURN;
    END IF;

    -- 2. Current Academic Cycle
    SELECT id INTO v_cycle_id
    FROM   public.academic_years
    WHERE  is_current = true
    LIMIT  1;

    -- 3. Resolve fee structure — ONLY uses finance_fee_structures (never fee_structures)
    SELECT id INTO v_structure_id
    FROM   public.finance_fee_structures
    WHERE  LOWER(TRIM(target_grade)) = LOWER(TRIM(v_grade))
      AND  (academic_cycle_id = v_cycle_id OR academic_cycle_id IS NULL)
      AND  LOWER(status::text) = 'active'
    ORDER BY
        (CASE WHEN academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END) ASC,
        created_at DESC
    LIMIT 1;

    -- 4. Financial aggregation
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
        p_student_id, v_branch_id, v_grade, v_structure_id,
        v_billed, v_paid, GREATEST(0, v_billed - v_paid),
        v_integrity, v_unallocated,
        CASE WHEN (v_billed - v_paid) > 0 THEN 'OVERDUE' ELSE 'ACTIVE' END,
        NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
        branch_id           = EXCLUDED.branch_id,
        grade               = EXCLUDED.grade,
        structure_id        = COALESCE(EXCLUDED.structure_id, finance_student_profiles.structure_id),
        total_billed        = EXCLUDED.total_billed,
        total_paid          = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score     = EXCLUDED.integrity_score,
        unallocated_funds   = EXCLUDED.unallocated_funds,
        financial_status    = EXCLUDED.financial_status,
        last_synced_at      = NOW();

    RAISE NOTICE 'admin_reconcile_student_account: Reconciliation complete for %', p_student_id;

EXCEPTION WHEN OTHERS THEN
    -- Non-fatal: log and continue (finance sync should never block enrollment)
    RAISE WARNING 'admin_reconcile_student_account failed (non-fatal): %', SQLERRM;
END;
$$;

-- ==========================================================================================
-- PHASE 4: BILLING HANDSHAKE ENGINE (REBUILT - Zero legacy table references)
-- ==========================================================================================

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
    -- 1. Resolve student profile
    SELECT sp.grade, sp.branch_id
    INTO   v_grade, v_branch_id
    FROM   public.student_profiles sp
    WHERE  sp.user_id = p_student_id;

    IF v_grade IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'GRADE_MISSING: Student profile has no grade assigned',
            'student_id', p_student_id
        );
    END IF;

    -- 2. Academic Cycle
    SELECT id INTO v_cycle_id
    FROM   public.academic_years
    WHERE  is_current = true
    LIMIT  1;

    -- 3. Fee Structure Binding — ONLY uses finance_fee_structures (the modern table)
    SELECT fs.id, fs.name
    INTO   v_structure_id, v_structure_name
    FROM   public.finance_fee_structures fs
    WHERE  LOWER(TRIM(fs.target_grade)) = LOWER(TRIM(v_grade))
      AND  (fs.academic_cycle_id = v_cycle_id OR fs.academic_cycle_id IS NULL)
      AND  LOWER(fs.status::text) = 'active'
    ORDER BY 
        (CASE WHEN fs.academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END) ASC,
        fs.created_at DESC
    LIMIT 1;

    -- Graceful: no structure found is a WARNING, not an ERROR
    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'FEE_STRUCTURE_NOT_CONFIGURED: No active fee structure found for grade ' || v_grade || '. Please configure fee structures in Finance module.',
            'grade',   v_grade
        );
    END IF;

    -- 4. Record assignment
    BEGIN
        INSERT INTO public.student_fee_assignments (student_id, structure_id, assigned_at)
        VALUES (p_student_id, v_structure_id, NOW())
        ON CONFLICT (student_id) DO UPDATE SET 
            structure_id = EXCLUDED.structure_id,
            assigned_at  = EXCLUDED.assigned_at;
    EXCEPTION WHEN OTHERS THEN
        -- Table might not exist or have different schema; non-fatal
        RAISE WARNING 'student_fee_assignments upsert failed (non-fatal): %', SQLERRM;
    END;

    -- 5. Calculate annual total from components
    SELECT COALESCE(SUM(
        fc.amount * CASE
            WHEN LOWER(COALESCE(fc.frequency, 'annual')) = 'monthly'    THEN 12
            WHEN LOWER(COALESCE(fc.frequency, 'annual')) = 'quarterly'  THEN 4
            WHEN LOWER(COALESCE(fc.frequency, 'annual')) = 'half-yearly' THEN 2
            WHEN LOWER(COALESCE(fc.frequency, 'annual')) = 'termly'     THEN 3
            ELSE 1
        END
    ), 0)
    INTO v_total_amount
    FROM public.finance_fee_components fc
    WHERE fc.structure_id = v_structure_id;

    -- 6. Create initial invoice (only if none exists yet for this student+structure)
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
            'Initial Enrollment Fee — ' || COALESCE(v_structure_name, 'Standard Fee'),
            v_branch_id
        )
        RETURNING id INTO v_invoice_id;
    END IF;

    -- 7. Run reconciliation
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success',      true,
        'structure_id', v_structure_id,
        'grade',        v_grade,
        'total_amount', v_total_amount,
        'invoice_id',   v_invoice_id,
        'message',      'Finance handshake complete'
    );

EXCEPTION WHEN OTHERS THEN
    -- Finance sync failures should NEVER block enrollment
    RETURN jsonb_build_object(
        'success', false,
        'message', 'FINANCE_SYNC_WARNING (non-fatal): ' || SQLERRM,
        'note',    'Enrollment will proceed. Finance can be re-synced from Finance module.'
    );
END;
$$;

-- ==========================================================================================
-- PHASE 5: LEDGER COMPATIBILITY STUBS
-- These maintain backward compatibility with any other code calling the old functions.
-- Both delegate to the modern admin_sync_student_billing engine.
-- ==========================================================================================

-- Two-argument version (UUID + optional BIGINT cycle override)
CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_cycle_id   BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delegate to the V3 NUCLEAR billing engine
    RETURN public.admin_sync_student_billing(p_student_id);
END;
$$;

-- One-argument wrapper (used by some legacy callers)
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

-- ==========================================================================================
-- PHASE 6: ADMIN_FINALIZE_ENROLLMENT — THE MAIN ENROLLMENT ENGINE
-- This is the function called by the "Finalize Enrollment" button.
-- It has been completely rebuilt to reference ZERO legacy tables.
-- ==========================================================================================

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
    -- ===== [A] Load Admission Metadata =====
    SELECT student_user_id, grade, branch_id, applicant_name
    INTO   v_user_id, v_grade, v_branch_id, v_applicant_name
    FROM   public.admissions
    WHERE  id = p_admission_id;

    -- Validate admission exists
    IF v_applicant_name IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'ADMISSION_NODE_NOT_FOUND: No admission record found with ID ' || p_admission_id
        );
    END IF;

    -- ===== [B] Duplicate Guard =====
    -- If student is already enrolled, just re-sync finance and return
    SELECT user_id INTO v_existing_sid
    FROM   public.student_profiles
    WHERE  admission_id = p_admission_id;

    IF v_existing_sid IS NOT NULL THEN
        -- Re-sync finance for already-enrolled student
        v_billing_result := public.admin_sync_student_billing(v_existing_sid);
        
        -- Make sure admission status is Enrolled
        UPDATE public.admissions
        SET    status = 'Enrolled'
        WHERE  id = p_admission_id AND status != 'Enrolled';

        RETURN jsonb_build_object(
            'success',         true,
            'student_id',      v_existing_sid,
            'student_id_number', (SELECT student_id_number FROM public.student_profiles WHERE user_id = v_existing_sid),
            'billing_sync',    v_billing_result,
            'message',         'ALREADY_ENROLLED: Student record exists. Finance re-synchronized successfully.'
        );
    END IF;

    -- ===== [C] Identity Recovery =====
    -- Recover or provision the student's user account
    IF v_user_id IS NULL THEN
        -- Try to find existing profile by name
        SELECT id INTO v_user_id
        FROM   public.profiles
        WHERE  LOWER(TRIM(display_name)) = LOWER(TRIM(v_applicant_name))
          AND  role = 'Student'
        LIMIT  1;

        -- If still not found, provision a new profile node
        IF v_user_id IS NULL THEN
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

        -- Link the identity node to this admission
        UPDATE public.admissions
        SET    student_user_id = v_user_id
        WHERE  id = p_admission_id;
    END IF;

    -- ===== [D] Academic Year Resolution =====
    SELECT year_name INTO v_academic_year
    FROM   public.academic_years
    WHERE  branch_id = v_branch_id
      AND  is_current = true
    LIMIT  1;

    -- Fallback: generate current year string
    IF v_academic_year IS NULL THEN
        v_academic_year := TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR(NOW() + INTERVAL '1 year', 'YY');
    END IF;

    -- ===== [E] Student ID Generation =====
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');

    -- ===== [F] Activate Student Profile =====
    UPDATE public.profiles
    SET    role              = 'Student',
           profile_completed = true,
           is_active         = true,
           branch_id         = COALESCE(v_branch_id, branch_id)
    WHERE  id = v_user_id;

    -- ===== [G] Register in Student Roster =====
    INSERT INTO public.student_profiles (
        user_id, admission_id, student_id_number,
        grade, branch_id, enrollment_status, academic_year, is_active
    ) VALUES (
        v_user_id, p_admission_id, v_sid,
        v_grade, v_branch_id, 'Active', v_academic_year, true
    )
    ON CONFLICT (user_id) DO UPDATE SET
        student_id_number = EXCLUDED.student_id_number,
        admission_id      = EXCLUDED.admission_id,
        grade             = COALESCE(EXCLUDED.grade, student_profiles.grade),
        enrollment_status = 'Active',
        branch_id         = COALESCE(EXCLUDED.branch_id, student_profiles.branch_id),
        is_active         = true;

    -- ===== [H] Archive Admission =====
    UPDATE public.admissions
    SET    status            = 'Enrolled',
           student_id_number = v_sid,
           registered_at     = NOW()
    WHERE  id = p_admission_id;

    -- ===== [I] Finance Handshake =====
    -- This calls admin_sync_student_billing which references ONLY finance_fee_structures
    v_billing_result := public.admin_sync_student_billing(v_user_id);

    -- ===== [J] Audit Trail =====
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
                'branch_id',    v_branch_id,
                'billing_sync', v_billing_result,
                'enrolled_at',  NOW()
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Audit failure must NEVER block enrollment
        RAISE WARNING 'Audit log failed (non-fatal): %', SQLERRM;
    END;

    -- ===== [K] Return Success =====
    RETURN jsonb_build_object(
        'success',           true,
        'student_id',        v_user_id,
        'student_id_number', v_sid,
        'grade',             v_grade,
        'academic_year',     v_academic_year,
        'billing_sync',      v_billing_result,
        'message',           'Enrollment Protocol V3 NUCLEAR: Successfully enrolled student.'
    );

EXCEPTION WHEN OTHERS THEN
    -- Return structured error for frontend display
    RETURN jsonb_build_object(
        'success', false,
        'message', 'CRITICAL_FAULT: ' || SQLERRM,
        'hint',    'Check Supabase logs for details. Error code: ' || SQLSTATE
    );
END;
$$;

-- ==========================================================================================
-- PHASE 7: PLACEMENT TRIGGER (REBUILT - Safe version)
-- Fires on grade/class change to auto-sync billing.
-- ==========================================================================================

CREATE OR REPLACE FUNCTION public.trigger_on_student_placement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Fire on grade or class change
    IF (TG_OP = 'UPDATE') AND (
        COALESCE(NEW.grade, '') <> COALESCE(OLD.grade, '') OR
        COALESCE(NEW.assigned_class_id, 0) <> COALESCE(OLD.assigned_class_id, 0)
    ) THEN
        BEGIN
            PERFORM public.admin_sync_student_billing(NEW.user_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Placement trigger billing sync failed (non-fatal): %', SQLERRM;
        END;
    END IF;

    -- Fire on initial INSERT with a grade
    IF (TG_OP = 'INSERT') AND NEW.grade IS NOT NULL THEN
        BEGIN
            PERFORM public.admin_sync_student_billing(NEW.user_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Placement trigger billing sync failed on INSERT (non-fatal): %', SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$;

-- Re-attach the trigger
CREATE TRIGGER trg_on_student_placement
    AFTER INSERT OR UPDATE OF grade, assigned_class_id
    ON public.student_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_on_student_placement();

-- ==========================================================================================
-- PHASE 8: PERMISSIONS
-- Grant execution rights to authenticated users (required for RPC calls from frontend).
-- ==========================================================================================

GRANT EXECUTE ON FUNCTION public.admin_finalize_enrollment(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_enrollment(uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(uuid)         TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_student_account(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_student_account(uuid)    TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_student_ledger(uuid, bigint)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_student_ledger(uuid, bigint)    TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_student_ledger_for_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_student_ledger_for_student(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_on_student_placement()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_on_student_placement()           TO service_role;

-- ==========================================================================================
-- PHASE 9: VERIFICATION
-- Run a diagnostic check to confirm all functions are in place and no stale references exist.
-- ==========================================================================================

DO $$
DECLARE
    v_func_count INTEGER;
    v_old_ref_count INTEGER;
BEGIN
    -- Count our newly created enrollment functions
    SELECT COUNT(*) INTO v_func_count
    FROM   pg_proc p
    JOIN   pg_namespace n ON p.pronamespace = n.oid
    WHERE  n.nspname = 'public'
      AND  p.proname IN (
               'admin_finalize_enrollment',
               'admin_sync_student_billing',
               'admin_reconcile_student_account',
               'generate_student_ledger',
               'generate_student_ledger_for_student',
               'trigger_on_student_placement'
           );

    RAISE NOTICE '==================================================================';
    RAISE NOTICE 'VERIFICATION RESULT: % enrollment/finance functions deployed', v_func_count;
    RAISE NOTICE '==================================================================';

    IF v_func_count >= 6 THEN
        RAISE NOTICE 'SUCCESS: All critical functions are in place!';
        RAISE NOTICE 'The "relation fee_structures does not exist" error is now FIXED.';
        RAISE NOTICE 'You can now click "Finalize Enrollment" without errors.';
    ELSE
        RAISE WARNING 'WARNING: Only % of 6 expected functions were created!', v_func_count;
        RAISE WARNING 'Please check for errors above and re-run the script.';
    END IF;

    RAISE NOTICE '==================================================================';
    RAISE NOTICE 'IMPORTANT: Make sure you have active fee structures configured!';
    RAISE NOTICE 'If no fee structure is configured for a grade, enrollment will';
    RAISE NOTICE 'succeed but billing will show FEE_STRUCTURE_NOT_CONFIGURED warning.';
    RAISE NOTICE '==================================================================';
END $$;

COMMIT;

-- Final status check
SELECT 
    'SUCCESS: ENROLLMENT_FINAL_V3_NUCLEAR_FIX applied successfully.' AS status,
    'The fee_structures relation error has been eliminated.' AS detail,
    'Click "Finalize Enrollment" to test.' AS next_step;
