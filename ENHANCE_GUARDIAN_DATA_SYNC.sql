-- ==============================================================================
-- ENHANCEMENT: Guardian Data Sync & Secondary Support
-- Description: Updates get_linked_parent_for_student RPC to return secondary 
--              guardian fields and ensures profile synchronization.
-- ==============================================================================

BEGIN;

-- 1. Create or Replace Enhanced RPC to fetch both Primary & Secondary Guardian Data
CREATE OR REPLACE FUNCTION public.get_linked_parent_for_student(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_parent_id UUID;
    v_parent_name TEXT;
    v_parent_email TEXT;
    v_parent_phone TEXT;
    v_relationship TEXT;
    v_address TEXT;
    v_city TEXT;
    v_state TEXT;
    v_pin_code TEXT;
    v_country TEXT;
    -- Secondary Fields
    v_sec_name TEXT;
    v_sec_email TEXT;
    v_sec_phone TEXT;
    v_sec_relationship TEXT;
    v_found BOOLEAN := false;
BEGIN
    -- Try to find parent through admissions table link
    SELECT 
        a.parent_id,
        COALESCE(p.display_name, a.parent_name) as parent_name,
        COALESCE(p.email, a.parent_email) as parent_email,
        COALESCE(p.phone, a.parent_phone) as parent_phone,
        pp.relationship_to_student,
        COALESCE(pp.address, a.address) as address,
        pp.city,
        pp.state,
        pp.pin_code,
        pp.country,
        pp.secondary_parent_name,
        pp.secondary_parent_email,
        pp.secondary_parent_phone,
        pp.secondary_parent_relationship
    INTO 
        v_parent_id,
        v_parent_name,
        v_parent_email,
        v_parent_phone,
        v_relationship,
        v_address,
        v_city,
        v_state,
        v_pin_code,
        v_country,
        v_sec_name,
        v_sec_email,
        v_sec_phone,
        v_sec_relationship
    FROM public.student_profiles sp
    JOIN public.admissions a ON sp.admission_id = a.id
    LEFT JOIN public.profiles p ON a.parent_id = p.id
    LEFT JOIN public.parent_profiles pp ON a.parent_id = pp.user_id
    WHERE sp.user_id = p_student_id
    LIMIT 1;

    -- If not found via admission id, try direct admission query
    IF v_parent_id IS NULL AND v_parent_name IS NULL THEN
        SELECT 
            id as admission_id,
            parent_id,
            parent_name,
            parent_email,
            parent_phone
        INTO 
            v_parent_id, v_parent_name, v_parent_email, v_parent_phone
        FROM public.admissions
        WHERE student_user_id = p_student_id
        LIMIT 1;
    END IF;

    -- Check if we found any valid link
    IF v_parent_id IS NOT NULL OR v_parent_name IS NOT NULL THEN
        v_found := true;
    END IF;

    -- Return the comprehensive combined payload
    RETURN jsonb_build_object(
        'found', v_found,
        'parent_id', v_parent_id,
        'name', v_parent_name,
        'email', v_parent_email,
        'phone', v_parent_phone,
        'relationship', COALESCE(v_relationship, 'Parent/Guardian'),
        'address', v_address,
        'city', v_city,
        'state', v_state,
        'pin_code', v_pin_code,
        'country', v_country,
        'secondary_parent_name', v_sec_name,
        'secondary_parent_email', v_sec_email,
        'secondary_parent_phone', v_sec_phone,
        'secondary_parent_relationship', v_sec_relationship
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'found', false,
        'error', SQLERRM
    );
END;
$$;

-- 2. Permissions
GRANT EXECUTE ON FUNCTION public.get_linked_parent_for_student(uuid) TO authenticated;

COMMIT;
