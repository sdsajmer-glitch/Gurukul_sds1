-- ============================================================================
-- FIX: Guardian Enrollment Sync Ultimate (Version 1.2)
-- ============================================================================

BEGIN;

-- 1. FIX: admin_finalize_enrollment (Populate parent_guardian_details)
CREATE OR REPLACE FUNCTION public.admin_finalize_enrollment(p_admission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_grade TEXT;
    v_branch_id BIGINT;
    v_sid TEXT;
    v_applicant_name TEXT;
    v_virtual_email TEXT;
    v_academic_year TEXT;
    v_existing_student_id UUID;
    v_status TEXT;
    
    -- Variables for parent linking
    v_parent_id UUID;
    v_parent_email TEXT;
    v_parent_name TEXT;
    v_parent_phone TEXT;
    v_merged_parent_details TEXT;
BEGIN
    -- [A] Handshake: Load identity node metadata and check current lifecycle
    SELECT 
        student_user_id, grade, branch_id, applicant_name, status,
        parent_id, parent_email, parent_name, parent_phone
    INTO 
        v_user_id, v_grade, v_branch_id, v_applicant_name, v_status,
        v_parent_id, v_parent_email, v_parent_name, v_parent_phone
    FROM public.admissions WHERE id = p_admission_id;

    -- Integrity Check: Prevent enrollment for non-approved applicants
    IF v_status NOT IN ('Approved', 'Enrolled', 'Verified', 'Pending Review', 'Registered') THEN
        RETURN jsonb_build_object('success', false, 'message', 'LIFECYCLE_ERROR: Only Approved or Verified applicants can be enrolled. Current status: ' || v_status);
    END IF;

    -- Integrity Check: Prevent duplicate student nodes
    SELECT user_id INTO v_existing_student_id FROM public.student_profiles WHERE admission_id = p_admission_id;
    IF v_existing_student_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'CONFLICT: A student record already exists for this admission node.');
    END IF;

    -- [B] Recovery: Auto-Provision Identity if missing
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM public.profiles 
        WHERE LOWER(display_name) = LOWER(v_applicant_name) AND role = 'Student' LIMIT 1;
        
        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
            v_virtual_email := 'student.' || substring(v_user_id::text from 1 for 8) || '@gurukul.node';
            
            INSERT INTO public.profiles (id, email, display_name, role, branch_id, profile_completed, is_active)
            VALUES (v_user_id, v_virtual_email, v_applicant_name, 'Student', v_branch_id, true, true);
        END IF;
        
        UPDATE public.admissions SET student_user_id = v_user_id WHERE id = p_admission_id;
    END IF;

    -- [C] Context: Resolve Current Academic Year
    SELECT year_name INTO v_academic_year FROM public.academic_years WHERE branch_id = v_branch_id AND is_current = true LIMIT 1;
    IF v_academic_year IS NULL THEN v_academic_year := TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR(NOW() + interval '1 year', 'YY'); END IF;

    -- [D] SID Allocation
    v_sid := 'SID-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- Prepare Merged Details
    v_merged_parent_details := COALESCE(v_parent_name, 'Parent') || ' (' || COALESCE(v_parent_phone, 'No Phone') || ')';

    -- [E] Persistence
    
    -- 1. Profiles
    UPDATE public.profiles 
    SET role = 'Student', 
        profile_completed = true, 
        branch_id = COALESCE(v_branch_id, branch_id), 
        is_active = true 
    WHERE id = v_user_id;

    -- 1b. Role Assignment
    INSERT INTO public.user_roles (name, display_name, is_system_role)
    VALUES ('Student', 'Student', true)
    ON CONFLICT (name) DO NOTHING;

    INSERT INTO public.user_role_assignments (user_id, role_name, branch_id)
    VALUES (v_user_id, 'Student', v_branch_id)
    ON CONFLICT DO NOTHING;

    -- 2. Student Registry
    INSERT INTO public.student_profiles (
        user_id, 
        admission_id, 
        student_id_number, 
        grade, 
        branch_id, 
        enrollment_status, 
        academic_year,
        is_active,
        parent_guardian_details
    )
    VALUES (
        v_user_id, 
        p_admission_id, 
        v_sid, 
        v_grade, 
        v_branch_id, 
        'Active', 
        v_academic_year,
        true,
        v_merged_parent_details
    )
    ON CONFLICT (user_id) DO UPDATE SET 
        student_id_number = v_sid, 
        admission_id = p_admission_id,
        enrollment_status = 'Active',
        grade = EXCLUDED.grade,
        branch_id = EXCLUDED.branch_id,
        academic_year = EXCLUDED.academic_year,
        is_active = true,
        parent_guardian_details = COALESCE(EXCLUDED.parent_guardian_details, student_profiles.parent_guardian_details);

    -- [STEP 2b] Guardian Linkage: Auto-connect primary guardian
    IF v_parent_id IS NULL AND v_parent_email IS NOT NULL THEN
        SELECT id INTO v_parent_id FROM public.profiles WHERE email = v_parent_email LIMIT 1;
    END IF;

    IF v_parent_id IS NOT NULL THEN
        -- Link Parent
        INSERT INTO public.student_parents (student_id, parent_id, is_primary)
        VALUES (v_user_id, v_parent_id, true)
        ON CONFLICT (student_id, parent_id) DO UPDATE SET is_primary = EXCLUDED.is_primary;
        
        -- Update admission record with the found parent_id if it was missing
        UPDATE public.admissions SET parent_id = v_parent_id WHERE id = p_admission_id AND parent_id IS NULL;
    END IF;

    -- 3. Admissions Registry
    UPDATE public.admissions 
    SET status = 'Enrolled', 
        student_id_number = v_sid,
        registered_at = now() 
    WHERE id = p_admission_id;

    -- [F] Fiscal Handshake
    BEGIN
        PERFORM public.admin_sync_student_billing(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Billing alignment deferred: %', SQLERRM;
    END;

    -- [G] Audit
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'IDENTITY_ENROLLED', 'ENROLLMENT', jsonb_build_object(
        'sid', v_sid, 
        'user_id', v_user_id, 
        'admission_id', p_admission_id,
        'applicant_name', v_applicant_name,
        'linked_parent_id', v_parent_id
    ));

    RETURN jsonb_build_object(
        'success', true, 
        'student_id', v_user_id, 
        'student_id_number', v_sid,
        'message', 'Enrollment Successful. Master created with Guardian linkage.'
    );

EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.audit_logs (user_id, action, module, details)
    VALUES (auth.uid(), 'ENROLLMENT_FAULT', 'ENROLLMENT', jsonb_build_object('error', SQLERRM, 'admission_id', p_admission_id));
    RETURN jsonb_build_object('success', false, 'message', 'Registry Sync Failure: ' || SQLERRM);
END;
$$;

-- 2. FIX: get_linked_parent_for_student (Fix Shadowing and Overwrite Bug)
CREATE OR REPLACE FUNCTION public.get_linked_parent_for_student(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_parent_id UUID;
    v_explicit_parent_id UUID;
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
    -- We use a separate variable to avoid overwriting v_parent_id if no record is found
    SELECT parent_id INTO v_explicit_parent_id
    FROM public.student_parents
    WHERE student_id = p_student_id
    ORDER BY is_primary DESC, id DESC
    LIMIT 1;

    IF FOUND AND v_explicit_parent_id IS NOT NULL THEN
        v_parent_id := v_explicit_parent_id;
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

-- 3. Retroactive Repair Script
DO $$
DECLARE
    r RECORD;
    v_pid UUID;
    v_pinfo TEXT;
    v_count INT := 0;
BEGIN
    FOR r IN 
        SELECT s.user_id, a.parent_id, a.parent_email, a.parent_name, a.parent_phone
        FROM public.student_profiles s
        JOIN public.admissions a ON s.admission_id = a.id
    LOOP
        -- 1. Sync parent_guardian_details if missing
        IF r.parent_name IS NOT NULL THEN
            v_pinfo := r.parent_name || ' (' || COALESCE(r.parent_phone, 'No Phone') || ')';
            UPDATE public.student_profiles 
            SET parent_guardian_details = COALESCE(parent_guardian_details, v_pinfo)
            WHERE user_id = r.user_id;
        END IF;

        -- 2. Try to link parent if not linked
        IF NOT EXISTS (SELECT 1 FROM public.student_parents WHERE student_id = r.user_id) THEN
            v_pid := r.parent_id;
            IF v_pid IS NULL AND r.parent_email IS NOT NULL THEN
                SELECT id INTO v_pid FROM public.profiles WHERE email = r.parent_email LIMIT 1;
            END IF;

            IF v_pid IS NOT NULL THEN
                INSERT INTO public.student_parents (student_id, parent_id, is_primary)
                VALUES (r.user_id, v_pid, true)
                ON CONFLICT DO NOTHING;
                v_count := v_count + 1;
            END IF;
        END IF;
    END LOOP;
    RAISE NOTICE 'Retroactive Repair: Linked % students and synced parent details.', v_count;
END $$;

COMMIT;
