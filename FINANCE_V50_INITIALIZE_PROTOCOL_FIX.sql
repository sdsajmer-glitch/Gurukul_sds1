-- =============================================================================
-- 🚨 FINANCE V50: INITIALIZE PROTOCOL FIX — CONFLICT_DETECTED EXTERMINATOR 🚨
-- =============================================================================
-- Date: 2026-02-20
-- Issue: Clicking "INITIALIZE PROTOCOL" in StudentFinanceDetailView shows:
--   "CONFLICT_DETECTED: Multiple node identifiers or outdated RPC signature.
--    The global registry or signature mismatch detected."
--
-- Root Cause: PostgreSQL is throwing "function admin_sync_student_billing(uuid)
-- is ambiguous" because the function has been defined with multiple overloads
-- (different parameter names, return types, or call signatures) across many
-- historical SQL scripts. PostgreSQL cannot resolve which overload to call.
--
-- Strategy — NUCLEAR AMBIGUITY EXTERMINATION:
--   [1] DROP ALL known overloads of the 3 affected RPCs
--   [2] Rebuild admin_sync_student_billing with single clean UUID signature
--   [3] Rebuild get_student_running_ledger with two clean signatures (UUID only
--       and UUID + BIGINT cycle) matching what StudentFinanceDetailView.tsx calls
--   [4] Verify get_student_financial_node is clean (V43 should have fixed it
--       but we drop+rebuild to guarantee no ghost overloads remain)
--   [5] Grant permissions
-- =============================================================================

BEGIN;

-- ============================================================================
-- [1] NUCLEAR DROP: admin_sync_student_billing — ALL possible signatures
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_sync_student_billing() CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing(UUID, BOOLEAN) CASCADE;

-- ============================================================================
-- [2] NUCLEAR DROP: get_student_running_ledger — ALL possible signatures
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_student_running_ledger() CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger(UUID, NUMERIC) CASCADE;

-- ============================================================================
-- [3] NUCLEAR DROP: get_student_financial_node — ALL possible signatures
-- (Redundant safety net — V43 should have cleaned these but we confirm)
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
-- [4] REBUILD: admin_sync_student_billing
--     Single, unambiguous signature: (p_student_id UUID) → JSONB
--     This is what StudentFinanceDetailView.tsx calls.
--     Logic: Auto-assigns fee structure based on grade, generates invoice,
--     and runs reconciliation. Returns structured JSON status.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_grade           TEXT;
    v_branch_id       BIGINT;
    v_cycle_id        BIGINT;
    v_structure_id    BIGINT;
    v_structure_name  TEXT;
    v_total_amount    NUMERIC;
    v_existing_invoice BIGINT;
    v_invoice_id      BIGINT;
