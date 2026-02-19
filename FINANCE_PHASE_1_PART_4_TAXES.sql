-- ==============================================================================
-- FINANCE PHASE 1, PART 4: FISCAL TAX MATRIX
-- ==============================================================================

BEGIN;

-- 1. TABLE DEFINITIONS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_tax_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT REFERENCES public.school_branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "GST 18%", "VAT 5%"
    code TEXT NOT NULL, -- e.g. "GST-18", "VAT-05"
    rate_percentage NUMERIC(5, 2) NOT NULL, -- 18.00
    is_inclusive BOOLEAN DEFAULT FALSE, -- If true, tax is included in the base price
    description TEXT,
    target_components TEXT[], -- Specific fee components to apply to (e.g. ["TRANSPORT", "MATERIAL"]) or NULL
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AUDIT LOGGERS
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_audit_tax_rules ON public.finance_tax_rules;
CREATE TRIGGER trg_audit_tax_rules
AFTER INSERT OR UPDATE OR DELETE ON public.finance_tax_rules
FOR EACH ROW EXECUTE FUNCTION public.fn_log_finance_audit();

-- 3. RPC: Upsert Tax Rule
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_tax_rule(
    p_branch_id BIGINT,
    p_name TEXT,
    p_code TEXT,
    p_rate_percentage NUMERIC,
    p_is_inclusive BOOLEAN,
    p_description TEXT,
    p_target_components TEXT[],
    p_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rule_id UUID;
BEGIN
    IF p_id IS NOT NULL THEN
        UPDATE public.finance_tax_rules
        SET name = p_name, code = p_code, rate_percentage = p_rate_percentage, 
            is_inclusive = p_is_inclusive, description = p_description, 
            target_components = p_target_components, updated_at = NOW()
        WHERE id = p_id
        RETURNING id INTO v_rule_id;
    ELSE
        INSERT INTO public.finance_tax_rules (
            branch_id, name, code, rate_percentage, is_inclusive, description, target_components
        ) VALUES (
            p_branch_id, p_name, p_code, p_rate_percentage, p_is_inclusive, p_description, p_target_components
        )
        RETURNING id INTO v_rule_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_rule_id);
END;
$$;

-- 4. RPC: Get Tax Rules
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_tax_rules(p_branch_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'code', code,
            'rate_percentage', rate_percentage,
            'is_inclusive', is_inclusive,
            'description', description,
            'target_components', target_components,
            'is_active', is_active
        )
    ) INTO v_result
    FROM public.finance_tax_rules
    WHERE branch_id = p_branch_id AND is_active = TRUE
    ORDER BY created_at DESC;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMIT;
