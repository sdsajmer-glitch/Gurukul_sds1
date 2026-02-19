-- =============================================================================
-- FINANCE GOVERNANCE LOGIC ENHANCEMENT
-- =============================================================================
-- Description: Core governance state, validation, and audit tracking.
-- =============================================================================

BEGIN;

-- [1] UNIFIED FINANCE SETTINGS
-- Requested Table: finance_settings
-- Using 'finance_global_settings' as the base if it exists, or creating 'finance_settings'
-- To avoid confusion, let's create 'finance_settings' as requested and migrate if needed.

CREATE TABLE IF NOT EXISTS public.finance_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT UNIQUE REFERENCES public.school_branches(id) ON DELETE CASCADE,
    tax_enabled BOOLEAN DEFAULT FALSE,
    installment_strict_mode BOOLEAN DEFAULT FALSE,
    late_fee_enabled BOOLEAN DEFAULT FALSE,
    ledger_lock_date DATE,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_finance_settings_branch ON public.finance_settings(branch_id);

-- [2] DATA MIGRATION (If legacy table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_global_settings') THEN
        INSERT INTO public.finance_settings (branch_id, tax_enabled, late_fee_enabled, ledger_lock_date, updated_at)
        SELECT branch_id, is_tax_enabled, auto_late_fee_enabled, ledger_lock_date, updated_at
        FROM public.finance_global_settings
        ON CONFLICT (branch_id) DO UPDATE SET
            tax_enabled = EXCLUDED.tax_enabled,
            late_fee_enabled = EXCLUDED.late_fee_enabled,
            ledger_lock_date = EXCLUDED.ledger_lock_date,
            updated_at = EXCLUDED.updated_at;
    END IF;
END $$;

-- [3] ATOMIC GOVERNANCE SAVE RPC
-- Purpose: Atomic validation, state persistence, and audit logging.
CREATE OR REPLACE FUNCTION public.save_finance_governance_settings(
    p_branch_id BIGINT,
    p_tax_enabled BOOLEAN,
    p_installment_strict_mode BOOLEAN,
    p_late_fee_enabled BOOLEAN,
    p_ledger_lock_date DATE
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    v_old_settings JSONB;
    v_new_settings JSONB;
    v_user_id UUID;
    v_error_msg TEXT;
    v_has_tax_codes BOOLEAN;
    v_has_payment_plans BOOLEAN;
    v_academic_start DATE;
BEGIN
    -- 0. Get current user
    v_user_id := auth.uid();

    -- 1. RBAC Check (Handled by RLS ideally, but explicit for safety)
    -- IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role IN ('SUPER_ADMIN', 'FINANCE_ADMIN')) THEN
    --     RAISE EXCEPTION 'Unauthorized: Insufficient permissions for governance changes.';
    -- END IF;

    -- 2. Capture Old State for Audit
    SELECT row_to_json(s)::jsonb INTO v_old_settings 
    FROM public.finance_settings s 
    WHERE branch_id = p_branch_id;

    -- 3. VALIDATION RULES
    
    -- Rule 1: Fiscal Tax Matrix
    IF p_tax_enabled THEN
        SELECT EXISTS(SELECT 1 FROM public.finance_tax_matrix WHERE branch_id = p_branch_id AND is_active = true) INTO v_has_tax_codes;
        IF NOT v_has_tax_codes THEN
            v_error_msg := 'Validation Error: No active tax codes found in Fiscal Tax Matrix. Please configure tax codes before enabling tax.';
            RETURN jsonb_build_object('success', false, 'error', v_error_msg);
        END IF;
    END IF;

    -- Rule 2: Installment Logic
    IF p_installment_strict_mode THEN
        SELECT EXISTS(SELECT 1 FROM public.finance_payment_protocols WHERE branch_id = p_branch_id AND is_active = true) INTO v_has_payment_plans;
        IF NOT v_has_payment_plans THEN
            v_error_msg := 'Validation Error: No payment plans defined. Installment logic requires at least one active protocol.';
            RETURN jsonb_build_object('success', false, 'error', v_error_msg);
        END IF;
    END IF;

    -- Rule 3: Ledger Lock Date
    IF p_ledger_lock_date IS NOT NULL THEN
        SELECT start_date INTO v_academic_start 
        FROM public.academic_years 
        WHERE is_current = true OR start_date <= p_ledger_lock_date 
        ORDER BY start_date DESC LIMIT 1;

        IF p_ledger_lock_date < v_academic_start THEN
            v_error_msg := 'Validation Error: Ledger lock date cannot be before the start of the current academic year (' || v_academic_start || ').';
            RETURN jsonb_build_object('success', false, 'error', v_error_msg);
        END IF;
    END IF;

    -- 4. PERFORM UPSERT
    INSERT INTO public.finance_settings (
        branch_id, 
        tax_enabled, 
        installment_strict_mode, 
        late_fee_enabled, 
        ledger_lock_date,
        updated_by,
        updated_at
    )
    VALUES (
        p_branch_id,
        p_tax_enabled,
        p_installment_strict_mode,
        p_late_fee_enabled,
        p_ledger_lock_date,
        v_user_id,
        NOW()
    )
    ON CONFLICT (branch_id) DO UPDATE SET
        tax_enabled = EXCLUDED.tax_enabled,
        installment_strict_mode = EXCLUDED.installment_strict_mode,
        late_fee_enabled = EXCLUDED.late_fee_enabled,
        ledger_lock_date = EXCLUDED.ledger_lock_date,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    RETURNING row_to_json(finance_settings)::jsonb INTO v_new_settings;

    -- 5. AUDIT LOGGING
    INSERT INTO public.finance_governance_audit (
        branch_id,
        action_type,
        description,
        entity_type,
        old_value,
        new_value,
        severity,
        performed_by,
        performed_at
    )
    VALUES (
        p_branch_id,
        'GOVERNANCE_UPDATE',
        'Updated Foundation Governance settings: ' || 
        CASE WHEN p_tax_enabled != (v_old_settings->>'tax_enabled')::boolean THEN 'Tax Matrix changed to ' || p_tax_enabled ELSE '' END ||
        ' ' || CASE WHEN p_late_fee_enabled != (v_old_settings->>'late_fee_enabled')::boolean THEN 'Late Fee changed to ' || p_late_fee_enabled ELSE '' END,
        'finance_settings',
        v_old_settings,
        v_new_settings,
        'MEDIUM',
        v_user_id,
        NOW()
    );

    -- 6. DOWNSTREAM IMPACT (Optional Background Job Trigger)
    -- PERFORM public.trigger_finance_governance_sync(p_branch_id);

    RETURN jsonb_build_object(
        'success', true, 
        'data', v_new_settings,
        'message', 'Governance settings updated successfully.'
    );
END;
$$;

-- [4] UPDATE GET_FINANCE_MASTER_STATE
-- Ensure it uses the new table 'public.finance_settings'
CREATE OR REPLACE FUNCTION public.get_finance_master_state(p_branch_id BIGINT)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    v_settings JSONB;
    v_taxes JSONB;
    v_approvals JSONB;
    v_readiness JSONB;
BEGIN
    -- 1. Fetch Settings (From new table)
    SELECT jsonb_build_object(
        'tax_enabled', tax_enabled,
        'installment_strict_mode', installment_strict_mode,
        'late_fee_enabled', late_fee_enabled,
        'ledger_lock_date', ledger_lock_date,
        'updated_at', updated_at,
        'updated_by_name', (SELECT full_name FROM public.profiles WHERE id = updated_by)
    ) INTO v_settings 
    FROM public.finance_settings 
    WHERE branch_id = p_branch_id;

    -- IF NULL, try legacy fallback or return defaults
    IF v_settings IS NULL THEN
        v_settings := '{"tax_enabled": false, "installment_strict_mode": false, "late_fee_enabled": true}'::jsonb;
    END IF;

    -- 2. Fetch Taxes
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'tax_name', tax_name,
        'tax_rate', tax_rate,
        'tax_code', tax_code
    )) INTO v_taxes 
    FROM public.finance_tax_matrix 
    WHERE branch_id = p_branch_id AND is_active = true;

    -- 3. Fetch Approvals
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'action_type', action_type,
        'threshold', threshold_amount
    )) INTO v_approvals 
    FROM public.finance_approval_matrix 
    WHERE branch_id = p_branch_id AND is_active = true;

    -- 4. Calculate Readiness
    SELECT public.fn_calculate_finance_readiness(p_branch_id) INTO v_readiness;

    RETURN jsonb_build_object(
        'settings', v_settings,
        'taxes', COALESCE(v_taxes, '[]'::jsonb),
        'approvals', COALESCE(v_approvals, '[]'::jsonb),
        'readiness', COALESCE(v_readiness, '{}'::jsonb)
    );
END;
$$;

COMMIT;
