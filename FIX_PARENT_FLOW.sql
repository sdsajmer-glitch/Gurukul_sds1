-- ==============================================================================
-- FIX PARENT SHARE CODE FLOW (Align with Admin Verification)
-- ==============================================================================
-- 1. Creates `generate_admission_share_code` RPC (used by Parent UI) pointing to `admission_share_codes` table.
-- 2. Creates `revoke_my_share_code` RPC (used by Parent UI).
-- 3. Ensures RLS policies allow Parents to read their generated codes.

BEGIN;

-- 1. GENERATE RPC
CREATE OR REPLACE FUNCTION public.generate_admission_share_code(
    p_admission_id uuid, -- This is the Entity ID (Enquiry ID or Admission ID)
    p_purpose text,
    p_code_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code text;
    v_exists boolean;
    v_id bigint;
BEGIN
    -- Loop to ensure uniqueness
    LOOP
        v_code := upper(encode(gen_random_bytes(6), 'hex'));
        SELECT EXISTS(SELECT 1 FROM public.admission_share_codes WHERE code = v_code) INTO v_exists;
        IF NOT v_exists THEN EXIT; END IF;
    END LOOP;

    -- Insert into the CORRECT table 'admission_share_codes'
    INSERT INTO public.admission_share_codes (
        code, 
        admission_id,
        enquiry_id,
        code_type, 
        purpose,
        status,
        created_by,
        expires_at
    )
    VALUES (
        v_code,
        CASE WHEN p_code_type = 'Admission' THEN p_admission_id ELSE NULL END,
        CASE WHEN p_code_type = 'Enquiry' THEN p_admission_id ELSE NULL END, 
        p_code_type,
        p_purpose,
        'Active',
        auth.uid(),
        now() + interval '1 day'
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'success', true,
        'code', v_code,
        'id', v_id
    );
END;
$$;


-- 2. REVOKE RPC
CREATE OR REPLACE FUNCTION public.revoke_my_share_code(p_code_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.admission_share_codes
    SET status = 'Revoked'
    WHERE id = p_code_id AND created_by = auth.uid();
    
    RETURN jsonb_build_object('success', FOUND);
END;
$$;


-- 3. GRANT PERMISSIONS & RLS
GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.revoke_my_share_code(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_share_code(bigint) TO service_role;

-- Ensure RLS allows users to see their own created codes
ALTER TABLE public.admission_share_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own created codes" ON public.admission_share_codes;
CREATE POLICY "Users can view own created codes" 
ON public.admission_share_codes FOR SELECT 
TO authenticated 
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own created codes" ON public.admission_share_codes;
CREATE POLICY "Users can update own created codes" 
ON public.admission_share_codes FOR UPDATE 
TO authenticated 
USING (created_by = auth.uid());

COMMIT;
