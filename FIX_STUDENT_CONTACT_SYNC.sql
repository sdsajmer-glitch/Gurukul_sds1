-- ============================================================================
-- FIX: Student Contact Field Auto-population
-- Issue: Student Phone, Parent Contact, and Address fields display blank
-- ============================================================================

-- 1. Create enhanced RPC that properly fetches parent/student contact data
-- This RPC handles all data sources: linked parents, admissions, enquiries, and student profiles

DROP FUNCTION IF EXISTS public.get_student_contact_details(uuid);

CREATE OR REPLACE FUNCTION public.get_student_contact_details(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_result jsonb;
    v_profile RECORD;
    v_student_profile RECORD;
    v_admission RECORD;
    v_enquiry RECORD;
    v_parent RECORD;
BEGIN
    -- Fetch main profile
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_student_id;

    -- Fetch student profile
    SELECT * INTO v_student_profile FROM public.student_profiles WHERE user_id = p_student_id;

    -- Try to get linked parent
    SELECT * INTO v_parent FROM public.parent_profiles WHERE user_id IN (
        SELECT parent_id FROM public.student_parents WHERE student_id = p_student_id AND is_primary = true
        LIMIT 1
    );

    -- Fetch admission record
    SELECT * INTO v_admission FROM public.admissions
    WHERE student_user_id = p_student_id
    ORDER BY created_at DESC LIMIT 1;

    -- If no admission, try enquiry
    IF v_admission IS NULL THEN
        SELECT * INTO v_enquiry FROM public.enquiries
        WHERE user_id = p_student_id
        ORDER BY updated_at DESC LIMIT 1;
    END IF;

    -- Build comprehensive result
    v_result := jsonb_build_object(
        'found', true,
        'student_phone', COALESCE(
            v_profile.phone,
            v_student_profile.phone,
            v_admission.student_phone,
            v_enquiry.student_phone,
            NULL
        ),
        'student_email', COALESCE(
            v_profile.email,
            v_admission.email,
            v_enquiry.email,
            NULL
        ),
        'parent_name', COALESCE(
            v_parent.display_name,
            v_admission.parent_name,
            v_enquiry.parent_name,
            NULL
        ),
        'parent_phone', COALESCE(
            v_parent.phone,
            v_profile.phone,  -- Parent phone might be on student profile
            v_admission.parent_phone,
            v_enquiry.parent_phone,
            NULL
        ),
        'parent_email', COALESCE(
            v_parent.email,
            v_admission.parent_email,
            v_enquiry.parent_email,
            NULL
        ),
        'parent_relationship', COALESCE(
            v_parent.relationship_to_student,
            'Parent',
            NULL
        ),
        'address', COALESCE(
            v_student_profile.address,
            v_parent.address,
            v_admission.address,
            v_enquiry.address,
            NULL
        ),
        'city', COALESCE(
            v_parent.city,
            v_admission.city,
            v_enquiry.city,
            NULL
        ),
        'state', COALESCE(
            v_parent.state,
            v_admission.state,
            v_enquiry.state,
            NULL
        ),
        'country', COALESCE(
            v_parent.country,
            v_admission.country,
            v_enquiry.country,
            NULL
        ),
        'pin_code', COALESCE(
            v_parent.pin_code,
            v_admission.pin_code,
            v_enquiry.pin_code,
            NULL
        ),
        'parent_id', v_parent.user_id
    );

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('found', false, 'error', SQLERRM);
END;
$$;

-- 2. Enhanced update function to properly save contact fields
DROP FUNCTION IF EXISTS public.save_student_contact_details(uuid, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.save_student_contact_details(
    p_student_id uuid,
    p_phone text DEFAULT NULL,
    p_address text DEFAULT NULL,
    p_city text DEFAULT NULL,
    p_state text DEFAULT NULL,
    p_pin_code text DEFAULT NULL,
    p_parent_name text DEFAULT NULL,
    p_parent_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Update main profile phone
    IF p_phone IS NOT NULL AND p_phone <> '' THEN
        UPDATE public.profiles SET phone = p_phone WHERE id = p_student_id;
    END IF;

    -- Update student profile address and parent details
    UPDATE public.student_profiles SET
        address = COALESCE(p_address, address),
        parent_guardian_details = COALESCE(
            CASE WHEN p_parent_name IS NOT NULL AND p_parent_name <> ''
                 THEN p_parent_name || ' (' || COALESCE(p_parent_phone, 'Parent') || ')'
                 ELSE parent_guardian_details
            END,
            parent_guardian_details
        )
    WHERE user_id = p_student_id;

    -- Update parent profile if linked
    IF EXISTS (SELECT 1 FROM public.student_parents WHERE student_id = p_student_id) THEN
        UPDATE public.parent_profiles SET
            phone = COALESCE(p_parent_phone, phone),
            address = COALESCE(p_address, address),
            city = COALESCE(p_city, city),
            state = COALESCE(p_state, state),
            pin_code = COALESCE(p_pin_code, pin_code)
        WHERE user_id IN (
            SELECT parent_id FROM public.student_parents
            WHERE student_id = p_student_id AND is_primary = true
            LIMIT 1
        );
    END IF;

    -- Also update admission/enquiry for record consistency
    UPDATE public.admissions SET
        parent_phone = COALESCE(p_parent_phone, parent_phone),
        address = COALESCE(p_address, address)
    WHERE student_user_id = p_student_id;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_student_contact_details TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_student_contact_details TO authenticated, service_role;

SELECT 'FIX_STUDENT_CONTACT_SYNC: Functions created successfully' as status;
