-- ============================================================================
-- FIX: Student Contact Field Auto-population
-- Reason: The previous function accessed columns on student_profiles/parent_profiles 
-- that likely do not exist (e.g., phone, display_name), causing the function 
-- to fail silently or return incorrect data.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_contact_details(uuid);

CREATE OR REPLACE FUNCTION public.get_student_contact_details(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_result jsonb;
    v_student_auth RECORD;       -- from profiles table (auth/base info)
    v_student_details RECORD;    -- from student_profiles table (extra info)
    v_parent_auth RECORD;        -- from joined query
    v_admission RECORD;
    v_enquiry RECORD;
BEGIN
    -- 1. Fetch Student Identity (Base Profile)
    SELECT * INTO v_student_auth FROM public.profiles WHERE id = p_student_id;

    -- 2. Fetch Student Details (Extended Profile)
    SELECT * INTO v_student_details FROM public.student_profiles WHERE user_id = p_student_id;

    -- 3. Fetch Linked Parent Identity & Details (JOINED)
    -- We select into a record that combines parent_profiles and profiles
    SELECT 
        pp.user_id,
        pp.relationship_to_student,
        pp.address,
        pp.city,
        pp.state,
        pp.country,
        pp.pin_code,
        pp.secondary_parent_email,
        p.display_name as auth_name, 
        p.email as auth_email, 
        p.phone as auth_phone
    INTO v_parent_auth
    FROM public.parent_profiles pp
    JOIN public.profiles p ON p.id = pp.user_id
    WHERE pp.user_id = (
        SELECT parent_id FROM public.student_parents 
        WHERE student_id = p_student_id AND is_primary = true
        LIMIT 1
    );

    -- 4. Fetch Admission Record (Fallback 1)
    SELECT * INTO v_admission FROM public.admissions
    WHERE student_user_id = p_student_id
    ORDER BY created_at DESC LIMIT 1;

    -- 5. Fetch Enquiry Record (Fallback 2)
    IF v_admission IS NULL THEN
        SELECT * INTO v_enquiry FROM public.enquiries
        WHERE user_id = p_student_id
        ORDER BY updated_at DESC LIMIT 1;
    END IF;

    -- 6. Construct Result safely
    -- We avoid accessing columns on student/parent profiles that might not exist (like phone on student_profiles)
    v_result := jsonb_build_object(
        'found', true,
        
        -- Student Phone: Profiles -> Admission -> Enquiry
        'student_phone', COALESCE(
            v_student_auth.phone,
            v_admission.student_phone,
            v_enquiry.student_phone,
            v_admission.phone,
            v_enquiry.phone 
        ),
        
        -- Student Email
        'student_email', COALESCE(
            v_student_auth.email,
            v_admission.email,
            v_enquiry.email
        ),

        -- Parent Name: Parent Auth Profile -> Admission -> Enquiry
        'parent_name', COALESCE(
            v_parent_auth.auth_name,
            v_admission.parent_name,
            v_admission.father_name,
            v_admission.mother_name,
            v_enquiry.parent_name,
            v_enquiry.father_name,
            v_enquiry.mother_name
        ),

        -- Parent Phone: Parent Auth Profile -> Admission -> Enquiry
        'parent_phone', COALESCE(
            v_parent_auth.auth_phone,
            v_admission.parent_phone,
            v_enquiry.parent_phone
        ),

        -- Parent Email
        'parent_email', COALESCE(
            v_parent_auth.auth_email,
            v_parent_auth.secondary_parent_email,
            v_admission.parent_email,
            v_enquiry.parent_email
        ),

        -- Relationship
        'parent_relationship', COALESCE(
            v_parent_auth.relationship_to_student,
            'Parent'
        ),

        -- Address: Student Profile -> Parent Profile -> Admission
        'address', COALESCE(
            v_student_details.address,
            v_parent_auth.address,
            v_admission.address,
            v_enquiry.address
        ),

        -- City
        'city', COALESCE(
            v_parent_auth.city,
            v_admission.city,
            v_enquiry.city
        ),

        -- State
        'state', COALESCE(
            v_parent_auth.state,
            v_admission.state,
            v_enquiry.state
        ),

        -- Country
        'country', COALESCE(
            v_parent_auth.country,
            v_admission.country,
            v_enquiry.country
        ),

        -- PIN Code
        'pin_code', COALESCE(
            v_parent_auth.pin_code,
            v_admission.pin_code,
            v_enquiry.pin_code
        ),
        
        'parent_id', v_parent_auth.user_id,
        'student_id', p_student_id
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- Return error state but with found=false so UI can handle fallback
    RETURN jsonb_build_object('found', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_contact_details TO authenticated, service_role;

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

GRANT EXECUTE ON FUNCTION public.save_student_contact_details TO authenticated, service_role;
