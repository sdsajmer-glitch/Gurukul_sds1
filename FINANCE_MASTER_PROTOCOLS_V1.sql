-- ==============================================================================
-- FINANCE MASTER PROTOCOLS V1
-- ==============================================================================
-- Description: Creates missing tables for Payment Plans and Adjustments (Discounts).
--              Updates Master State RPC to include these new nodes.
-- ==============================================================================

BEGIN;

-- [1] FINANCE PAYMENT PROTOCOLS (Installment Engine)
-- Purpose: Defines how fee structures are split over time.
CREATE TABLE IF NOT EXISTS public.finance_payment_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT REFERENCES public.school_branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- "Standard 3-Term", "Monthly 12-Split"
    installment_type TEXT CHECK (installment_type IN ('Monthly', 'Quartz', 'Term', 'Annual', 'Custom')),
    total_splits INTEGER DEFAULT 1,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Splits (Child Table)
CREATE TABLE IF NOT EXISTS public.finance_payment_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    protocol_id UUID REFERENCES public.finance_payment_protocols(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    percentage_value NUMERIC(5,2) NOT NULL, -- Total must sum to 100%
    due_day_offset INTEGER, -- Days from start of academic year
    label TEXT -- "Term 1", "April Installment"
);


-- [2] FINANCE ADJUSTMENT RULES (Discount & Waiver Engine)
-- Purpose: Rules engine for applying discounts automatically or manually.
CREATE TABLE IF NOT EXISTS public.finance_adjustment_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT REFERENCES public.school_branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- "Sibling Discount", "Staff Child"
    category TEXT CHECK (category IN ('Merit', 'Sibling', 'Staff', 'EWS', 'Custom')),
    adjustment_type TEXT CHECK (adjustment_type IN ('Percentage', 'Flat Amount')),
    adjustment_value NUMERIC(15,2) NOT NULL,
    applies_to_fee_heads TEXT[], -- Array of Fee Component Names to apply on
    condition_logic JSONB DEFAULT '{}'::jsonb, -- Future proofing for complex rules
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- [3] UPDATE RPC: get_finance_master_state
-- Updated to include the new tables in the master payload.
CREATE OR REPLACE FUNCTION public.get_finance_master_state(p_branch_id BIGINT)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    v_settings JSONB;
    v_taxes JSONB;
    v_approvals JSONB;
    v_protocols JSONB;
    v_adjustments JSONB;
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

    -- 4. Fetch Payment Protocols
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'type', installment_type,
        'splits', total_splits
    )) INTO v_protocols 
    FROM public.finance_payment_protocols 
    WHERE branch_id = p_branch_id AND is_active = true;

    -- 5. Fetch Adjustment Rules
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'category', category,
        'value', adjustment_value,
        'type', adjustment_type
    )) INTO v_adjustments 
    FROM public.finance_adjustment_rules 
    WHERE branch_id = p_branch_id AND is_active = true;

    -- 6. Calculate Readiness
    SELECT public.fn_calculate_finance_readiness(p_branch_id) INTO v_readiness;

    RETURN jsonb_build_object(
        'settings', COALESCE(v_settings, '{}'::jsonb),
        'taxes', COALESCE(v_taxes, '[]'::jsonb),
        'approvals', COALESCE(v_approvals, '[]'::jsonb),
        'protocols', COALESCE(v_protocols, '[]'::jsonb),
        'adjustments', COALESCE(v_adjustments, '[]'::jsonb),
        'readiness', COALESCE(v_readiness, '{}'::jsonb)
    );
END;
$$;


-- [4] PROTOCOL MUTATION RPCS
-- UPSERT PAYMENT PROTOCOL
CREATE OR REPLACE FUNCTION public.upsert_payment_protocol(
    p_branch_id BIGINT,
    p_name TEXT,
    p_type TEXT,
    p_splits INTEGER,
    p_id UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
    IF p_id IS NOT NULL THEN
        UPDATE public.finance_payment_protocols 
        SET name = p_name, installment_type = p_type, total_splits = p_splits, updated_at = NOW()
        WHERE id = p_id RETURNING id INTO v_id;
    ELSE
        INSERT INTO public.finance_payment_protocols (branch_id, name, installment_type, total_splits)
        VALUES (p_branch_id, p_name, p_type, p_splits)
        RETURNING id INTO v_id;
    END IF;
    RETURN v_id;
END;
$$;

-- UPSERT ADJUSTMENT RULE
CREATE OR REPLACE FUNCTION public.upsert_adjustment_rule(
    p_branch_id BIGINT,
    p_name TEXT,
    p_category TEXT,
    p_type TEXT,
    p_value NUMERIC,
    p_id UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
    IF p_id IS NOT NULL THEN
        UPDATE public.finance_adjustment_rules
        SET name = p_name, category = p_category, adjustment_type = p_type, adjustment_value = p_value
        WHERE id = p_id RETURNING id INTO v_id;
    ELSE
        INSERT INTO public.finance_adjustment_rules (branch_id, name, category, adjustment_type, adjustment_value)
        VALUES (p_branch_id, p_name, p_category, p_type, p_value)
        RETURNING id INTO v_id;
    END IF;
    RETURN v_id;
END;
$$;

COMMIT;
