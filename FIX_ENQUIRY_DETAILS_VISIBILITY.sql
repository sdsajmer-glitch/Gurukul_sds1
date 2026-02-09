-- ==============================================================================
-- FIX ENQUIRY DETAILS VISIBILITY
-- ==============================================================================
-- Updates get_all_enquiries_v2 to intelligently resolve parent details 
-- from linked Admissions or Profiles when missing in the Enquiries table.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id bigint DEFAULT NULL)
RETURNS SETOF public.enquiries
LANGUAGE plpgsql
SECURITY DEFINER
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
        -- Resolve Parent Name
        COALESCE(
            e.parent_name, 
            a.parent_name, 
            CASE WHEN p.role IN ('Parent', 'Parent/Guardian') THEN p.display_name ELSE NULL END
        ) as parent_name,
        -- Resolve Parent Email
        COALESCE(
            e.parent_email, 
            a.parent_email, 
            CASE WHEN p.role IN ('Parent', 'Parent/Guardian') THEN p.email ELSE NULL END
        ) as parent_email,
        -- Resolve Parent Phone
        COALESCE(
            e.parent_phone, 
            a.parent_phone, 
            CASE WHEN p.role IN ('Parent', 'Parent/Guardian') THEN p.phone ELSE NULL END
        ) as parent_phone,
        e.notes,
        e.conversion_state,
        e.admission_id,
        e.is_archived,
        e.is_deleted,
        e.received_at,
        e.updated_at,
        e.converted_at,
        e.profile_photo_url
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    LEFT JOIN public.admissions a ON e.admission_id = a.id
    LEFT JOIN public.profiles p ON e.user_id = p.id
    WHERE 
        (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        AND
        (
            -- Access Control: Auth user must be school owner or branch admin
            sb.school_user_id = auth.uid() 
            OR
            sb.branch_admin_id = auth.uid()
            -- Also allow if user is super admin? (Context dependent, keeping safe default)
        )
        AND e.is_deleted = false
    ORDER BY e.received_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_enquiries_v2(bigint) TO service_role;
