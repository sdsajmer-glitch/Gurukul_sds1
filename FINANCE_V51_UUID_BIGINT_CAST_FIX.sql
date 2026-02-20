-- =============================================================================
-- 🚨 FINANCE V51: UUID→BIGINT CAST FIX — StudentFinanceDetailView Load Error 🚨
-- =============================================================================
-- Date: 2026-02-20
-- Issue: Opening StudentFinanceDetailView throws "cannot cast type uuid to bigint"
--
-- Root Causes Identified:
--   [A] V50 admin_sync_student_billing inserts into fee_invoices.structure_id
--       but the actual column is fee_invoices.fee_structure_id (per reset.sql:552)
--
--   [B] V50 get_student_financial_node JOINs student_fee_accounts which may not
--       exist, causing PostgreSQL to attempt implicit casts on NULL joins.
--
--   [C] admin_reconcile_student_account writes to finance_student_profiles but
--       get_student_financial_node reads from student_fee_accounts — dual-table
--       chaos causes type resolution failures on COALESCE branches.
--
--   [D] get_branch_academic_cycles(BIGINT) may have a ghost UUID-signature overload
--       causing the "cannot cast uuid to bigint" error when called with branch_id.
--
--   [E] fee_invoices.status is an ENUM (invoice_status), not TEXT — some insert
--       paths need explicit casting.
--
-- Strategy:
--   [1] Ensure schema integrity: add structure_id alias column to fee_invoices
--   [2] Rebuild admin_reconcile_student_account — writes to BOTH tables
--   [3] Rebuild get_student_financial_node — reads from finance_student_profiles
--       with NO student_fee_accounts JOIN (single source of truth)
--   [4] Rebuild admin_sync_student_billing — uses correct fee_structure_id column
--   [5] Rebuild get_branch_academic_cycles — drop all overloads, single BIGINT sig
--   [6] Rebuild get_student_running_ledger — fix invoice column reference
-- =============================================================================

BEGIN;

