-- ============================================
-- ENHANCEMENT: Add Secondary Parent fields to Enquiries
-- ============================================

-- 1. Add new columns to enquiries table
ALTER TABLE public.enquiries
ADD COLUMN IF NOT EXISTS secondary_parent_name text,
ADD COLUMN IF NOT EXISTS secondary_parent_phone text,
ADD COLUMN IF NOT EXISTS secondary_parent_email text;

-- 2. Update the fetch function get_all_enquiries_v3 to include these fields
DROP FUNCTION IF EXISTS public.get_all_enquiries_v3(bigint);

CREATE OR REPLACE FUNCTION public.get_all_enquiries_v3(p_branch_id BIGINT)
RETURNS TABLE (
    id UUID,
    applicant_name TEXT,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    secondary_parent_name TEXT,
    secondary_parent_phone TEXT,
    secondary_parent_email TEXT,
    grade TEXT,
    status TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    branch_id BIGINT,
    profile_photo_url TEXT,
    source TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.applicant_name,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.secondary_parent_name,
        e.secondary_parent_phone,
        e.secondary_parent_email,
        e.grade,
        e.status::TEXT,
        e.notes,
        e.updated_at,
        e.created_at,
        e.branch_id,
        e.profile_photo_url,
        e.source
    FROM enquiries e
    WHERE (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    ORDER BY e.created_at DESC;
END;
$$;
