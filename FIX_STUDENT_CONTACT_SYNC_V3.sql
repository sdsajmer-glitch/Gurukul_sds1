-- ============================================================================
-- FIX: Student Contact Field Auto-population (Version 3.1)
-- Reason: Fixes auto-fetch for Student Phone, Parent Contact, and Address.
-- 1. Updates get_student_contact_details to be more robust.
-- 2. Fixes save_student_contact_details (removes nonexistent phone/name columns from parent_profiles).
-- 3. Ensures student phone is pulled from the high-level profiles table.
-- ============================================================================

BEGIN;

-- 1. Unified Student Contact Fetcher (Used by Edit Modal)
CREATE OR REPLACE FUNCTION public.get_student_contact_details(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_result jsonb;
    v_student_auth RECORD;       -- from profiles
    v_student_details RECORD;    -- from student_profiles
    v_parent_auth RECORD;        -- joined profiles + parent_profiles
    v_admission RECORD;
    v_enquiry RECORD;
BEGIN
    -- [A] Resolve Identity Nodes
    SELECT * INTO v_student_auth FROM public.profiles WHERE id = p_student_id;
    SELECT * INTO v_student_details FROM public.student_profiles WHERE user_id = p_student_id;

    -- [B] Resolve Primary Guardian
    SELECT 
        pp.*,
        p.display_name as auth_name, 
        p.email as auth_email, 
        p.phone as auth_phone
    INTO v_parent_auth
    FROM public.student_parents sp
    JOIN public.profiles p ON p.id = sp.parent_id
    LEFT JOIN public.parent_profiles pp ON pp.user_id = p.id
    WHERE sp.student_id = p_student_id AND sp.is_primary = true
    LIMIT 1;

    -- [C] Resolve Institutional History
    SELECT * INTO v_admission FROM public.admissions
    WHERE student_user_id = p_student_id OR application_number = v_student_details.student_id_number
    ORDER BY created_at DESC LIMIT 1;

    SELECT * INTO v_enquiry FROM public.enquiries
    WHERE user_id = p_student_id OR applicant_name = v_student_auth.display_name
    ORDER BY updated_at DESC LIMIT 1;

    -- [D] Construct Response with Prioritized Fallbacks
    v_result := jsonb_build_object(
        'found', true,
        
        -- Student Phone: Auth Profile > Registry > Parent Profile (Shared)
        'student_phone', COALESCE(
            NULLIF(v_student_auth.phone, ''),
            NULLIF(v_admission.student_phone, ''), -- If exists
            NULLIF(v_enquiry.student_phone, ''),   -- If exists
            NULLIF(v_admission.phone, ''),         -- Fallback to general contact
            NULLIF(v_enquiry.phone, '')
        ),
        
        -- Parent Info: Linked Profile > Admission > Enquiry
        'parent_name', COALESCE(
            NULLIF(v_parent_auth.auth_name, ''),
            NULLIF(v_admission.parent_name, ''),
            NULLIF(v_enquiry.parent_name, ''),
            'Guardian'
        ),
        'parent_phone', COALESCE(
            NULLIF(v_parent_auth.auth_phone, ''),
            NULLIF(v_admission.parent_phone, ''),
            NULLIF(v_enquiry.parent_phone, '')
        ),
        'parent_email', COALESCE(
            NULLIF(v_parent_auth.auth_email, ''),
            NULLIF(v_admission.parent_email, ''),
            NULLIF(v_enquiry.parent_email, '')
        ),

        -- Address: Student Profile > Parent Profile > Admission > Enquiry
        'address', COALESCE(
            NULLIF(v_student_details.address, ''),
            NULLIF(v_parent_auth.address, ''),
            NULLIF(v_admission.address, ''),
            NULLIF(v_enquiry.address, '')
        ),
        'city', COALESCE(
            NULLIF(v_parent_auth.city, ''),
            NULLIF(v_admission.city, ''),
            NULLIF(v_enquiry.city, '')
        ),
        'state', COALESCE(
            NULLIF(v_parent_auth.state, ''),
            NULLIF(v_admission.state, ''),
            NULLIF(v_enquiry.state, '')
        ),
        'country', COALESCE(
            NULLIF(v_parent_auth.country, ''),
            NULLIF(v_admission.country, ''),
            NULLIF(v_enquiry.country, '')
        ),
        'pin_code', COALESCE(
            NULLIF(v_parent_auth.pin_code, ''),
            NULLIF(v_admission.pin_code, ''),
            NULLIF(v_enquiry.pin_code, '')
        ),
        
        'parent_id', v_parent_auth.user_id,
        'has_linked_parent', (v_parent_auth.user_id IS NOT NULL)
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('found', false, 'error', SQLERRM);
END;
$$;

-- 2. Corrected Persistence Logic
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
DECLARE
    v_parent_id UUID;
BEGIN
    -- 1. Sync Student IdentityVault (profiles)
    IF p_phone IS NOT NULL AND p_phone <> '' THEN
        UPDATE public.profiles SET phone = p_phone WHERE id = p_student_id;
    END IF;

    -- 2. Sync Student Registry (student_profiles)
    UPDATE public.student_profiles SET
        address = COALESCE(NULLIF(p_address, ''), address),
        parent_guardian_details = COALESCE(
            CASE WHEN p_parent_name IS NOT NULL AND p_parent_name <> ''
                 THEN p_parent_name || ' (' || COALESCE(p_parent_phone, 'Parent') || ')'
                 ELSE parent_guardian_details
            END,
            parent_guardian_details
        )
    WHERE user_id = p_student_id;

    -- 3. Sync Parent Digital Identity (if linked)
    SELECT parent_id INTO v_parent_id 
    FROM public.student_parents 
    WHERE student_id = p_student_id AND is_primary = true
    LIMIT 1;

    IF v_parent_id IS NOT NULL THEN
        -- Phone goes to PROFILES, Address goes to PARENT_PROFILES
        IF p_parent_phone IS NOT NULL AND p_parent_phone <> '' THEN
            UPDATE public.profiles SET phone = p_parent_phone WHERE id = v_parent_id;
        END IF;

        UPDATE public.parent_profiles SET
            address = COALESCE(NULLIF(p_address, ''), address),
            city = COALESCE(NULLIF(p_city, ''), city),
            state = COALESCE(NULLIF(p_state, ''), state),
            pin_code = COALESCE(NULLIF(p_pin_code, ''), pin_code)
        WHERE user_id = v_parent_id;
    END IF;

    -- 4. Registry Backward Sync
    UPDATE public.admissions SET
        parent_phone = COALESCE(p_parent_phone, parent_phone),
        address = COALESCE(p_address, address)
    WHERE student_user_id = p_student_id;
END;
$$;

COMMIT;
