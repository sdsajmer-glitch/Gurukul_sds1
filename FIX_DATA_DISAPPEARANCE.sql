-- ==============================================================================
-- FIX DATA DISAPPEARANCE ON IMPORT
-- ==============================================================================
-- 1. Updates `admin_import_record_from_share_code` to preventing overwriting
--    valid branch_ids with NULL when importing from a Global Context.
-- 2. Ensures the enquiry/admission remains visible in the desk after verification.

BEGIN;

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
    -- LOGIC FIX: Use COALESCE to only update branch_id if a specific p_branch_id is provided.
    -- If p_branch_id is NULL (Head Office import), we preserve the existing branch_id.
    
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

    -- Deactivate the code (Mark as Redeemed)
    UPDATE public.admission_share_codes
    SET status = 'Redeemed',
        redeemed_at = now(),
        redeemed_by = auth.uid()
    WHERE id = p_code_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_record_from_share_code(uuid, text, bigint, bigint) TO service_role;

COMMIT;
