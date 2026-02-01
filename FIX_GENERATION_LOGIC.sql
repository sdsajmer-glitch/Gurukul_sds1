-- ==============================================================================
-- FIX GENERATION LOGIC (Auto-Correct Entity Type)
-- ==============================================================================
-- 1. Updates `generate_admission_share_code` to automatically detect if the ID belongs to an Enquiry or Admission.
-- 2. Prevents creating "Enquiry" tokens for Admission IDs (which causes "Record not found" errors during verification).

CREATE OR REPLACE FUNCTION public.generate_admission_share_code(
    p_admission_id uuid, -- This is the Entity ID provided by the UI
    p_purpose text,
    p_code_type text -- The requested type (may be incorrect)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code text;
    v_exists boolean;
    v_id bigint;
    v_actual_type text;
BEGIN
    -- 1. IDENTIFY ENTITY TYPE (Source of Truth)
    IF EXISTS (SELECT 1 FROM public.admissions WHERE id = p_admission_id) THEN
        v_actual_type := 'Admission';
    ELSIF EXISTS (SELECT 1 FROM public.enquiries WHERE id = p_admission_id) THEN
        v_actual_type := 'Enquiry';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Target Identity Node not found in registry.');
    END IF;

    -- 2. GENERATE UNIQUE CODE
    LOOP
        v_code := upper(encode(gen_random_bytes(6), 'hex'));
        SELECT EXISTS(SELECT 1 FROM public.admission_share_codes WHERE code = v_code) INTO v_exists;
        IF NOT v_exists THEN EXIT; END IF;
    END LOOP;

    -- 3. INSERT WITH CORRECT TYPE
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
        CASE WHEN v_actual_type = 'Admission' THEN p_admission_id ELSE NULL END,
        CASE WHEN v_actual_type = 'Enquiry' THEN p_admission_id ELSE NULL END, 
        v_actual_type, -- Use detected type, ignoring user mismatch
        p_purpose,
        'Active',
        auth.uid(),
        now() + interval '1 day'
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'success', true,
        'code', v_code,
        'id', v_id,
        'type', v_actual_type
    );
END;
$$;
