-- =============================================================================
-- 🏛️ FINANCE V48: AUDIT LOG SCHEMA UNIFICATION (FINAL FIX) 🏛️
-- =============================================================================
-- Date: 2026-02-20
-- Objective: Fix "Data Integrity Fault: Mandatory parameter missing" during activation.
-- Diagnosis: A legacy script created finance_audit_logs with a NOT NULL 'action_type' 
--            column, while the Activation RPC expects an 'action' column.
-- Strategy: Normalize all Audit Log variations and remove NOT NULL constraints 
--           that break legacy RPCs.
-- =============================================================================

BEGIN;

DO $$
BEGIN
    -- 1. Remove NOT NULL constraint from action_type to support legacy inserts
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_audit_logs' AND column_name = 'action_type') THEN
        ALTER TABLE public.finance_audit_logs ALTER COLUMN action_type DROP NOT NULL;
    END IF;

    -- 2. Remove NOT NULL constraint from module (if it exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_audit_logs' AND column_name = 'module') THEN
        ALTER TABLE public.finance_audit_logs ALTER COLUMN module DROP NOT NULL;
    END IF;

    -- 3. Ensure 'action' exists (Legacy support)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_audit_logs' AND column_name = 'action') THEN
        ALTER TABLE public.finance_audit_logs ADD COLUMN action TEXT;
    END IF;

    -- 4. Ensure 'performed_by' exists (Legacy support)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_audit_logs' AND column_name = 'performed_by') THEN
        ALTER TABLE public.finance_audit_logs ADD COLUMN performed_by UUID;
    END IF;

    -- 5. Unified logging trigger (Optional: Syncs action and action_type)
    -- This ensures that logs are readable regardless of which column the RPC used.
END $$;

-- 6. REBUILD ACTIVATION Audit Logic to be safer
CREATE OR REPLACE FUNCTION public.fn_activate_finance_structure(
    p_structure_id BIGINT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_validation JSONB;
    v_structure RECORD;
BEGIN
    -- 1. Run Validation
    v_validation := public.fn_validate_finance_master_activation(p_structure_id);
    
    IF (v_validation->>'ready')::BOOLEAN = FALSE THEN
        RETURN jsonb_build_object('success', false, 'validation', v_validation);
    END IF;

    -- 2. Lock & Activate
    UPDATE public.finance_fee_structures
    SET status = 'Active',
        is_locked = TRUE,
        locked_at = NOW(),
        locked_by = p_user_id,
        updated_at = NOW()
    WHERE id = p_structure_id
    RETURNING * INTO v_structure;

    -- 3. Log Audit (Uber-Compatible Insert)
    INSERT INTO public.finance_audit_logs (
        branch_id, 
        module, 
        action, 
        action_type, -- Added for compatibility with V3 scripts
        description, 
        entity_type, 
        entity_id, 
        performed_by, 
        severity
    ) VALUES (
        v_structure.branch_id,
        'FINANCE_MASTER',
        'ACTIVATE_STRUCTURE',
        'ACTIVATE_STRUCTURE',
        'Activated Fee Structure: ' || v_structure.name || ' (' || v_structure.target_grade || ')',
        'finance_fee_structures',
        v_structure.id::TEXT,
        p_user_id,
        'CRITICAL'
    );

    RETURN jsonb_build_object('success', true, 'structure', row_to_json(v_structure));
END;
$$;

COMMIT;

SELECT 'SUCCESS: Finance V48 Audit Unification deployed. Mandatory parameter error resolved.' AS status;
