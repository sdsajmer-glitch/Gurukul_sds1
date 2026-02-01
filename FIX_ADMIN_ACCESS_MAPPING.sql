-- FIX: Sync Profiles with Branch Admin Entries
-- This script ensures that any user listed as a branch_admin_id in school_branches
-- has the correct role and branch_id in the profiles table.
-- It resolves the "Dashboard Unavailable" issue for admins routed to the Student Dashboard.

BEGIN;

CREATE OR REPLACE FUNCTION public.fix_admin_access_mapping()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r record;
    count_fixed integer := 0;
BEGIN
    -- Iterate over all branches that have an assigned admin
    FOR r IN SELECT * FROM public.school_branches WHERE branch_admin_id IS NOT NULL LOOP
        -- Update the profile if it's not already correct
        UPDATE public.profiles
        SET 
            role = 'School Administration',
            branch_id = r.id,
            profile_completed = true
        WHERE id = r.branch_admin_id
        AND (role IS DISTINCT FROM 'School Administration' OR branch_id IS DISTINCT FROM r.id);
        
        IF FOUND THEN
            count_fixed := count_fixed + 1;
        END IF;
    END LOOP;
    
    RETURN 'Fixed ' || count_fixed || ' admin profiles.';
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.fix_admin_access_mapping() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fix_admin_access_mapping() TO service_role;

-- Run the fix immediately
SELECT public.fix_admin_access_mapping();

COMMIT;
