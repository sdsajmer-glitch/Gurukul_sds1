-- ==============================================================================
-- FINAL RESOLUTION: AMBIGUOUS RPC FIX
-- ==============================================================================
-- This script resolves the "Could not choose the best candidate function" error
-- by removing all overloaded versions of admin_update_enquiry_status and 
-- establishing a single, robust 'text'-based signature.
-- ==============================================================================

BEGIN;

-- 1. DROP ALL POTENTIAL OVERLOADS
-- This ensures the ambiguity is physically removed from the Postgres catalog.
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(text, text, text);
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(text, text);

-- 2. CREATE THE AUTHORITATIVE VERSION (TEXT-BASED)
-- We use TEXT for the ID to remain compatible with legacy IDs and frontend strings.
CREATE OR REPLACE FUNCTION public.admin_update_enquiry_status(
    p_enquiry_id text,
    p_status text,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_enquiry_uuid uuid;
BEGIN
    -- 1. Safe cast to UUID (Ensures we don't crash on legacy nodes)
    BEGIN
        v_enquiry_uuid := p_enquiry_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid Identity Node ID format');
    END;

    -- 2. Perform Atomic Update
    UPDATE public.enquiries
    SET 
        status = p_status,
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = v_enquiry_uuid;

    -- 3. Check Result
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Identity Node not found in registry');
    END IF;

    -- 4. Audit Log (Optional but recommended for state changes)
    -- INSERT INTO public.audit_logs (user_id, action, details) ...

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. RE-GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.admin_update_enquiry_status(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_enquiry_status(text, text, text) TO service_role;

COMMIT;

SELECT 'SUCCESS: Ambiguity resolved. Single TEXT-based status update enabled.' as status;
