-- ==============================================================================
-- FIX FULL FLOW FINAL: Verification -> Import -> Visibility
-- ==============================================================================
-- This script contains ALL necessary functions for the verification flow.
-- Run this ONCE to fix the entire pipeline.

BEGIN;

-- 1. FIX VERIFICATION RPC (Checks Type, ID, and returns Metadata)
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
    -- Normalize input: Remove whitespace AND dashes, uppercase
    v_normalized_input := upper(regexp_replace(p_code, '[\s-]+', '', 'g'));

    -- Find the code
    SELECT * INTO v_code_record
    FROM public.admission_share_codes
    WHERE upper(regexp_replace(code, '[\s-]+', '', 'g')) = v_normalized_input
      AND status = 'Active'
      AND expires_at > now();

    IF v_code_record IS NULL THEN
        RETURN jsonb_build_object('found', false, 'error', 'Invalid or expired protocol token.');
    END IF;

    -- Fetch details based on type
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
        'admission_id', v_entity_id -- This is the KEY for import function
    );
END;
$$;


-- 2. FIX IMPORT RPC (Redeems Code & Links Branch)
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
    -- Handle missing branch ID (from Global View)
    v_target_branch_id := p_branch_id;

    IF v_target_branch_id IS NULL THEN
        -- Assign to Admin's Main Branch
        SELECT id INTO v_target_branch_id 
        FROM public.school_branches 
        WHERE school_user_id = auth.uid() AND is_main_branch = true 
        LIMIT 1;

        -- Fallback
        IF v_target_branch_id IS NULL THEN
            SELECT id INTO v_target_branch_id 
            FROM public.school_branches 
            WHERE school_user_id = auth.uid() 
            LIMIT 1;
        END IF;
    END IF;

    -- Update Record
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

    -- Redeem Code
    UPDATE public.admission_share_codes
    SET status = 'Redeemed',
        redeemed_at = now(),
        redeemed_by = auth.uid()
    WHERE id = p_code_id;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 3. FIX FETCH ENQUIRIES (Ensure Visibility)
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
        e.is_deleted = false
        AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        AND (
            -- Access Logic: Owner, Branch Admin, or Unassigned (if allowed)
            sb.school_user_id = auth.uid() 
            OR sb.branch_admin_id = auth.uid()
            OR e.branch_id IS NULL -- Show unassigned enquiries freely
            OR EXISTS (SELECT 1 FROM public.school_branches WHERE school_user_id = auth.uid()) -- Super Admin sees all
        )
    ORDER BY e.received_at DESC;
END;
$$;


-- 4. FIX FETCH ADMISSIONS (Ensure Visibility)
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
            OR EXISTS (SELECT 1 FROM public.school_branches WHERE school_user_id = auth.uid())
        )
    ORDER BY a.submitted_at DESC;
END;
$$;


-- 5. FIX PARENT REGISTRY (Fetch Names)
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

GRANT EXECUTE ON FUNCTION public.admin_verify_share_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_share_code(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admissions_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admissions_v2(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_share_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_share_codes() TO service_role;

COMMIT;
