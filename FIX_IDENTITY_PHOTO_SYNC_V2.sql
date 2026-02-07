-- ==============================================================================
-- MISSION CRITICAL: IDENTITY PHOTO SYNCHRONIZATION PROTOCOL V2
-- ==============================================================================
-- 1. Updates get_all_enquiries_v2 to fetch the LATEST photo from the Admission node
--    if the enquiry has been converted. This resolves the stale photo issue where
--    updates in the Parent Portal (Admissions) weren't reflecting in the School Portal (Enquiries).
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.enquiries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.branch_id,
        e.user_id,
        e.enquiry_code,
        e.applicant_name,
        e.grade,
        e.status,
        e.verification_status,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.notes,
        e.conversion_state,
        e.admission_id,
        e.is_archived,
        e.is_deleted,
        e.received_at,
        e.updated_at,
        e.converted_at,
        -- MASTER FIX: Prioritize Admission (Latest) > Enquiry (Student) > Profile (Parent)
        COALESCE(a.profile_photo_url, e.profile_photo_url, p.profile_photo_url) as profile_photo_url
    FROM public.enquiries e
    LEFT JOIN public.profiles p ON e.user_id = p.id
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    LEFT JOIN public.admissions a ON e.admission_id = a.id
    WHERE 
        (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        AND e.is_deleted = false
        AND (
            sb.school_user_id = auth.uid() 
            OR sb.branch_admin_id = auth.uid()
            OR e.branch_id IS NULL
            -- Allow global access appropriately
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('Super Admin', 'super_admin'))
        )
    ORDER BY e.received_at DESC;
END;
$$;

COMMIT;

SELECT 'SUCCESS: Identity Photo Synchronization Protocol V2 (Live Sync) applied.' as status;
