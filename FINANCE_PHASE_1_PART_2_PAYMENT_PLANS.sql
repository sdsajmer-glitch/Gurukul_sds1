-- ==============================================================================
-- FINANCE PHASE 1, PART 2: PAYMENT PLAN PROTOCOLS
-- ==============================================================================

BEGIN;

-- 1. TABLE DEFINITIONS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_payment_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT REFERENCES public.school_branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Standard Monthly", "Term-Wise (3 Installments)"
    type TEXT CHECK (type IN ('Monthly', 'Quartz', 'Term', 'Annual', 'Custom')),
    total_splits INTEGER DEFAULT 1,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_payment_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    protocol_id UUID REFERENCES public.finance_payment_protocols(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    percentage_value NUMERIC(5,2) NOT NULL, -- Should sum to 100.00
    due_day_offset INTEGER, -- Days from Academic Year Start
    due_date_fixed DATE,    -- Optional: Fixed date override
    label TEXT -- "April Fee", "Term 1"
);

-- 2. AUDIT LOGGERS
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_audit_payment_protocols ON public.finance_payment_protocols;
CREATE TRIGGER trg_audit_payment_protocols
AFTER INSERT OR UPDATE OR DELETE ON public.finance_payment_protocols
FOR EACH ROW EXECUTE FUNCTION public.fn_log_finance_audit();

-- 3. RPC: Upsert Payment Protocol
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_payment_protocol(
    p_branch_id BIGINT,
    p_name TEXT,
    p_type TEXT,
    p_splits INTEGER,
    p_description TEXT,
    p_split_data JSONB, -- Array of { number, percentage, offset, label }
    p_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_protocol_id UUID;
    v_split JSONB;
BEGIN
    -- 1. Upsert Protocol Header
    IF p_id IS NOT NULL THEN
        UPDATE public.finance_payment_protocols 
        SET name = p_name, type = p_type, total_splits = p_splits, description = p_description, updated_at = NOW()
        WHERE id = p_id
        RETURNING id INTO v_protocol_id;
    ELSE
        INSERT INTO public.finance_payment_protocols (branch_id, name, type, total_splits, description)
        VALUES (p_branch_id, p_name, p_type, p_splits, p_description)
        RETURNING id INTO v_protocol_id;
    END IF;

    -- 2. Replace Splits
    DELETE FROM public.finance_payment_splits WHERE protocol_id = v_protocol_id;

    IF p_split_data IS NOT NULL THEN
        FOR v_split IN SELECT * FROM jsonb_array_elements(p_split_data)
        LOOP
            INSERT INTO public.finance_payment_splits (
                protocol_id, installment_number, percentage_value, due_day_offset, label
            ) VALUES (
                v_protocol_id,
                (v_split->>'number')::INTEGER,
                (v_split->>'percentage')::NUMERIC,
                (v_split->>'offset')::INTEGER,
                (v_split->>'label')::TEXT
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_protocol_id);
END;
$$;

-- 4. RPC: Get Payment Protocols
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_payment_protocols(p_branch_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'type', p.type,
            'total_splits', p.total_splits,
            'description', p.description,
            'is_active', p.is_active,
            'splits', (
                SELECT jsonb_agg(jsonb_build_object(
                    'number', s.installment_number,
                    'percentage', s.percentage_value,
                    'offset', s.due_day_offset,
                    'label', s.label
                ) ORDER BY s.installment_number)
                FROM public.finance_payment_splits s
                WHERE s.protocol_id = p.id
            )
        )
    ) INTO v_result
    FROM public.finance_payment_protocols p
    WHERE p.branch_id = p_branch_id AND p.is_active = TRUE
    ORDER BY p.created_at DESC;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMIT;
