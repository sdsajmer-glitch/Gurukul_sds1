-- ==============================================================================
-- FIX UPDATE STUDENT DETAILS RPC
-- ==============================================================================
-- Resolves issue where "update_student_details_admin" failed because 
-- "p_enrollment_status" parameter was missing in the function signature,
-- triggering a "function does not exist" error when called from the UI.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.update_student_details_admin(uuid, text, text, date, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_student_details_admin(
    p_student_id uuid,
    p_display_name text DEFAULT NULL,
    p_phone text DEFAULT NULL,
    p_dob date DEFAULT NULL,
    p_gender text DEFAULT NULL,
    p_address text DEFAULT NULL,
    p_parent_details text DEFAULT NULL,
    p_student_id_number text DEFAULT NULL,
    p_grade text DEFAULT NULL,
    p_enrollment_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Atomically update master profile if parameters provided
    -- Only update if values are not null to avoid overwriting with defaults if called partially
    -- (Though RPC sends nulls for fields not in payload? No, usually arguments are named)
    -- The TS code sends explicit nulls or values.
    
    UPDATE public.profiles
    SET
        display_name = COALESCE(p_display_name, display_name),
        phone = COALESCE(p_phone, phone)
    WHERE id = p_student_id;

    -- Atomically update academic/residential registry
    UPDATE public.student_profiles
    SET
        date_of_birth = COALESCE(p_dob, date_of_birth),
        gender = COALESCE(p_gender, gender),
        address = COALESCE(p_address, address),
        parent_guardian_details = COALESCE(p_parent_details, parent_guardian_details),
        student_id_number = COALESCE(p_student_id_number, student_id_number),
        grade = COALESCE(p_grade, grade),
        enrollment_status = COALESCE(p_enrollment_status, enrollment_status)
    WHERE user_id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_details_admin(uuid, text, text, date, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_student_details_admin(uuid, text, text, date, text, text, text, text, text, text) TO service_role;
