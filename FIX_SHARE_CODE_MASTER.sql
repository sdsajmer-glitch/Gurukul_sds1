-- ==============================================================================
-- FIX SHARE CODE: MASTER PATCH
-- ==============================================================================
-- 1. Updates `get_my_share_codes` to RETURN applicant_name by joining tables.
-- 2. Updates `get_all_enquiries_v2` and `get_admissions_v2` for robust fetching.
-- 3. Updates `admin_import_record_from_share_code` to preserve branch_id.
-- 4. Ensures `admin_verify_share_code` works with or without dashes.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. FIX REGISTRY LEDGER FETCH (Resolves "Parent Registry Ledger Empty")
-- -----------------------------------------------------------------------------
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
        asc_code.admission_id, -- Keep as raw UUID
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

GRANT EXECUTE ON FUNCTION public.get_my_share_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_share_codes() TO service_role;


-- -----------------------------------------------------------------------------
-- 2. FIX SCHOOL ADMIN IMPORT (Resolves "Verified but Data Vanished")
-- -----------------------------------------------------------------------------
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
BEGIN
    -- Only update branch_id if p_branch_id is NOT NULL.
    -- If p_branch_id is NULL, we assume Global View and DO NOT change the branch.
    
    IF p_code_type = 'Enquiry' THEN
        UPDATE public.enquiries
        SET 
            branch_id = COALESCE(p_branch_id, branch_id),
            status = 'ENQUIRY_VERIFIED',
            verification_status = 'VERIFIED'
        WHERE id = p_admission_id;
        
    ELSIF p_code_type = 'Admission' THEN
        UPDATE public.admissions
        SET 
            branch_id = COALESCE(CAST(p_branch_id AS integer), branch_id),
            status = 'Verified'
        WHERE id = p_admission_id;
    END IF;

    -- Deactivate the code
    UPDATE public.admission_share_codes
    SET status = 'Redeemed',
        redeemed_at = now(),
        redeemed_by = auth.uid()
    WHERE id = p_code_id;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. FIX FETCHING IN DESK/VAULT (Resolves "Fetch Failure")
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.enquiries
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT e.*
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE 
        (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        AND e.is_deleted = false
        AND (
            -- Safety: If branch is null, show only if user is super admin or similar (adjust logic as needed)
            -- Or if specific branch is requested, ensure access.
            -- Simplified for now: relying on RLS of underlying table mostly, but adding basic join check
            sb.school_user_id = auth.uid() 
            OR sb.branch_admin_id = auth.uid()
            OR e.branch_id IS NULL -- Allow unassigned if any
        )
    ORDER BY e.received_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admissions_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.admissions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT a.*
    FROM public.admissions a
    LEFT JOIN public.school_branches sb ON a.branch_id = sb.id
    WHERE 
        (p_branch_id IS NULL OR a.branch_id = p_branch_id)
        AND (
            sb.school_user_id = auth.uid() 
            OR sb.branch_admin_id = auth.uid()
            OR a.branch_id IS NULL
        )
    ORDER BY a.submitted_at DESC;
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. FIX VERIFICATION (Resolves "Invalid Token" for formatted codes)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_verify_share_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code_record record;
    v_applicant_name text;
    v_grade text;
    v_entity_id uuid;
    v_normalized_input text;
BEGIN
    v_normalized_input := upper(regexp_replace(p_code, '[\s-]+', '', 'g'));

    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(regexp_replace(code, '[\s-]+', '', 'g')) = v_normalized_input
      AND status = 'Active'
      AND expires_at > now();

    IF v_code_record IS NULL THEN
        RETURN jsonb_build_object('found', false, 'error', 'Invalid or expired protocol token.');
    END IF;

    IF v_code_record.code_type = 'Enquiry' THEN
        SELECT applicant_name, grade, id INTO v_applicant_name, v_grade, v_entity_id
        FROM public.enquiries WHERE id = v_code_record.enquiry_id;
    ELSIF v_code_record.code_type = 'Admission' THEN
        SELECT applicant_name, grade, id INTO v_applicant_name, v_grade, v_entity_id
        FROM public.admissions WHERE id = v_code_record.admission_id;
    END IF;

    IF v_applicant_name IS NULL THEN v_applicant_name := 'Unknown Applicant'; END IF;

    RETURN jsonb_build_object(
        'found', true,
        'id', v_code_record.id,
        'code_type', v_code_record.code_type,
        'applicant_name', v_applicant_name,
        'grade', v_grade,
        'admission_id', v_entity_id 
    );
END;
$$;

COMMIT;