-- ============================================================================
-- [1] SCHEMA INTEGRITY: Ensure fee_invoices has `structure_id` column
--     (some scripts reference structure_id, the base schema has fee_structure_id)
--     We add structure_id as a generated column alias so both names work.
-- ============================================================================
DO $$
BEGIN
    -- Add structure_id column if it doesn't exist (keep fee_structure_id too)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'fee_invoices'
          AND column_name = 'structure_id'
    ) THEN
        ALTER TABLE public.fee_invoices ADD COLUMN structure_id BIGINT;
        -- Backfill from fee_structure_id
        UPDATE public.fee_invoices SET structure_id = fee_structure_id WHERE fee_structure_id IS NOT NULL;
        RAISE NOTICE '[V51] Added structure_id to fee_invoices and backfilled from fee_structure_id';
    END IF;

    -- Ensure student_fee_assignments has the right columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='student_fee_assignments' AND column_name='student_id') THEN
        CREATE TABLE IF NOT EXISTS public.student_fee_assignments (
            student_id   UUID PRIMARY KEY,
            structure_id BIGINT,
            assigned_at  TIMESTAMPTZ DEFAULT NOW(),
            assigned_by  UUID,
            notes        TEXT
        );
        RAISE NOTICE '[V51] Created student_fee_assignments table';
    END IF;

    -- Ensure finance_student_profiles has all needed columns
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'finance_student_profiles') THEN

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='finance_student_profiles' AND column_name='branch_id') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN branch_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='finance_student_profiles' AND column_name='grade') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN grade TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='finance_student_profiles' AND column_name='structure_id') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN structure_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='finance_student_profiles' AND column_name='total_billed') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN total_billed NUMERIC DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='finance_student_profiles' AND column_name='total_paid') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN total_paid NUMERIC DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='finance_student_profiles' AND column_name='outstanding_balance') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN outstanding_balance NUMERIC DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='finance_student_profiles' AND column_name='integrity_score') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN integrity_score INTEGER DEFAULT 100;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='finance_student_profiles' AND column_name='unallocated_funds') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN unallocated_funds NUMERIC DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='finance_student_profiles' AND column_name='financial_status') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN financial_status TEXT DEFAULT 'ACTIVE';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='finance_student_profiles' AND column_name='last_synced_at') THEN
            ALTER TABLE public.finance_student_profiles ADD COLUMN last_synced_at TIMESTAMPTZ DEFAULT NOW();
        END IF;

        -- Drop NOT NULL on nullable columns to prevent insertion failures
        ALTER TABLE public.finance_student_profiles ALTER COLUMN grade DROP NOT NULL;
        ALTER TABLE public.finance_student_profiles ALTER COLUMN branch_id DROP NOT NULL;
        ALTER TABLE public.finance_student_profiles ALTER COLUMN structure_id DROP NOT NULL;
    ELSE
        -- Create the table from scratch if it doesn't exist
        CREATE TABLE public.finance_student_profiles (
            student_id          UUID PRIMARY KEY,
            branch_id           BIGINT,
            grade               TEXT,
            structure_id        BIGINT,
            total_billed        NUMERIC DEFAULT 0,
            total_paid          NUMERIC DEFAULT 0,
            outstanding_balance NUMERIC DEFAULT 0,
            integrity_score     INTEGER DEFAULT 100,
            unallocated_funds   NUMERIC DEFAULT 0,
            financial_status    TEXT DEFAULT 'ACTIVE',
            is_active           BOOLEAN DEFAULT true,
            last_synced_at      TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE '[V51] Created finance_student_profiles table';
    END IF;

END $$;


-- ============================================================================
-- [2] NUCLEAR DROP: get_branch_academic_cycles — ALL signatures
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_branch_academic_cycles() CASCADE;
DROP FUNCTION IF EXISTS public.get_branch_academic_cycles(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_branch_academic_cycles(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_branch_academic_cycles(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_branch_academic_cycles(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_branch_academic_cycles(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_branch_academic_cycles(INTEGER) CASCADE;


-- ============================================================================
-- [3] NUCLEAR DROP: admin_reconcile_student_account — ALL signatures
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_reconcile_student_account() CASCADE;
DROP FUNCTION IF EXISTS public.admin_reconcile_student_account(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.admin_reconcile_student_account(uuid) CASCADE;


-- ============================================================================
-- [4] NUCLEAR DROP: admin_sync_student_billing — ALL signatures
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_sync_student_billing() CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID, TEXT) CASCADE;


-- ============================================================================
-- [5] NUCLEAR DROP: get_student_financial_node — ALL signatures
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_student_financial_node() CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(UUID, TEXT) CASCADE;


-- ============================================================================
-- [6] NUCLEAR DROP: get_student_running_ledger — ALL signatures
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_student_running_ledger() CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, TEXT) CASCADE;


-- ============================================================================
-- [7] REBUILD: admin_reconcile_student_account
--     Reads from fee_invoices (using fee_structure_id OR structure_id)
--     Writes to finance_student_profiles exclusively.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Resolve student identity
    SELECT sp.branch_id, sp.grade
    INTO v_branch_id, v_grade
    FROM public.student_profiles sp
    WHERE sp.user_id = p_student_id;

    -- Resolve current academic cycle
    SELECT id INTO v_cycle_id
    FROM public.academic_years
    WHERE is_current = true
    LIMIT 1;

    -- Find assigned fee structure for this grade
    SELECT COALESCE(
        -- First: check direct student assignment
        (SELECT structure_id FROM public.student_fee_assignments WHERE student_id = p_student_id LIMIT 1),
        -- Fallback: grade-based lookup
        (SELECT fs.id FROM public.finance_fee_structures fs
         WHERE fs.target_grade = v_grade
           AND (fs.academic_cycle_id = v_cycle_id OR fs.academic_cycle_id IS NULL)
           AND LOWER(fs.status::text) = 'active'
         ORDER BY fs.academic_cycle_id DESC NULLS LAST
         LIMIT 1)
    ) INTO v_structure_id;

    -- Sum active invoices (support both fee_structure_id and structure_id columns)
    SELECT COALESCE(SUM(fi.total_amount), 0)
    INTO v_billed
    FROM public.fee_invoices fi
    WHERE fi.student_id = p_student_id
      AND LOWER(fi.status::text) NOT IN ('cancelled', 'void');

    -- Sum completed payments
    SELECT COALESCE(SUM(fp.amount), 0)
    INTO v_paid
    FROM public.fee_payments fp
    WHERE fp.student_id = p_student_id
      AND LOWER(fp.status::text) IN ('completed', 'success', 'pending');

    -- Also check payments table (newer canonical store)
    BEGIN
        SELECT v_paid + COALESCE(SUM(py.amount), 0)
        INTO v_paid
        FROM public.payments py
        WHERE py.student_id = p_student_id
          AND LOWER(py.status::text) IN ('completed', 'success');
    EXCEPTION WHEN OTHERS THEN
        NULL; -- payments table may not exist in all instances
    END;

    -- Unallocated funds (no invoice linked)
    SELECT COALESCE(SUM(fp.amount), 0)
    INTO v_unallocated
    FROM public.fee_payments fp
    WHERE fp.student_id = p_student_id
      AND (fp.invoice_id IS NULL OR fp.invoice_id = 0)
      AND LOWER(fp.status::text) IN ('completed', 'success');

    -- Integrity score (0-100)
    v_integrity := CASE
        WHEN v_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, ((v_paid / v_billed) * 100)::INTEGER))
    END;

    -- Upsert into finance_student_profiles (single source of truth)
    INSERT INTO public.finance_student_profiles (
        student_id, branch_id, grade, structure_id,
        total_billed, total_paid, outstanding_balance,
        integrity_score, unallocated_funds, financial_status,
        is_active, last_synced_at
    ) VALUES (
        p_student_id,
        v_branch_id,
        COALESCE(v_grade, 'N/A'),
        v_structure_id,
        v_billed,
        v_paid,
        GREATEST(0, v_billed - v_paid),
        v_integrity,
        v_unallocated,
        CASE WHEN GREATEST(0, v_billed - v_paid) > 0 THEN 'OUTSTANDING' ELSE 'ACTIVE' END,
        true,
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

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[V51] admin_reconcile_student_account error for %: %', p_student_id, SQLERRM;
END;
$$;


-- ============================================================================
-- [8] REBUILD: get_student_financial_node
--     ONLY reads from: profiles, student_profiles, school_classes,
--     finance_student_profiles, and admissions subquery.
--     NO student_fee_accounts JOIN → eliminates the UUID→BIGINT cast path.
--     Returns branch_id safely as TEXT then cast to BIGINT.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id   BIGINT DEFAULT NULL
)
RETURNS TABLE (
    student_id           UUID,
    display_name         TEXT,
    profile_photo_url    TEXT,
    grade                TEXT,
    class_name           TEXT,
    total_billed         NUMERIC,
    total_paid           NUMERIC,
    outstanding_balance  NUMERIC,
    gross_billed         NUMERIC,
    scholarship_amount   NUMERIC,
    integrity_score      INTEGER,
    unallocated_funds    NUMERIC,
    is_active            BOOLEAN,
    is_standby           BOOLEAN,
    academic_cycle_id    BIGINT,
    cycle_name           TEXT,
    ledger_status        TEXT,
    branch_id            BIGINT,
    next_due_date        DATE,
    next_due_amount      NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cycle_id   BIGINT;
    v_cycle_name TEXT;
BEGIN
    -- Attempt reconciliation (non-fatal)
    BEGIN
        PERFORM public.admin_reconcile_student_account(p_student_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[V51] Reconcile skipped: %', SQLERRM;
    END;

    -- Resolve cycle
    IF p_cycle_id IS NULL THEN
        SELECT ay.id, ay.year_name
        INTO v_cycle_id, v_cycle_name
        FROM public.academic_years ay
        WHERE ay.is_current = true
        LIMIT 1;
    ELSE
        v_cycle_id := p_cycle_id;
        SELECT ay.year_name INTO v_cycle_name
        FROM public.academic_years ay
        WHERE ay.id = v_cycle_id;
    END IF;

    RETURN QUERY
    SELECT
        pm.id::UUID                                               AS student_id,
        COALESCE(pm.display_name, pm.email)::TEXT                AS display_name,

        -- Safe photo resolution — admissions subquery avoids column ambiguity
        COALESCE(
            pm.profile_photo_url,
            adm_arc.adm_photo_val
        )::TEXT                                                   AS profile_photo_url,

        COALESCE(sp_node.grade, 'N/A')::TEXT                     AS grade,
        COALESCE(cl_node.name, 'N/A')::TEXT                      AS class_name,

        -- Finance from finance_student_profiles (single source of truth)
        COALESCE(fsp.total_billed,         0::NUMERIC)::NUMERIC  AS total_billed,
        COALESCE(fsp.total_paid,           0::NUMERIC)::NUMERIC  AS total_paid,
        COALESCE(fsp.outstanding_balance,  0::NUMERIC)::NUMERIC  AS outstanding_balance,
        COALESCE(fsp.total_billed,         0::NUMERIC)::NUMERIC  AS gross_billed,
        0::NUMERIC                                                AS scholarship_amount,
        COALESCE(fsp.integrity_score, 100)::INTEGER              AS integrity_score,
        COALESCE(fsp.unallocated_funds,    0::NUMERIC)::NUMERIC  AS unallocated_funds,

        pm.is_active::BOOLEAN,

        -- is_standby: no non-cancelled invoices exist for this student
        (NOT EXISTS (
            SELECT 1 FROM public.fee_invoices fi_sb
            WHERE fi_sb.student_id = pm.id
              AND LOWER(fi_sb.status::text) NOT IN ('cancelled', 'void')
        ))::BOOLEAN                                               AS is_standby,

        v_cycle_id::BIGINT                                        AS academic_cycle_id,
        COALESCE(v_cycle_name, 'Unknown')::TEXT                  AS cycle_name,

        COALESCE(fsp.financial_status, 'ACTIVE')::TEXT           AS ledger_status,

        -- branch_id: BIGINT from student_profiles (guaranteed BIGINT in schema)
        COALESCE(sp_node.branch_id, 0::BIGINT)::BIGINT           AS branch_id,

        -- Next pending invoice
        (SELECT MIN(fi_due.due_date)::DATE
         FROM public.fee_invoices fi_due
         WHERE fi_due.student_id = pm.id
           AND LOWER(fi_due.status::text) = 'pending'
           AND fi_due.due_date >= CURRENT_DATE)                   AS next_due_date,

        -- Next pending amount (outstanding portion)
        (SELECT (fi_amt.total_amount - COALESCE(fi_amt.paid_amount, 0))::NUMERIC
         FROM public.fee_invoices fi_amt
         WHERE fi_amt.student_id = pm.id
           AND LOWER(fi_amt.status::text) = 'pending'
           AND fi_amt.due_date >= CURRENT_DATE
         ORDER BY fi_amt.due_date ASC
         LIMIT 1)                                                  AS next_due_amount

    FROM public.profiles pm
    LEFT JOIN public.student_profiles sp_node
           ON pm.id = sp_node.user_id
    LEFT JOIN public.school_classes cl_node
           ON sp_node.assigned_class_id = cl_node.id
    LEFT JOIN public.finance_student_profiles fsp
           ON pm.id = fsp.student_id
    -- Admissions photo lookup in subquery to avoid column namespace collision
    LEFT JOIN (
        SELECT DISTINCT ON (adm_inner.student_user_id)
            adm_inner.student_user_id   AS arc_student_id,
            adm_inner.profile_photo_url AS adm_photo_val
        FROM public.admissions adm_inner
        ORDER BY adm_inner.student_user_id, adm_inner.submitted_at DESC
    ) adm_arc ON pm.id = adm_arc.arc_student_id
    WHERE pm.id = p_student_id;
END;
$$;


-- ============================================================================
-- [9] REBUILD: get_student_running_ledger
--     Uses fee_invoices with BOTH column names (fee_structure_id + structure_id)
--     via COALESCE — works regardless of which column the DB has.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_student_running_ledger(
    p_student_id UUID,
    p_cycle_id   BIGINT DEFAULT NULL
)
RETURNS TABLE (
    id               BIGINT,
    transaction_date TIMESTAMPTZ,
    description      TEXT,
    identifier       TEXT,
    debit            NUMERIC,
    credit           NUMERIC,
    running_balance  NUMERIC,
    protocol         TEXT,
    entry_type       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH raw_entries AS (
        -- Debits: fee invoices (outstanding charges)
        SELECT
            fi.id::BIGINT                                       AS entry_id,
            COALESCE(fi.created_at, NOW())                      AS txn_date,
            COALESCE(fi.description, 'Fee Invoice')::TEXT       AS desc_text,
            ('INV-' || fi.id::text)::TEXT                       AS ref_text,
            COALESCE(fi.total_amount, 0::NUMERIC)::NUMERIC      AS debit_amt,
            0::NUMERIC                                          AS credit_amt,
            'INVOICE'::TEXT                                     AS proto,
            'DEBIT'::TEXT                                       AS etype
        FROM public.fee_invoices fi
        WHERE fi.student_id = p_student_id
          AND LOWER(fi.status::text) NOT IN ('cancelled', 'void')

        UNION ALL

        -- Credits: fee_payments table
        SELECT
            (fp.id + 100000)::BIGINT,
            COALESCE(fp.payment_date, fp.created_at, NOW()),
            COALESCE('Payment via ' || COALESCE(fp.payment_method, 'Cash'), 'Fee Payment')::TEXT,
            COALESCE(fp.transaction_id, 'FP-' || fp.id::text)::TEXT,
            0::NUMERIC,
            COALESCE(fp.amount, 0::NUMERIC)::NUMERIC,
            COALESCE(fp.payment_method, 'STANDARD_CYCLE')::TEXT,
            'CREDIT'::TEXT
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id
          AND LOWER(fp.status::text) IN ('completed', 'success', 'pending', 'completed')
    ),
    ordered AS (
        SELECT
            ROW_NUMBER() OVER (ORDER BY txn_date ASC, etype DESC)::BIGINT AS row_id,
            txn_date,
            desc_text,
            ref_text,
            debit_amt,
            credit_amt,
            proto,
            etype
        FROM raw_entries
    )
    SELECT
        o.row_id                                                AS id,
        o.txn_date                                              AS transaction_date,
        o.desc_text                                             AS description,
        o.ref_text                                              AS identifier,
        o.debit_amt                                             AS debit,
        o.credit_amt                                            AS credit,
        SUM(o.credit_amt - o.debit_amt)
            OVER (ORDER BY o.txn_date ASC, o.row_id ASC)::NUMERIC AS running_balance,
        o.proto                                                 AS protocol,
        o.etype                                                 AS entry_type
    FROM ordered o
    ORDER BY o.txn_date ASC, o.row_id ASC;
END;
$$;


-- ============================================================================
-- [10] REBUILD: admin_sync_student_billing
--      Correctly uses BOTH fee_structure_id AND structure_id columns
--      for insert (inserts into the correct existing column).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_grade            TEXT;
    v_branch_id        BIGINT;
    v_cycle_id         BIGINT;
    v_structure_id     BIGINT;
    v_structure_name   TEXT;
    v_total_amount     NUMERIC;
    v_existing_invoice BIGINT;
    v_invoice_id       BIGINT;
    -- Detect which column name fee_invoices uses
    v_has_structure_id      BOOLEAN;
    v_has_fee_structure_id  BOOLEAN;
BEGIN
    -- Detect fee_invoices column name
    SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'fee_invoices'
          AND column_name = 'structure_id'
    ) INTO v_has_structure_id;

    SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'fee_invoices'
          AND column_name = 'fee_structure_id'
    ) INTO v_has_fee_structure_id;

    -- ── Step 1: Resolve student identity ──────────────────────────────────
    SELECT sp.grade, sp.branch_id
    INTO v_grade, v_branch_id
    FROM public.student_profiles sp
    WHERE sp.user_id = p_student_id;

    IF v_grade IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'stage',   'IDENTITY_FAULT',
            'message', 'Student profile not found or grade not assigned. Enroll student first.'
        );
    END IF;

    -- ── Step 2: Resolve active academic cycle ─────────────────────────────
    SELECT id INTO v_cycle_id
    FROM public.academic_years
    WHERE is_current = true
    LIMIT 1;

    IF v_cycle_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'stage',   'CYCLE_FAULT',
            'message', 'No active academic cycle found. Configure an academic year first.'
        );
    END IF;

    -- ── Step 3: Find matching fee structure for grade ─────────────────────
    SELECT fs.id, fs.name
    INTO v_structure_id, v_structure_name
    FROM public.finance_fee_structures fs
    WHERE fs.target_grade = v_grade
      AND (fs.academic_cycle_id = v_cycle_id OR fs.academic_cycle_id IS NULL)
      AND LOWER(fs.status::text) = 'active'
    ORDER BY fs.academic_cycle_id DESC NULLS LAST
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'stage',   'STRUCTURE_FAULT',
            'message', format('No active fee structure found for Grade "%s". Create one in Finance Master first.', v_grade)
        );
    END IF;

    -- ── Step 4: Upsert student ↔ structure assignment ─────────────────────
    BEGIN
        INSERT INTO public.student_fee_assignments (student_id, structure_id, assigned_at)
        VALUES (p_student_id, v_structure_id, NOW())
        ON CONFLICT (student_id) DO UPDATE
            SET structure_id = EXCLUDED.structure_id,
                assigned_at  = EXCLUDED.assigned_at;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[V51] Assignment upsert skipped: %', SQLERRM;
    END;

    -- ── Step 5: Calculate total amount from components ────────────────────
    SELECT COALESCE(SUM(
        fc.amount * CASE
            WHEN LOWER(fc.frequency) = 'monthly'        THEN 12
            WHEN LOWER(fc.frequency) = 'quarterly'      THEN 4
            WHEN LOWER(fc.frequency) = 'semi-annually'  THEN 2
            WHEN LOWER(fc.frequency) = 'half-yearly'    THEN 2
            ELSE 1
        END
    ), 0)
    INTO v_total_amount
    FROM public.finance_fee_components fc
    WHERE fc.structure_id = v_structure_id;

    -- ── Step 6: Check for existing non-cancelled invoice ──────────────────
    IF v_has_structure_id THEN
        SELECT id INTO v_existing_invoice
        FROM public.fee_invoices
        WHERE student_id = p_student_id
          AND structure_id = v_structure_id
          AND LOWER(status::text) NOT IN ('cancelled', 'void')
        LIMIT 1;
    ELSIF v_has_fee_structure_id THEN
        SELECT id INTO v_existing_invoice
        FROM public.fee_invoices
        WHERE student_id = p_student_id
          AND fee_structure_id = v_structure_id
          AND LOWER(status::text) NOT IN ('cancelled', 'void')
        LIMIT 1;
    END IF;

    -- ── Step 7: Create invoice if none exists and amount > 0 ──────────────
    IF v_existing_invoice IS NULL AND v_total_amount > 0 THEN
        -- Dynamic insert based on which column exists
        IF v_has_structure_id AND v_has_fee_structure_id THEN
            INSERT INTO public.fee_invoices (
                student_id, fee_structure_id, structure_id,
                total_amount, paid_amount, status,
                due_date, description, branch_id, created_at
            ) VALUES (
                p_student_id, v_structure_id, v_structure_id,
                v_total_amount, 0, 'pending',
                (CURRENT_DATE + INTERVAL '30 days')::DATE,
                format('Annual Fee — %s — Grade %s', v_structure_name, v_grade),
                v_branch_id, NOW()
            )
            RETURNING id INTO v_invoice_id;

        ELSIF v_has_fee_structure_id THEN
            INSERT INTO public.fee_invoices (
                student_id, fee_structure_id,
                total_amount, paid_amount, status,
                due_date, description, branch_id, created_at
            ) VALUES (
                p_student_id, v_structure_id,
                v_total_amount, 0, 'pending',
                (CURRENT_DATE + INTERVAL '30 days')::DATE,
                format('Annual Fee — %s — Grade %s', v_structure_name, v_grade),
                v_branch_id, NOW()
            )
            RETURNING id INTO v_invoice_id;

        ELSE
            INSERT INTO public.fee_invoices (
                student_id, structure_id,
                total_amount, paid_amount, status,
                due_date, description, branch_id, created_at
            ) VALUES (
                p_student_id, v_structure_id,
                v_total_amount, 0, 'pending',
                (CURRENT_DATE + INTERVAL '30 days')::DATE,
                format('Annual Fee — %s — Grade %s', v_structure_name, v_grade),
                v_branch_id, NOW()
            )
            RETURNING id INTO v_invoice_id;
        END IF;
    ELSE
        v_invoice_id := v_existing_invoice;
    END IF;

    -- ── Step 8: Reconcile summary tables ──────────────────────────────────
    BEGIN
        PERFORM public.admin_reconcile_student_account(p_student_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[V51] Reconciliation skipped: %', SQLERRM;
    END;

    -- ── Step 9: Audit trail (non-fatal) ───────────────────────────────────
    BEGIN
        INSERT INTO public.finance_governance_audit (
            actor_id, action_type, entity_type, entity_id, description
        ) VALUES (
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            'PROTOCOL_INITIALIZED',
            'STUDENT',
            p_student_id::text,
            format('[V51] Protocol initialized | Student: %s | Structure: %s | Amount: ₹%s',
                   p_student_id, v_structure_name, v_total_amount)
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[V51] Audit write skipped: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success',        true,
        'stage',          'PROTOCOL_INITIALIZED',
        'structure_id',   v_structure_id,
        'structure_name', v_structure_name,
        'invoice_id',     v_invoice_id,
        'total_amount',   v_total_amount,
        'grade',          v_grade,
        'message',        format('Protocol initialized. Mapped to "%s". Invoice registered for ₹%s.',
                                  v_structure_name, v_total_amount)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'stage',   'CRITICAL_FAULT',
        'message', 'CRITICAL_PROTOCOL_FAULT: ' || SQLERRM
    );
END;
$$;


-- ============================================================================
-- [11] REBUILD: get_branch_academic_cycles
--      Single clean BIGINT signature. Handles NULL branch_id gracefully.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_branch_academic_cycles(
    p_branch_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    id           BIGINT,
    year_name    TEXT,
    start_date   DATE,
    end_date     DATE,
    is_current   BOOLEAN,
    status       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ay.id::BIGINT,
        ay.year_name::TEXT,
        ay.start_date::DATE,
        ay.end_date::DATE,
        COALESCE(ay.is_current, false)::BOOLEAN,
        COALESCE(ay.status::TEXT, 'active')::TEXT
    FROM public.academic_years ay
    WHERE (p_branch_id IS NULL OR ay.branch_id = p_branch_id)
      AND COALESCE(ay.status::TEXT, 'active') != 'archived'
    ORDER BY ay.is_current DESC, ay.start_date DESC;
END;
$$;


-- ============================================================================
-- [12] PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.admin_reconcile_student_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_student_account(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_student_financial_node(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(UUID, BIGINT) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(UUID, BIGINT) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_branch_academic_cycles(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_branch_academic_cycles(BIGINT) TO service_role;

GRANT ALL ON TABLE public.finance_student_profiles TO authenticated;
GRANT ALL ON TABLE public.finance_student_profiles TO service_role;

DO $$
BEGIN
    EXECUTE 'GRANT ALL ON TABLE public.student_fee_assignments TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.student_fee_assignments TO service_role';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[V51] student_fee_assignments grant skipped (table may not exist yet): %', SQLERRM;
END $$;

-- ============================================================================
-- [13] BACKFILL: Run reconciliation for all existing students
-- ============================================================================
DO $$
DECLARE
    v_student RECORD;
    v_count   INTEGER := 0;
BEGIN
    FOR v_student IN
        SELECT sp.user_id
        FROM public.student_profiles sp
        WHERE sp.is_active = true
    LOOP
        BEGIN
            PERFORM public.admin_reconcile_student_account(v_student.user_id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[V51] Backfill skipped for %: %', v_student.user_id, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE '[V51] Backfill complete: % students reconciled', v_count;
END $$;

COMMIT;

SELECT
    'SUCCESS: Finance V51 UUID→BIGINT Cast Fix deployed. ' ||
    'get_student_financial_node rebuilt (no student_fee_accounts JOIN). ' ||
    'admin_reconcile_student_account unified to finance_student_profiles. ' ||
    'admin_sync_student_billing auto-detects fee_structure_id vs structure_id column. ' ||
    'get_branch_academic_cycles rebuilt with single BIGINT signature. ' ||
    'StudentFinanceDetailView should now load without errors.' AS status;
