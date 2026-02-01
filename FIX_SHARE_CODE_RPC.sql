-- Fix Share Code RPC and Schema mismatch (BigInt vs UUID)

-- 1. Re-create share_codes table with correct Schema (UUID for admission_id)
-- dropping first to handle type change cleanly
DROP TABLE IF EXISTS public.share_codes CASCADE;

CREATE TABLE public.share_codes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admission_id uuid NOT NULL, -- Matched to admissions.id (UUID)
    code text NOT NULL,
    code_type text NOT NULL,
    purpose text,
    status text DEFAULT 'Active',
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.share_codes ENABLE ROW LEVEL SECURITY;
-- Add RLS policy for owner
CREATE POLICY "Users can view/edit own share codes" ON public.share_codes
    FOR ALL USING (created_by = auth.uid());


-- 2. Drop the incorrect function signature if it exists
DROP FUNCTION IF EXISTS public.generate_admission_share_code(bigint, text, text);

-- 3. Create the correct function with UUID parameter
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
    v_share_code_id bigint;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    -- Generate Code (XXXX-XXXX-XXXX)
    v_code := upper(
        substring(md5(random()::text || clock_timestamp()::text) from 1 for 4) || '-' || 
        substring(md5(random()::text || clock_timestamp()::text) from 5 for 4) || '-' || 
        substring(md5(random()::text || clock_timestamp()::text) from 9 for 4)
    );
    
    -- Set expiration (24 hours)
    v_expires_at := now() + interval '24 hours';
    
    -- Insert into share_codes table
    INSERT INTO public.share_codes (
        admission_id,
        code,
        code_type,
        purpose,
        expires_at,
        created_by,
        status
    ) VALUES (
        p_admission_id,
        v_code,
        p_code_type,
        p_purpose,
        v_expires_at,
        v_user_id,
        'Active'
    ) RETURNING id INTO v_share_code_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'code', v_code,
        'id', v_share_code_id,
        'expires_at', v_expires_at
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO service_role;

-- 4. Re-create Revoke function
CREATE OR REPLACE FUNCTION public.revoke_my_share_code(p_code_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_rows_affected int;
BEGIN
    v_user_id := auth.uid();
    
    UPDATE public.share_codes
    SET status = 'Revoked'
    WHERE id = p_code_id AND created_by = v_user_id;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    
    IF v_rows_affected > 0 THEN
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Code not found or access denied');
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_my_share_code(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_share_code(bigint) TO service_role;
