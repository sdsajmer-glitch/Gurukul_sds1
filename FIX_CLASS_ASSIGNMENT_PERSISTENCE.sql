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

    -- 4. Guardian Auto-Linkage (Enhancement)
    -- This ensures that finalizing enrollment also connects the guardian node
    DECLARE
        v_admission_id UUID;
        v_parent_id UUID;
        v_parent_email TEXT;
        v_parent_name TEXT;
        v_parent_phone TEXT;
    BEGIN
        SELECT admission_id INTO v_admission_id FROM student_profiles WHERE user_id = p_student_id;
        
        IF v_admission_id IS NOT NULL THEN
            SELECT parent_id, parent_email, parent_name, parent_phone 
            INTO v_parent_id, v_parent_email, v_parent_name, v_parent_phone
            FROM admissions WHERE id = v_admission_id;

            -- Try to recover parent_id by email if missing
            IF v_parent_id IS NULL AND v_parent_email IS NOT NULL THEN
                SELECT id INTO v_parent_id FROM profiles WHERE email = v_parent_email LIMIT 1;
            END IF;

            -- Create the link if parent_id is found
            IF v_parent_id IS NOT NULL THEN
                INSERT INTO student_parents (student_id, parent_id, is_primary)
                VALUES (p_student_id, v_parent_id, true)
                ON CONFLICT (student_id, parent_id) DO UPDATE SET is_primary = EXCLUDED.is_primary;
            END IF;

            -- Sync text-based details for immediate fallback view
            IF v_parent_name IS NOT NULL THEN
                UPDATE student_profiles 
                SET parent_guardian_details = COALESCE(v_parent_name || ' (' || COALESCE(v_parent_phone, 'No Phone') || ')', parent_guardian_details)
                WHERE user_id = p_student_id;
            END IF;
        END IF;
    END;

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
