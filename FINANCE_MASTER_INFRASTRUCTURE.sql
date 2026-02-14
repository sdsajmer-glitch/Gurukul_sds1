-- ==============================================================================
-- FINANCE MASTER CONTROL CENTER: INFRASTRUCTURE LAYER
-- ==============================================================================
-- Description: Core tables for Global Configuration, Tax Matrices, 
--              and Governance Approval Workflows.
-- ==============================================================================

BEGIN;

-- [1] GLOBAL FINANCE SETTINGS
-- Purpose: Central configuration brain for the Finance module.
CREATE TABLE IF NOT EXISTS public.finance_global_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT REFERENCES public.school_branches(id) ON DELETE CASCADE,
    academic_year_id BIGINT REFERENCES public.academic_years(id),
    base_currency TEXT DEFAULT 'INR',
    is_tax_enabled BOOLEAN DEFAULT FALSE,
    approval_hierarchy_enabled BOOLEAN DEFAULT FALSE,
    auto_late_fee_enabled BOOLEAN DEFAULT TRUE,
    version_control_active BOOLEAN DEFAULT TRUE,
    ledger_lock_date DATE,
    readiness_completion_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id)
);

-- [2] FISCAL TAX MATRIX
-- Purpose: Regional tax nodes for grade/component level calculation.
CREATE TABLE IF NOT EXISTS public.finance_tax_matrix (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT REFERENCES public.school_branches(id),
    tax_name TEXT NOT NULL, -- GST, VAT, Service Tax
    tax_code TEXT NOT NULL,
    tax_rate NUMERIC(5,2) NOT NULL,
    applies_to_grade TEXT, -- NULL for global
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [3] APPROVAL MATRIX
-- Purpose: Multi-level authority for financial mutations.
CREATE TABLE IF NOT EXISTS public.finance_approval_matrix (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT REFERENCES public.school_branches(id),
    action_type TEXT NOT NULL, -- 'DISCOUNT_APPROVAL', 'FEE_WAIVER', 'REFUND'
    level_1_role TEXT, -- Role allowed for Level 1
    level_2_role TEXT, -- Role allowed for Level 2
    threshold_amount NUMERIC(15,2), -- Beyond this, Level 2 is required
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [4] GOVERNANCE AUDIT EVOLUTION
-- Ensure audit trail supports versioning.
ALTER TABLE IF EXISTS public.finance_governance_audit 
ADD COLUMN IF NOT EXISTS version_id UUID,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- [5] ENHANCED READINESS CALCULATOR
CREATE OR REPLACE FUNCTION public.fn_calculate_finance_readiness(p_branch_id BIGINT)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    v_has_structures BOOLEAN;
    v_has_payments BOOLEAN;
    v_has_discounts BOOLEAN;
    v_has_tax BOOLEAN;
    v_has_approval BOOLEAN;
    v_score INTEGER := 0;
    v_missing_nodes TEXT[] := ARRAY[]::TEXT[];
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.fee_structures WHERE branch_id = p_branch_id AND status = 'Active') INTO v_has_structures;
    SELECT EXISTS(SELECT 1 FROM public.finance_payment_protocols WHERE branch_id = p_branch_id AND is_active = true) INTO v_has_payments;
    SELECT EXISTS(SELECT 1 FROM public.finance_adjustment_rules WHERE branch_id = p_branch_id AND is_active = true) INTO v_has_discounts;
    SELECT EXISTS(SELECT 1 FROM public.finance_tax_matrix WHERE branch_id = p_branch_id AND is_active = true) INTO v_has_tax;
    SELECT EXISTS(SELECT 1 FROM public.finance_approval_matrix WHERE branch_id = p_branch_id AND is_active = true) INTO v_has_approval;

    IF v_has_structures THEN v_score := v_score + 35; ELSE v_missing_nodes := array_append(v_missing_nodes, 'Active Fee Protocols'); END IF;
    IF v_has_payments THEN v_score := v_score + 20; ELSE v_missing_nodes := array_append(v_missing_nodes, 'Payment Plan Protocols'); END IF;
    IF v_has_discounts THEN v_score := v_score + 15; ELSE v_missing_nodes := array_append(v_missing_nodes, 'Discount & Waiver Rules'); END IF;
    IF v_has_tax THEN v_score := v_score + 15; ELSE v_missing_nodes := array_append(v_missing_nodes, 'Fiscal Tax Matrix'); END IF;
    IF v_has_approval THEN v_score := v_score + 15; ELSE v_missing_nodes := array_append(v_missing_nodes, 'Approval Matrix'); END IF;

    RETURN jsonb_build_object(
        'percentage', v_score,
        'hasStructures', v_has_structures,
        'hasPayments', v_has_payments,
        'hasTax', v_has_tax,
        'hasApproval', v_has_approval,
        'isSetupComplete', (v_score >= 85),
        'missingSteps', v_missing_nodes
    );
END;
$$;

-- [6] RPC: GET_FINANCE_MASTER_STATE
-- Purpose: Atomic retrieval of the entire Master Control Center configuration.
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
    -- 1. Fetch Settings
    SELECT jsonb_build_object(
        'base_currency', base_currency,
        'is_tax_enabled', is_tax_enabled,
        'approval_hierarchy_enabled', approval_hierarchy_enabled,
        'auto_late_fee_enabled', auto_late_fee_enabled,
        'ledger_lock_date', ledger_lock_date
    ) INTO v_settings 
    FROM public.finance_global_settings 
    WHERE branch_id = p_branch_id;

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
        'settings', COALESCE(v_settings, '{}'::jsonb),
        'taxes', COALESCE(v_taxes, '[]'::jsonb),
        'approvals', COALESCE(v_approvals, '[]'::jsonb),
        'readiness', COALESCE(v_readiness, '{}'::jsonb)
    );