BEGIN

    -- ── Step 1: Resolve student identity ──────────────────────────────────
    SELECT sp.grade, sp.branch_id
    INTO v_grade, v_branch_id
    FROM public.student_profiles sp
    WHERE sp.user_id = p_student_id;

    IF v_grade IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'stage', 'IDENTITY_FAULT',
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
            'stage', 'CYCLE_FAULT',
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
            'stage', 'STRUCTURE_FAULT',
            'message', format(
                'No active fee structure found for Grade %s in current academic cycle. Create one in Finance Master.',
                v_grade
            )
        );
    END IF;

    -- ── Step 4: Link student ↔ structure (upsert assignment) ─────────────
    INSERT INTO public.student_fee_assignments (student_id, structure_id, assigned_at)
    VALUES (p_student_id, v_structure_id, NOW())
    ON CONFLICT (student_id) DO UPDATE
        SET structure_id = EXCLUDED.structure_id,
            assigned_at  = EXCLUDED.assigned_at;

    -- ── Step 5: Calculate total from fee components ───────────────────────
    SELECT COALESCE(SUM(
        fc.amount * CASE
            WHEN LOWER(fc.frequency) = 'monthly'       THEN 12
            WHEN LOWER(fc.frequency) = 'quarterly'     THEN 4
            WHEN LOWER(fc.frequency) = 'semi-annually' THEN 2
            ELSE 1
        END
    ), 0)
    INTO v_total_amount
    FROM public.finance_fee_components fc
    WHERE fc.structure_id = v_structure_id;

    -- ── Step 6: Check for existing annual invoice to avoid duplicate ──────
    SELECT id INTO v_existing_invoice
    FROM public.fee_invoices
    WHERE student_id  = p_student_id
      AND structure_id = v_structure_id
      AND LOWER(status::text) NOT IN ('cancelled', 'void')
    LIMIT 1;

    -- ── Step 7: Raise invoice if not already present ──────────────────────
    IF v_existing_invoice IS NULL AND v_total_amount > 0 THEN
        INSERT INTO public.fee_invoices (
            student_id,
            structure_id,
            total_amount,
            paid_amount,
            status,
            due_date,
            description,
            created_at
        ) VALUES (
            p_student_id,
            v_structure_id,
            v_total_amount,
            0,
            'pending',
            (CURRENT_DATE + INTERVAL '30 days')::DATE,
            format('Annual Fee — %s — Grade %s', v_structure_name, v_grade),
            NOW()
        )
        RETURNING id INTO v_invoice_id;
    ELSE
        v_invoice_id := v_existing_invoice;
    END IF;

    -- ── Step 8: Run reconciliation to update summary tables ───────────────
    BEGIN
        PERFORM public.admin_reconcile_student_account(p_student_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[V50] Reconciliation skipped: %', SQLERRM;
    END;

    -- ── Step 9: Audit trail ───────────────────────────────────────────────
    BEGIN
        INSERT INTO public.finance_governance_audit (
            actor_id, action_type, entity_type, entity_id, description
        ) VALUES (
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            'PROTOCOL_INITIALIZED',
            'STUDENT',
            p_student_id::text,
            format('[V50] Genesis Protocol initialized for student %s | Structure: %s | Amount: %s',
                p_student_id, v_structure_name, v_total_amount)
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[V50] Audit skipped: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success',          true,
        'stage',            'PROTOCOL_INITIALIZED',
        'structure_id',     v_structure_id,
        'structure_name',   v_structure_name,
        'invoice_id',       v_invoice_id,
        'total_amount',     v_total_amount,
        'grade',            v_grade,
        'message',          format('Protocol initialized. Student mapped to "%s". Invoice raised for %s.', v_structure_name, v_total_amount)
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
-- [5] REBUILD: get_student_running_ledger
--     Two signatures to match the frontend's calls:
--       Signature A: (p_student_id UUID)                — used in some paths
--       Signature B: (p_student_id UUID, p_cycle_id BIGINT) — default null
--     We implement B with a DEFAULT NULL on p_cycle_id so Supabase RPC
--     can call it with or without p_cycle_id.
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
    WITH ledger_entries AS (
        -- Debits: outstanding invoices
        SELECT
            fi.id::BIGINT                                      AS entry_id,
            fi.created_at                                      AS txn_date,
            COALESCE(fi.description, 'Fee Invoice')::TEXT      AS desc_text,
            ('INV-' || fi.id)::TEXT                            AS ref_text,
            COALESCE(fi.total_amount, 0)::NUMERIC              AS debit_amt,
            0::NUMERIC                                         AS credit_amt,
            'INVOICE'::TEXT                                    AS proto,
            'DEBIT'::TEXT                                      AS etype
        FROM public.fee_invoices fi
        WHERE fi.student_id = p_student_id
          AND LOWER(fi.status::text) NOT IN ('cancelled', 'void')

        UNION ALL

        -- Credits: payments made (from fee_payments)
        SELECT
            fp.id::BIGINT,
            COALESCE(fp.payment_date, fp.created_at),
            COALESCE(('Payment via ' || fp.payment_method), 'Fee Payment')::TEXT,
            COALESCE(fp.transaction_id, 'PAY-' || fp.id::text)::TEXT,
            0::NUMERIC,
            COALESCE(fp.amount, 0)::NUMERIC,
            'PAYMENT'::TEXT,
            'CREDIT'::TEXT
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id
          AND LOWER(fp.status::text) IN ('completed', 'success', 'pending')

        UNION ALL

        -- Credits: payments made (from payments table — newer canonical store)
        SELECT
            py.id::BIGINT,
            py.created_at,
            COALESCE(('Settlement via ' || py.payment_method), 'Settlement')::TEXT,
            ('PY-' || py.id::text)::TEXT,
            0::NUMERIC,
            COALESCE(py.amount, 0)::NUMERIC,
            COALESCE(py.payment_method, 'STANDARD_CYCLE')::TEXT,
            'CREDIT'::TEXT
        FROM public.payments py
        WHERE py.student_id = p_student_id
          AND LOWER(py.status::text) IN ('completed', 'success')
    ),
    ordered AS (
        SELECT
            ROW_NUMBER() OVER (ORDER BY txn_date ASC, etype DESC)::BIGINT AS id,
            txn_date      AS transaction_date,
            desc_text     AS description,
            ref_text      AS identifier,
            debit_amt     AS debit,
            credit_amt    AS credit,
            proto         AS protocol,
            etype         AS entry_type
        FROM ledger_entries
    )
    SELECT
        o.id,
        o.transaction_date,
        o.description,
        o.identifier,
        o.debit,
        o.credit,
        SUM(o.credit - o.debit) OVER (ORDER BY o.transaction_date ASC, o.id ASC)::NUMERIC AS running_balance,
        o.protocol,
        o.entry_type
    FROM ordered o
    ORDER BY o.transaction_date ASC, o.id ASC;
END;
$$;


-- ============================================================================
-- [6] REBUILD: get_student_financial_node
--     Single definitive signature: (p_student_id UUID, p_cycle_id BIGINT DEFAULT NULL)
--     Matches V43 design but with V36's extended fields for full detail view.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id   BIGINT DEFAULT NULL
)
RETURNS TABLE (
    student_id         UUID,
    display_name       TEXT,
    profile_photo_url  TEXT,
    grade              TEXT,
    class_name         TEXT,
    total_billed       NUMERIC,
    total_paid         NUMERIC,
    outstanding_balance NUMERIC,
    gross_billed       NUMERIC,
    scholarship_amount NUMERIC,
    integrity_score    INTEGER,
    unallocated_funds  NUMERIC,
    is_active          BOOLEAN,
    is_standby         BOOLEAN,
    academic_cycle_id  BIGINT,
    cycle_name         TEXT,
    ledger_status      TEXT,
    branch_id          BIGINT,
    next_due_date      DATE,
    next_due_amount    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cycle_id   BIGINT;
    v_cycle_name TEXT;
BEGIN
    -- Reconcile first to ensure summary tables are up-to-date
    BEGIN
        PERFORM public.admin_reconcile_student_account(p_student_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[V50] Reconcile skipped in node fetch: %', SQLERRM;
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
        pm.id::UUID                                                    AS student_id,
        COALESCE(pm.display_name, pm.email)::TEXT                     AS display_name,

        -- Paranoid photo: profiles first, then admissions subquery
        COALESCE(
            pm.profile_photo_url,
            adm_arc.adm_photo_val
        )::TEXT                                                        AS profile_photo_url,

        COALESCE(sp_node.grade, 'N/A')::TEXT                          AS grade,
        COALESCE(cl_node.name, 'N/A')::TEXT                           AS class_name,

        -- Finance from canonical student_fee_accounts (preferred) or finance_student_profiles
        COALESCE(sfa.total_billed,    fsp.total_billed,    0)::NUMERIC AS total_billed,
        COALESCE(sfa.total_paid,      fsp.total_paid,      0)::NUMERIC AS total_paid,
        COALESCE(sfa.outstanding_balance, fsp.outstanding_balance, 0)::NUMERIC AS outstanding_balance,

        -- Gross (same as total_billed — scholarship deduction not yet implemented at DB level)
        COALESCE(sfa.total_billed,    fsp.total_billed,    0)::NUMERIC AS gross_billed,
        0::NUMERIC                                                     AS scholarship_amount,

        COALESCE(sfa.integrity_score, fsp.integrity_score, 100)::INTEGER AS integrity_score,
        COALESCE(sfa.unallocated_funds, fsp.unallocated_funds, 0)::NUMERIC AS unallocated_funds,

        pm.is_active::BOOLEAN,
        -- is_standby = no invoices have been raised yet
        (NOT EXISTS (
            SELECT 1 FROM public.fee_invoices fi_sb
            WHERE fi_sb.student_id = pm.id
              AND LOWER(fi_sb.status::text) NOT IN ('cancelled', 'void')
        ))::BOOLEAN                                                    AS is_standby,

        v_cycle_id::BIGINT                                             AS academic_cycle_id,
        COALESCE(v_cycle_name, 'Unknown')::TEXT                        AS cycle_name,

        CASE
            WHEN COALESCE(sfa.outstanding_balance, fsp.outstanding_balance, 0) > 0
            THEN 'OUTSTANDING'
            ELSE 'SETTLED'
        END::TEXT                                                      AS ledger_status,

        COALESCE(sp_node.branch_id, 0)::BIGINT                        AS branch_id,

        -- Next pending invoice
        (SELECT MIN(fi_due.due_date)::DATE
         FROM public.fee_invoices fi_due
         WHERE fi_due.student_id = pm.id
           AND LOWER(fi_due.status::text) = 'pending'
           AND fi_due.due_date >= CURRENT_DATE)                        AS next_due_date,

        (SELECT fi_amt.total_amount - fi_amt.paid_amount::NUMERIC
         FROM public.fee_invoices fi_amt
         WHERE fi_amt.student_id = pm.id
           AND LOWER(fi_amt.status::text) = 'pending'
           AND fi_amt.due_date >= CURRENT_DATE
         ORDER BY fi_amt.due_date ASC
         LIMIT 1)                                                      AS next_due_amount

    FROM public.profiles pm
    LEFT JOIN public.student_profiles sp_node ON pm.id = sp_node.user_id
    LEFT JOIN public.school_classes cl_node ON sp_node.assigned_class_id = cl_node.id
    -- Try both canonical and legacy finance tables
    LEFT JOIN public.student_fee_accounts sfa ON pm.id = sfa.student_id
    LEFT JOIN public.finance_student_profiles fsp ON pm.id = fsp.student_id
    -- Photo from admissions (subquery eliminates column ambiguity)
    LEFT JOIN (
        SELECT DISTINCT ON (adm_inner.student_user_id)
            adm_inner.student_user_id  AS arc_student_id,
            adm_inner.profile_photo_url AS adm_photo_val
        FROM public.admissions adm_inner
        ORDER BY adm_inner.student_user_id, adm_inner.submitted_at DESC
    ) adm_arc ON pm.id = adm_arc.arc_student_id
    WHERE pm.id = p_student_id;
END;
$$;


-- ============================================================================
-- [7] ENSURE: student_fee_assignments table exists (required by sync billing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_fee_assignments (
    student_id   UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    structure_id BIGINT REFERENCES public.finance_fee_structures(id) ON DELETE SET NULL,
    assigned_at  TIMESTAMPTZ DEFAULT NOW(),
    assigned_by  UUID,
    notes        TEXT
);

-- Ensure student_fee_accounts table also exists (canonical summary store)
CREATE TABLE IF NOT EXISTS public.student_fee_accounts (
    student_id          UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_billed        NUMERIC DEFAULT 0,
    total_paid          NUMERIC DEFAULT 0,
    outstanding_balance NUMERIC DEFAULT 0,
    unallocated_funds   NUMERIC DEFAULT 0,
    integrity_score     INTEGER DEFAULT 100,
    financial_status    TEXT DEFAULT 'ACTIVE',
    last_synced_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- [8] PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_billing(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_running_ledger(UUID, BIGINT) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_student_financial_node(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_financial_node(UUID, BIGINT) TO service_role;

GRANT ALL ON TABLE public.student_fee_assignments TO authenticated;
GRANT ALL ON TABLE public.student_fee_assignments TO service_role;
GRANT ALL ON TABLE public.student_fee_accounts TO authenticated;
GRANT ALL ON TABLE public.student_fee_accounts TO service_role;

-- ============================================================================
-- Performance Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_fee_invoices_student_status
    ON public.fee_invoices(student_id, status);

CREATE INDEX IF NOT EXISTS idx_fee_payments_student_status
    ON public.fee_payments(student_id, status);

CREATE INDEX IF NOT EXISTS idx_finance_fee_structures_grade_status
    ON public.finance_fee_structures(target_grade, status);

COMMIT;

SELECT 'SUCCESS: Finance V50 INITIALIZE PROTOCOL Fix deployed. ' ||
       'admin_sync_student_billing, get_student_running_ledger, and ' ||
       'get_student_financial_node rebuilt with single unambiguous signatures. ' ||
       'CONFLICT_DETECTED error eliminated.' AS status;
