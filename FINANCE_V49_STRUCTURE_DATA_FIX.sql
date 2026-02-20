-- =============================================================================
-- 🏛️ FINANCE V49: FEE STRUCTURE DATA FLOW FIX 🏛️
-- =============================================================================
-- Date: 2026-02-20
-- Issue: Fee structure cards show ₹0 and wizard opens blank when editing.
-- Root Cause: get_fee_structures_with_metrics RPC was missing critical fields:
--   - total_amount (card needs this for the total display)
--   - description (wizard needs this for Protocol Setup step)
--   - currency (wizard needs this for currency selector)
--   - components (wizard needs this to populate Fee Components step)
--   - locked_at, locked_by (wizard needs these for lock state)
-- Fix: Rebuild the RPC to return ALL fields needed by both the card and wizard.
-- =============================================================================

BEGIN;

-- Drop all signatures to prevent overload conflicts
DROP FUNCTION IF EXISTS public.get_fee_structures_with_metrics() CASCADE;
DROP FUNCTION IF EXISTS public.get_fee_structures_with_metrics(BIGINT) CASCADE;

-- Rebuild with full data payload including embedded components
CREATE OR REPLACE FUNCTION public.get_fee_structures_with_metrics(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    academic_year TEXT,
    target_grade TEXT,
    description TEXT,
    currency TEXT,
    status TEXT,
    type TEXT,
    total_amount NUMERIC,
    base_amount NUMERIC,
    student_count BIGINT,
    projected_revenue NUMERIC,
    collected_revenue NUMERIC,
    integrity_score INTEGER,
    is_default BOOLEAN,
    is_locked BOOLEAN,
    locked_at TIMESTAMPTZ,
    locked_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    components JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        fs.id,
        fs.name::TEXT,
        -- Support both academic_year (text field) and academic_cycle_id (FK to academic_years)
        COALESCE(
            fs.academic_year,
            (SELECT ay.year_name FROM public.academic_years ay WHERE ay.id = fs.academic_cycle_id),
            'N/A'
        )::TEXT AS academic_year,
        fs.target_grade::TEXT,
        COALESCE(fs.description, '')::TEXT AS description,
        COALESCE(fs.currency, 'INR')::TEXT AS currency,
        fs.status::TEXT,
        COALESCE(fs.type, 'Standard')::TEXT AS type,

        -- total_amount: Sum of all component amounts (annualized)
        COALESCE((
            SELECT SUM(
                fc.amount * CASE
                    WHEN LOWER(fc.frequency) = 'monthly' THEN 12
                    WHEN LOWER(fc.frequency) = 'quarterly' THEN 4
                    WHEN LOWER(fc.frequency) = 'semi-annually' THEN 2
                    ELSE 1
                END
            )
            FROM public.finance_fee_components fc
            WHERE fc.structure_id = fs.id
        ), 0)::NUMERIC AS total_amount,

        -- base_amount: Raw sum without frequency multiplication
        COALESCE((
            SELECT SUM(fc.amount)
            FROM public.finance_fee_components fc
            WHERE fc.structure_id = fs.id
        ), 0)::NUMERIC AS base_amount,

        -- student_count: Students linked to this structure via invoices
        COALESCE((
            SELECT COUNT(DISTINCT fi.student_id)
            FROM public.fee_invoices fi
            WHERE fi.structure_id = fs.id
              AND LOWER(fi.status::text) != 'cancelled'
        ), 0)::BIGINT AS student_count,

        -- projected_revenue
        COALESCE((
            SELECT SUM(fi.total_amount)
            FROM public.fee_invoices fi
            WHERE fi.structure_id = fs.id
              AND LOWER(fi.status::text) != 'cancelled'
        ), 0)::NUMERIC AS projected_revenue,

        -- collected_revenue
        COALESCE((
            SELECT SUM(fi.paid_amount)
            FROM public.fee_invoices fi
            WHERE fi.structure_id = fs.id
              AND LOWER(fi.status::text) != 'cancelled'
        ), 0)::NUMERIC AS collected_revenue,

        100::INTEGER AS integrity_score,
        COALESCE(fs.is_default, false)::BOOLEAN,
        COALESCE(fs.is_locked, false)::BOOLEAN,
        fs.locked_at::TIMESTAMPTZ,
        fs.locked_by::UUID,
        fs.created_at::TIMESTAMPTZ,
        fs.updated_at::TIMESTAMPTZ,

        -- Embed components as JSONB array so the wizard can use them directly
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', fc.id,
                'name', fc.name,
                'amount', fc.amount,
                'frequency', COALESCE(fc.frequency, 'Annually'),
                'is_mandatory', COALESCE(fc.is_mandatory, true),
                'category', COALESCE(fc.category, 'Tuition'),
                'gl_code', COALESCE(fc.gl_code, ''),
                'tax_percentage', COALESCE(fc.tax_percentage, 0),
                'is_refundable', COALESCE(fc.is_refundable, false)
            ) ORDER BY fc.id)
            FROM public.finance_fee_components fc
            WHERE fc.structure_id = fs.id
        ), '[]'::jsonb) AS components

    FROM public.finance_fee_structures fs
    WHERE (p_branch_id IS NULL OR fs.branch_id = p_branch_id)
    ORDER BY fs.created_at DESC;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_fee_structures_with_metrics(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fee_structures_with_metrics(BIGINT) TO service_role;

COMMIT;

SELECT 'SUCCESS: Finance V49 Structure Data Flow Fix deployed. Cards and Wizard now receive full payload.' AS status;