END;
$$;

-- [7] ADMINISTRATIVE UPDATE FUNCTIONS
-- Purpose: Direct mutation points for Master Control UI.

CREATE OR REPLACE FUNCTION public.update_finance_global_settings(
    p_branch_id BIGINT,
    p_is_tax_enabled BOOLEAN,
    p_approval_enabled BOOLEAN,
    p_late_fee_enabled BOOLEAN,
    p_version_control BOOLEAN
)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.finance_global_settings (
        branch_id, 
        is_tax_enabled, 
        approval_hierarchy_enabled, 
        auto_late_fee_enabled,
        version_control_active,
        updated_at
    )
    VALUES (
        p_branch_id,
        p_is_tax_enabled,
        p_approval_enabled,
        p_late_fee_enabled,
        p_version_control,
        NOW()
    )
    ON CONFLICT (branch_id) DO UPDATE SET
        is_tax_enabled = EXCLUDED.is_tax_enabled,
        approval_hierarchy_enabled = EXCLUDED.approval_hierarchy_enabled,
        auto_late_fee_enabled = EXCLUDED.auto_late_fee_enabled,
        version_control_active = EXCLUDED.version_control_active,
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_finance_tax_node(
    p_branch_id BIGINT,
    p_tax_name TEXT,
    p_tax_code TEXT,
    p_tax_rate NUMERIC,
    p_id UUID DEFAULT NULL
)
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF p_id IS NOT NULL THEN
        UPDATE public.finance_tax_matrix 
        SET tax_name = p_tax_name, tax_code = p_tax_code, tax_rate = p_tax_rate
        WHERE id = p_id RETURNING id INTO v_id;
    ELSE
        INSERT INTO public.finance_tax_matrix (branch_id, tax_name, tax_code, tax_rate)
        VALUES (p_branch_id, p_tax_name, p_tax_code, p_tax_rate)
        RETURNING id INTO v_id;
    END IF;
    RETURN v_id;
END;
$$;

COMMIT;
