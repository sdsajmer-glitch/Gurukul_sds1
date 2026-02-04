-- ==============================================================================
-- FIX SHARE CODE SYSTEM: SCHEMA & RPCs
-- 1. Corrects Table Types (UUID vs BigInt)
-- 2. Adds Missing Columns (created_by)
-- 3. Updates RPCs to match
-- ==============================================================================

BEGIN;

-- 1. Recreate Table with Correct Schema
DROP TABLE IF EXISTS public.admission_share_codes CASCADE;

CREATE TABLE public.admission_share_codes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admission_id uuid, -- Corrected to UUID
    enquiry_id uuid,   -- Corrected to UUID
    code text NOT NULL,
    code_type text NOT NULL,
    purpose text,
    status text DEFAULT 'Active',
    expires_at timestamp with time zone,
    created_by uuid REFERENCES auth.users(id), -- Missing column added
    created_at timestamp with time zone DEFAULT now(),
    redeemed_by uuid REFERENCES auth.users(id),
    redeemed_at timestamp with time zone,
    attempts integer DEFAULT 0,
    locked_until timestamp with time zone
);

ALTER TABLE public.admission_share_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own share codes" ON public.admission_share_codes
    FOR ALL USING (created_by = auth.uid());

-- 2. GENERATE RPC
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
    
    -- Generate Code
    v_code := upper(
        substring(md5(random()::text || clock_timestamp()::text) from 1 for 4) || '-' || 
        substring(md5(random()::text || clock_timestamp()::text) from 5 for 4) || '-' || 
        substring(md5(random()::text || clock_timestamp()::text) from 9 for 4)
    );
    
    v_expires_at := now() + interval '24 hours';
    
    INSERT INTO public.admission_share_codes (
        admission_id, -- Maps to p_admission_id (UUID)
        enquiry_id,   -- Optional, can be same if needed or null
        code,
        code_type,
        purpose,
        expires_at,
        created_by,
        status
    ) VALUES (
        CASE WHEN p_code_type = 'Admission' THEN p_admission_id ELSE NULL END,
        CASE WHEN p_code_type = 'Enquiry' THEN p_admission_id ELSE NULL END, -- Using same ID for enquiry if type matches
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

-- 3. GET RPC
CREATE OR REPLACE FUNCTION public.get_my_share_codes()
RETURNS SETOF public.admission_share_codes
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.admission_share_codes
    WHERE created_by = auth.uid()
    ORDER BY created_at DESC;
$$;

-- 4. REVOKE RPC
CREATE OR REPLACE FUNCTION public.revoke_my_share_code(p_code_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    UPDATE public.admission_share_codes
    SET status = 'Revoked'
    WHERE id = p_code_id AND created_by = v_user_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant Permissions
GRANT ALL ON public.admission_share_codes TO authenticated;
GRANT ALL ON public.admission_share_codes TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_share_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_share_code(bigint) TO authenticated;

COMMIT;
