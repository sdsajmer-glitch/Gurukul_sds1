-- Re-define the class assignment RPC to ensure persistence and reliability
-- This function updates the student_profiles table directly and handles potential errors

CREATE OR REPLACE FUNCTION admin_assign_student_class(
    p_student_id UUID,
    p_class_id BIGINT,
    p_branch_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to bypass RLS issues during assignment
SET search_path = public
AS $$
DECLARE
    v_class_name TEXT;
    v_profile_exists BOOLEAN;
BEGIN
    -- 1. Validate Class and get Name
    SELECT name INTO v_class_name FROM school_classes WHERE id = p_class_id;
    
    IF v_class_name IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Selected class section does not exist.'
        );
    END IF;

    -- 2. Check if profile exists
    SELECT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = p_student_id) INTO v_profile_exists;
    
    IF NOT v_profile_exists THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Student profile not found. Cannot assign class.'
        );
    END IF;

    -- 3. Perform the Update
    -- We update ALL profiles linked to this user_id to ensure consistency if duplicates exist
    UPDATE student_profiles
    SET 
        assigned_class_id = p_class_id,
        updated_at = NOW()
    WHERE user_id = p_student_id;

    -- 4. Log the action (Optional, good for audit)
    -- INSERT INTO audit_logs ...

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Class assigned successfully.',
        'class_name', v_class_name,
        'class_id', p_class_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'message', 'Database Error: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (admins)
GRANT EXECUTE ON FUNCTION admin_assign_student_class(UUID, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_assign_student_class(UUID, BIGINT, BIGINT) TO service_role;
