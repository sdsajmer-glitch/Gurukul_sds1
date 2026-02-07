-- ============================================
-- FIX_GUARDIAN_SYNC.sql
-- ============================================
-- Purpose: Create missing RPC function to fetch linked parent/guardian
-- details for a student in the Student Profile Modal
-- ============================================

BEGIN;

-- Create the missing RPC function to get linked parent for a student
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
    v_found BOOLEAN := false;
BEGIN
    -- Try to find parent through admissions table
    SELECT 
        a.user_id,
        COALESCE(p.display_name, a.parent_name) as parent_name,
        COALESCE(p.email, a.parent_email) as parent_email,
        COALESCE(p.phone, a.parent_phone) as parent_phone,
        pp.relationship_to_student
    INTO 
        v_parent_id,
        v_parent_name,
        v_parent_email,
        v_parent_phone,
        v_relationship
    FROM public.admissions a
    LEFT JOIN public.profiles p ON a.user_id = p.id AND p.role = 'Parent/Guardian'
    LEFT JOIN public.parent_profiles pp ON a.user_id = pp.user_id
    WHERE a.student_user_id = p_student_id
    LIMIT 1;

    -- Check if we found a parent
    IF v_parent_id IS NOT NULL OR v_parent_name IS NOT NULL THEN
        v_found := true;
    END IF;

    -- Return the parent data
    RETURN jsonb_build_object(
        'found', v_found,
        'parent_id', v_parent_id,
        'name', v_parent_name,
        'email', v_parent_email,
        'phone', v_parent_phone,
        'relationship', COALESCE(v_relationship, 'Parent/Guardian')
    );

EXCEPTION WHEN OTHERS THEN
    -- Return empty result on error
    RETURN jsonb_build_object(
        'found', false,
        'parent_id', null,
        'name', null,
        'email', null,
        'phone', null,
        'relationship', null,
        'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_linked_parent_for_student(uuid) TO authenticated;

COMMIT;
