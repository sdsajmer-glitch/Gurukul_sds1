-- ==============================================================================
-- FIX: Parent Data Sync V3 (Enhanced with admission_id lookup)
-- Description: Improves `get_linked_parent_for_student` to check `student_parents`
--              table first, then Admissions (via user_id OR admission_id), then Enquiries.
-- ==============================================================================

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
    -- 0. Check student_parents table (Explicit Link - Highest Priority)
    SELECT parent_id INTO v_parent_id
    FROM public.student_parents
    WHERE student_id = p_student_id
    ORDER BY is_primary DESC, id DESC
    LIMIT 1;

    IF v_parent_id IS NOT NULL THEN
        v_source := 'student_parents';
    ELSE
        -- Helper: Get admission_id from student_profiles if available
        SELECT admission_id INTO v_admission_id
        FROM public.student_profiles
        WHERE user_id = p_student_id;

        -- 1. Try to find Admission Record (Secondary Source)
        -- Check by student_user_id OR by admission_id linkage
        SELECT * INTO v_admission_record
        FROM public.admissions
        WHERE student_user_id = p_student_id
           OR (v_admission_id IS NOT NULL AND id = v_admission_id)
        ORDER BY created_at DESC
        LIMIT 1;

        IF FOUND THEN
            v_source := 'admission';
            v_parent_id := v_admission_record.parent_id;
            v_raw_name := v_admission_record.parent_name;
            v_raw_email := v_admission_record.parent_email;
            v_raw_phone := v_admission_record.parent_phone;
        ELSE
            -- 2. If not found, try Enquiry Record (Tertiary Source)
            SELECT * INTO v_enquiry_record
            FROM public.enquiries
            WHERE user_id = p_student_id
            ORDER BY updated_at DESC
            LIMIT 1;

            IF FOUND THEN
                v_source := 'enquiry';
                v_parent_id := NULL; 
                v_raw_name := v_enquiry_record.parent_name;
                v_raw_email := v_enquiry_record.parent_email;
                v_raw_phone := v_enquiry_record.parent_phone;
            ELSE
                -- No record found at all
                RETURN jsonb_build_object('found', false, 'reason', 'No linkage found');
            END IF;
        END IF;

        -- 3. Self-Healing / Lookup by Email (if parent_id is missing but we have email)
        IF v_parent_id IS NULL AND v_raw_email IS NOT NULL THEN
            SELECT id INTO v_parent_id
            FROM public.profiles
            WHERE lower(email) = lower(v_raw_email)
            AND role IN ('Parent/Guardian', 'Parent')
            LIMIT 1;

            IF v_parent_id IS NOT NULL THEN 
                v_heal_success := true;
                -- Optional: Auto-link to admission if applicable
                IF v_source = 'admission' THEN
                     UPDATE public.admissions SET parent_id = v_parent_id WHERE id = v_admission_record.id;
                END IF;
            END IF;
        END IF;
    END IF;

    -- 4. Fetch Parent Profile Details if linked
    IF v_parent_id IS NOT NULL THEN
        SELECT * INTO v_parent_profile 
        FROM public.parent_profiles 
        WHERE user_id = v_parent_id;
        
        SELECT * INTO v_user_profile 
        FROM public.profiles 
        WHERE id = v_parent_id;
        
        IF FOUND THEN
             RETURN jsonb_build_object(
                'found', true,
                'source', v_source,
                'healed', v_heal_success,
                'name', COALESCE(v_user_profile.display_name, v_raw_name),
                'email', COALESCE(v_user_profile.email, v_raw_email),
                'phone', COALESCE(v_user_profile.phone, v_raw_phone),
                'relationship', COALESCE(v_parent_profile.relationship_to_student, 'Parent'),
                'address', COALESCE(v_parent_profile.address, CASE WHEN v_source = 'admission' THEN v_admission_record.address ELSE NULL END),
                'city', v_parent_profile.city,
                'state', v_parent_profile.state,
                'country', v_parent_profile.country,
                'pin_code', v_parent_profile.pin_code,
                'parent_id', v_parent_id
            );
        END IF;
    END IF;

    -- 5. Fallback: Return raw details from the record (Unlinked)
    RETURN jsonb_build_object(
        'found', true,
        'source', v_source,
        'is_unlinked', true,
        'name', v_raw_name,
        'email', v_raw_email,
        'phone', v_raw_phone,
        'relationship', 'Parent',
        'address', NULL,
        'parent_id', NULL
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('found', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_linked_parent_for_student TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_linked_parent_for_student TO service_role;
