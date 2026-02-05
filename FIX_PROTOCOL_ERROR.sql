-- ==============================================================================
-- FIX PROTOCOL ERROR: ON CONFLICT CONSTRAINT
-- ==============================================================================
-- This script fixes the "no unique or exclusion constraint matching the ON CONFLICT specification" error.
-- It works by identifying and replacing the faulty 'generate_admission_share_code' function.

BEGIN;

-- 1. DROP EXISTING FUNCTION (To remove any legacy conflicting logic)
DROP FUNCTION IF EXISTS public.generate_admission_share_code(uuid, text, text);

-- 2. RECREATE FUNCTION WITH CLEAN INSERT LOGIC (No ON CONFLICT issues)
CREATE OR REPLACE FUNCTION public.generate_admission_share_code(
    p_admission_id uuid,
    p_purpose text,
    p_code_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code text;
    v_expires_at timestamp with time zone;
    v_id bigint;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    -- Generate 12-char clean HEX code (e.g., 4A1B2C3D4E5F)
    v_code := upper(encode(gen_random_bytes(6), 'hex'));
    
    -- Ensure uniqueness of the CODE itself
    WHILE EXISTS (SELECT 1 FROM public.admission_share_codes WHERE code = v_code) LOOP
        v_code := upper(encode(gen_random_bytes(6), 'hex'));
    END LOOP;
    
    v_expires_at := now() + interval '24 hours';
    
    -- Simple INSERT (No ON CONFLICT clause to avoid constraint errors)
    INSERT INTO public.admission_share_codes (
        admission_id, 
        enquiry_id,
        code,
        code_type,
        purpose,
        expires_at,
        created_by,
        status
    ) VALUES (
        CASE WHEN p_code_type = 'Admission' THEN p_admission_id ELSE NULL END,
        CASE WHEN p_code_type = 'Enquiry' THEN p_admission_id ELSE NULL END, 
        v_code,
        p_code_type,
        p_purpose,
        v_expires_at,
        v_user_id,
        'Active'
    ) RETURNING id INTO v_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'code', v_code,
        'id', v_id,
        'expires_at', v_expires_at
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO service_role;

COMMIT;
