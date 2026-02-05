-- ==============================================================================
-- FINAL INTEGRATED FIX: SHARE CODES & DATA VISIBILITY & PROTOCOLS
-- ==============================================================================
-- This script resolves 3 critical issues:
-- 1. "Verified but Data Missing": Automatically assigns students to the Admin's Main Branch if no branch is selected.
-- 2. "Protocol Error": Replaces generation logic to avoid 'ON CONFLICT' errors.
-- 3. "Parent Registry Empty": Joins with Enquiries/Admissions to fetch student names.

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. FIX GENERATION (Avoid ON CONFLICT)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.generate_admission_share_code(uuid, text, text);

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
    v_id bigint;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    -- Generate standard 12-char clean hex
    v_code := upper(encode(gen_random_bytes(6), 'hex'));
    
    WHILE EXISTS (SELECT 1 FROM public.admission_share_codes WHERE code = v_code) LOOP
        v_code := upper(encode(gen_random_bytes(6), 'hex'));
    END LOOP;
    
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
        now() + interval '24 hours',
        v_user_id,
        'Active'
    ) RETURNING id INTO v_id;
    
    RETURN jsonb_build_object('success', true, 'code', v_code);
END;
$$;


-- ------------------------------------------------------------------------------
-- 2. FIX VISIBILITY & IMPORT (Force Branch Assignment)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_import_record_from_share_code(
    p_admission_id uuid,
    p_code_type text,
    p_branch_id bigint,
    p_code_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_branch_id bigint;
BEGIN
    -- LOGIC: If p_branch_id is missing (Global Admin View), find the Admin's MAIN branch.
    -- This prevents records from becoming 'ghosts' with NULL branch_id.
    v_target_branch_id := p_branch_id;

    IF v_target_branch_id IS NULL THEN
        -- Try to find the Main Branch for this user
        SELECT id INTO v_target_branch_id 
        FROM public.school_branches 
        WHERE school_user_id = auth.uid() AND is_main_branch = true 
        LIMIT 1;

        -- Fallback: Any branch owned by them
        IF v_target_branch_id IS NULL THEN
            SELECT id INTO v_target_branch_id 
            FROM public.school_branches 
            WHERE school_user_id = auth.uid() 
            LIMIT 1;
        END IF;
    END IF;

    -- Update the record with the target branch (keep existing if still null, though rare)
    IF p_code_type = 'Enquiry' THEN
        UPDATE public.enquiries
        SET 
            branch_id = COALESCE(v_target_branch_id, branch_id),
            status = 'ENQUIRY_VERIFIED',
            verification_status = 'VERIFIED'
        WHERE id = p_admission_id;
        
    ELSIF p_code_type = 'Admission' THEN
        UPDATE public.admissions
        SET 
            branch_id = COALESCE(CAST(v_target_branch_id AS integer), branch_id),
            status = 'Verified'
        WHERE id = p_admission_id;
    END IF;

    -- Mark code as redeemed
    UPDATE public.admission_share_codes
    SET status = 'Redeemed',
        redeemed_at = now(),
        redeemed_by = auth.uid()
    WHERE id = p_code_id;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. FIX PARENT REGISTRY (Fetch Names)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_share_codes();

CREATE OR REPLACE FUNCTION public.get_my_share_codes()
RETURNS TABLE (
    id bigint,
    code text,
    admission_id uuid,
    applicant_name text,
    status text,
    code_type text,
    purpose text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        asc_code.id,
        asc_code.code,
        asc_code.admission_id,
        COALESCE(e.applicant_name, a.applicant_name, 'Unknown Identity') as applicant_name,
        asc_code.status,
        asc_code.code_type,
        asc_code.purpose,
        asc_code.expires_at,
        asc_code.created_at
    FROM public.admission_share_codes asc_code
    LEFT JOIN public.enquiries e ON asc_code.enquiry_id = e.id
    LEFT JOIN public.admissions a ON asc_code.admission_id = a.id
    WHERE asc_code.created_by = auth.uid()
    ORDER BY asc_code.created_at DESC;
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_admission_share_code(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_share_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_share_codes() TO service_role;

COMMIT;
