-- ==============================================================================
-- FINANCE PHASE 1, PART 3: ADJUSTMENT RULES (Discounts, Scholarships, Waivers)
-- ==============================================================================

BEGIN;

-- 1. TABLE DEFINITIONS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_adjustment_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT REFERENCES public.school_branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Sibling Discount", "Merit Scholarship"
    category TEXT CHECK (category IN ('Discount', 'Scholarship', 'Waiver', 'Late Fee')),
    value_type TEXT CHECK (value_type IN ('Percentage', 'Fixed')),
    value NUMERIC(10, 2) NOT NULL,
    criteria JSONB DEFAULT '{}'::JSONB, -- e.g. {"sibling_count": 2, "gpa_min": 3.5}
    is_automatic BOOLEAN DEFAULT FALSE, -- If true, engine applies it automatically
    target_components TEXT[], -- Specific fee components to apply to (e.g. ["TUITION"]) or NULL for all
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AUDIT LOGGERS
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_audit_adjustment_rules ON public.finance_adjustment_rules;
CREATE TRIGGER trg_audit_adjustment_rules
AFTER INSERT OR UPDATE OR DELETE ON public.finance_adjustment_rules
FOR EACH ROW EXECUTE FUNCTION public.fn_log_finance_audit();

-- 3. RPC: Upsert Adjustment Rule
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_adjustment_rule(
    p_branch_id BIGINT,
    p_name TEXT,
    p_category TEXT,
    p_value_type TEXT,
    p_value NUMERIC,
    p_is_automatic BOOLEAN,
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
        UPDATE public.finance_adjustment_rules
        SET name = p_name, category = p_category, value_type = p_value_type, value = p_value,
            is_automatic = p_is_automatic, target_components = p_target_components, updated_at = NOW()
        WHERE id = p_id
        RETURNING id INTO v_rule_id;
    ELSE
        INSERT INTO public.finance_adjustment_rules (
            branch_id, name, category, value_type, value, is_automatic, target_components
        ) VALUES (
            p_branch_id, p_name, p_category, p_value_type, p_value, p_is_automatic, p_target_components
        )
        RETURNING id INTO v_rule_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_rule_id);
END;
$$;

-- 4. RPC: Get Adjustment Rules
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_adjustment_rules(p_branch_id BIGINT)
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
            'category', category,
            'value_type', value_type,
            'value', value,
            'is_automatic', is_automatic,
            'target_components', target_components,
            'is_active', is_active
        )
    ) INTO v_result
    FROM public.finance_adjustment_rules
    WHERE branch_id = p_branch_id AND is_active = TRUE
    ORDER BY created_at DESC;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMIT;
