-- ============================================================================
-- MASTER SYNC PROTOCOL: Parent-Student Data Identity Synchronization
-- ============================================================================

-- 1. Enhanced get_linked_parent_for_student (Version 5.2 - Ultra-Robust Recovery)
-- Handles prioritized recovery from profiles, admissions, and enquiries.
CREATE OR REPLACE FUNCTION public.get_linked_parent_for_student(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_parent_id UUID;
    v_admission_record RECORD;
    v_enquiry_record RECORD;
    v_parent_profile RECORD;
    v_user_profile RECORD;
    v_source TEXT;
    v_raw_name TEXT;
    v_raw_email TEXT;
    v_raw_phone TEXT;
    v_heal_success BOOLEAN := false;
    v_admission_id BIGINT;
BEGIN
    -- 1. PRE-FETCH DATA FROM ADMISSIONS (Most reliable source for names during onboarding)
    SELECT admission_id INTO v_admission_id
    FROM public.student_profiles
    WHERE user_id = p_student_id;

    SELECT * INTO v_admission_record
    FROM public.admissions
    WHERE student_user_id = p_student_id
       OR (v_admission_id IS NOT NULL AND id = v_admission_id)
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        v_raw_name := v_admission_record.parent_name;
        v_raw_email := v_admission_record.parent_email;
        v_raw_phone := v_admission_record.parent_phone;
        v_parent_id := v_admission_record.parent_id;
        v_source := 'admission';
    ELSE
        -- Fallback to Enquiry
        SELECT * INTO v_enquiry_record
        FROM public.enquiries
        WHERE user_id = p_student_id
        ORDER BY updated_at DESC
        LIMIT 1;

        IF FOUND THEN
            v_raw_name := v_enquiry_record.parent_name;
            v_raw_email := v_enquiry_record.parent_email;
            v_raw_phone := v_enquiry_record.parent_phone;
            v_source := 'enquiry';
        END IF;
    END IF;

    -- 2. CHECK EXPLICIT LINKAGE (student_parents overrides admission.parent_id)
    SELECT parent_id INTO v_parent_id
    FROM public.student_parents
    WHERE student_id = p_student_id
    ORDER BY is_primary DESC, id DESC
    LIMIT 1;

    IF v_parent_id IS NOT NULL THEN
        v_source := 'student_parents';
    END IF;

    -- 3. SELF-HEALING: If no parent_id but we have email, try to link now
    IF v_parent_id IS NULL AND v_raw_email IS NOT NULL THEN
        SELECT id INTO v_parent_id
        FROM public.profiles
        WHERE lower(email) = lower(v_raw_email)
        AND role IN ('Parent/Guardian', 'Parent')
        LIMIT 1;

        IF v_parent_id IS NOT NULL THEN 
            v_heal_success := true;
            -- Update admission if applicable
            IF v_admission_record IS NOT NULL AND v_admission_record.parent_id IS NULL THEN
                 UPDATE public.admissions SET parent_id = v_parent_id WHERE id = v_admission_record.id;
            END IF;
            -- Check if link needs to be created in student_parents
            INSERT INTO public.student_parents (student_id, parent_id, is_primary)
            VALUES (p_student_id, v_parent_id, true)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- 4. FETCH FINAL PROFILE DETAILS
    IF v_parent_id IS NOT NULL THEN
        SELECT * INTO v_parent_profile 
        FROM public.parent_profiles 
        WHERE user_id = v_parent_id;
        
        SELECT * INTO v_user_profile 
        FROM public.profiles 
        WHERE id = v_parent_id;
        
        RETURN jsonb_build_object(
            'found', true,
            'source', v_source,
            'healed', v_heal_success,
            'name', COALESCE(NULLIF(v_user_profile.display_name, ''), NULLIF(v_raw_name, ''), 'Guardian Profile'),
            'email', COALESCE(NULLIF(v_user_profile.email, ''), NULLIF(v_raw_email, '')),
            'phone', COALESCE(NULLIF(v_user_profile.phone, ''), NULLIF(v_raw_phone, '')),
            'relationship', COALESCE(NULLIF(v_parent_profile.relationship_to_student, ''), 'Parent'),
            'address', COALESCE(NULLIF(v_parent_profile.address, ''), v_admission_record.address),
            'city', COALESCE(NULLIF(v_parent_profile.city, ''), v_admission_record.city),
            'state', COALESCE(NULLIF(v_parent_profile.state, ''), v_admission_record.state),
            'country', COALESCE(NULLIF(v_parent_profile.country, ''), v_admission_record.country),
            'pin_code', COALESCE(NULLIF(v_parent_profile.pin_code, ''), v_admission_record.pin_code),
            'parent_id', v_parent_id,
            'secondary_parent_name', v_parent_profile.secondary_parent_name,
            'secondary_parent_email', v_parent_profile.secondary_parent_email,
            'secondary_parent_phone', v_parent_profile.secondary_parent_phone,
            'secondary_parent_relationship', v_parent_profile.secondary_parent_relationship
        );
    END IF;

    -- 5. UNLINKED FALLBACK (Raw details only)
    IF v_raw_name IS NOT NULL OR v_raw_phone IS NOT NULL THEN
        RETURN jsonb_build_object(
            'found', true,
            'source', v_source,
            'is_unlinked', true,
            'name', COALESCE(v_raw_name, 'Parent (Unlinked)'),
            'email', v_raw_email,
            'phone', v_raw_phone,
            'relationship', 'Parent',
            'address', v_admission_record.address,
            'city', v_admission_record.city,
            'state', v_admission_record.state,
            'country', v_admission_record.country,
            'pin_code', v_admission_record.pin_code,
            'parent_id', NULL
        );
    END IF;

    -- No record found at all
    RETURN jsonb_build_object('found', false, 'reason', 'No linkage found');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('found', false, 'error', SQLERRM);
END;
$function$;

-- 2. Robust update_student_details_admin (Supports partial and full synchronization)
CREATE OR REPLACE FUNCTION public.update_student_details_admin(
    p_student_id uuid, 
    p_display_name text DEFAULT NULL, 
    p_phone text DEFAULT NULL, 
    p_dob date DEFAULT NULL, 
    p_gender text DEFAULT NULL, 
    p_address text DEFAULT NULL, 
    p_parent_details text DEFAULT NULL, 
    p_student_id_number text DEFAULT NULL, 
    p_grade text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ 
BEGIN 
    -- Atomically update master profile if parameters provided
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
        grade = COALESCE(p_grade, grade) 
    WHERE user_id = p_student_id; 
END; 
$function$;

GRANT EXECUTE ON FUNCTION public.get_linked_parent_for_student TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_student_details_admin TO authenticated, service_role;
