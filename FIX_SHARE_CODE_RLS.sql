-- ==============================================================================
-- FIX: SHARE CODE RLS & TRIGGER SECURITY
-- ==============================================================================
-- This resolves the "new row violates row-level security policy" error 
-- during child registration/enrollment initialization.

BEGIN;

-- 1. Redefine the trigger function with SECURITY DEFINER
-- This allows the system to generate codes even if the user lacks direct INSERT permissions.
CREATE OR REPLACE FUNCTION public.fn_auto_generate_share_code()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code text;
    v_exists boolean;
    v_user_id uuid;
BEGIN
    -- Capturing the initiating user's ID
    v_user_id := auth.uid();

    LOOP
        -- Generate 6-byte HEX code (12 chars)
        v_code := upper(encode(gen_random_bytes(6), 'hex'));
        
        -- Check uniqueness
        SELECT EXISTS(SELECT 1 FROM public.admission_share_codes WHERE code = v_code) INTO v_exists;
        IF NOT v_exists THEN
            EXIT;
        END IF;
    END LOOP;

    -- Insert into the share codes table with ownership mapping
    IF TG_TABLE_NAME = 'enquiries' THEN
        INSERT INTO public.admission_share_codes (
            code, enquiry_id, code_type, purpose, created_by, status
        )
        VALUES (
            v_code, NEW.id, 'Enquiry', 'Identity Handshake', v_user_id, 'Active'
        );
    ELSIF TG_TABLE_NAME = 'admissions' THEN
        INSERT INTO public.admission_share_codes (
            code, admission_id, code_type, purpose, created_by, status
        )
        VALUES (
            v_code, NEW.id, 'Admission', 'Enrollment Protocol', v_user_id, 'Active'
        );
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Ensure RLS policies are robust for Parents
-- Even though the trigger handles insertion, we must ensure policies permit the resulting row.
ALTER TABLE public.admission_share_codes ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own codes (Needed for MyChildrenTab and ShareCodesTab)
DROP POLICY IF EXISTS "Users can view own created codes" ON public.admission_share_codes;
CREATE POLICY "Users can view own created codes" 
ON public.admission_share_codes FOR SELECT 
TO authenticated 
USING (
    created_by = auth.uid() 
    OR 
    admission_id IN (SELECT id FROM public.admissions WHERE parent_id = auth.uid())
    OR
    enquiry_id IN (SELECT id FROM public.enquiries WHERE user_id = auth.uid())
);

-- Allow users to update their own codes (e.g., Revoke)
DROP POLICY IF EXISTS "Users can update own created codes" ON public.admission_share_codes;
CREATE POLICY "Users can update own created codes" 
ON public.admission_share_codes FOR UPDATE 
TO authenticated 
USING (created_by = auth.uid());

-- 3. Explicit INSERT policy (Safety net for direct RPC calls like 'generate_admission_share_code')
DROP POLICY IF EXISTS "Users can insert own codes" ON public.admission_share_codes;
CREATE POLICY "Users can insert own codes" 
ON public.admission_share_codes FOR INSERT 
TO authenticated 
WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

COMMIT;
