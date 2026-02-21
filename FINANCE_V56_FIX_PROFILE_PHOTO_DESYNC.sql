-- ==========================================
-- FINANCE_V56_FIX_PROFILE_PHOTO_DESYNC
-- Objective: Fix "column sp.profile_photo_url does not exist" by removing references to it
-- ==========================================

BEGIN;

-- [1] FIX: get_my_children_profiles_v2
CREATE OR REPLACE FUNCTION public.get_my_children_profiles_v2()
RETURNS TABLE (
    id uuid,
    applicant_name text,
    parent_name text,
    parent_email text,
    parent_phone text,
    grade text,
    status text,
    date_of_birth date,
    gender text,
    profile_photo_url text,
    branch_id integer,
    submitted_at timestamptz,
    student_user_id uuid,
    emergency_contact text,
    medical_info text,
    address text,
    source_type text,
    student_id_number text,
    school_name text,
    class_name text
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    -- 1. Fetch via admissions (Hardened)
    SELECT 
        a.id::uuid,
        a.applicant_name::text,
        a.parent_name::text,
        a.parent_email::text,
        a.parent_phone::text,
        a.grade::text,
        a.status::text,
        a.date_of_birth::date,
        a.gender::text,
        a.profile_photo_url::text,
        a.branch_id::integer,
        a.submitted_at::timestamptz,
        a.student_user_id::uuid,
        a.emergency_contact::text,
        a.medical_info::text,
        a.address::text,
        'Admission'::text as source_type,
        a.student_id_number::text,
        sb.name::text as school_name,
        sc.name::text as class_name
    FROM public.admissions a
    LEFT JOIN public.school_branches sb ON a.branch_id = sb.id
    LEFT JOIN public.student_profiles sp ON a.student_user_id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE a.parent_id = auth.uid()

    UNION ALL

    -- 2. Fetch via Enquiries (Hardened)
    SELECT 
        e.id::uuid,
        e.applicant_name::text,
        e.parent_name::text,
        e.parent_email::text,
        e.parent_phone::text,
        e.grade::text,
        e.status::text,
        e.date_of_birth::date,
        e.gender::text,
        e.profile_photo_url::text,
        e.branch_id::integer,
        e.received_at::timestamptz as submitted_at,
        NULL::uuid as student_user_id,
        e.emergency_contact::text,
        e.medical_info::text,
        e.address::text,
        'Enquiry'::text as source_type,
        NULL::text as student_id_number,
        sb.name::text as school_name,
        NULL::text as class_name
    FROM public.enquiries e
    LEFT JOIN public.school_branches sb ON e.branch_id = sb.id
    WHERE e.user_id = auth.uid()
      AND e.status != 'ENQUIRY_CONVERTED'
      AND e.admission_id IS NULL

    UNION ALL

    -- 3. Fetch via student_parents (Fixed profile_photo_url reference)
    SELECT 
        psm.student_id::uuid as id,
        s.display_name::text as applicant_name,
        NULL::text as parent_name,
        s.email::text as parent_email,
        NULL::text as parent_phone,
        sp.grade::text,
        sp.enrollment_status::text as status,
        NULL::date as date_of_birth,
        NULL::text as gender,
        s.profile_photo_url::text as profile_photo_url,  -- FIXED HERE
        sp.branch_id::integer,
        psm.created_at::timestamptz as submitted_at,
        psm.student_id::uuid as student_user_id,
        NULL::text as emergency_contact,
        NULL::text as medical_info,
        NULL::text as address,
        'STUDENT'::text as source_type,
        sp.student_id_number::text,
        sb.name::text as school_name,
        sc.name::text as class_name
    FROM public.student_parents psm
    JOIN public.profiles s ON psm.student_id = s.id
    LEFT JOIN public.student_profiles sp ON s.id = sp.user_id
    LEFT JOIN public.school_branches sb ON sp.branch_id = sb.id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE psm.parent_id = auth.uid() AND psm.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM public.admissions a WHERE a.student_user_id = psm.student_id AND a.parent_id = auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_children_profiles_v2() TO authenticated;


-- [2] FIX: get_parent_authorized_nodes (also references sp.profile_photo_url)
CREATE OR REPLACE FUNCTION public.get_parent_authorized_nodes()
RETURNS TABLE (
    node_id UUID,
    node_type TEXT,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    status TEXT,
    branch_name TEXT,
    academic_year_id BIGINT,
    student_user_id UUID,
    school_name TEXT,
    class_name TEXT,
    student_id_number TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_current_year_id BIGINT;
    v_parent_id UUID := auth.uid();
BEGIN
    IF v_parent_id IS NULL THEN RETURN; END IF;
    
    SELECT id INTO v_current_year_id FROM public.academic_years WHERE is_current = true LIMIT 1;

    RETURN QUERY
    -- Block A: Explicitly Linked Enrolled Students (The Source of Truth)
    SELECT 
        s.id::uuid as node_id,
        'STUDENT'::text as node_type,
        s.display_name::text,
        s.profile_photo_url::text as profile_photo_url, -- FIXED HERE
        sp.grade::text,
        sp.enrollment_status::text as status,
        COALESCE(sb.name, 'Main Branch')::text as branch_name,
        v_current_year_id::bigint as academic_year_id,
        s.id::uuid as student_user_id,
        sb.name::text as school_name,
        sc.name::text as class_name,
        sp.student_id_number::text
    FROM public.student_parents psm
    JOIN public.profiles s ON psm.student_id = s.id
    LEFT JOIN public.student_profiles sp ON s.id = sp.user_id
    LEFT JOIN public.school_branches sb ON sp.branch_id = sb.id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE psm.parent_id = v_parent_id AND psm.status = 'active'

    UNION ALL

    -- Block B: Ownership via Admissions (Verified Owners)
    SELECT 
        a.id::uuid as node_id,
        'ADMISSION'::text as node_type,
        a.applicant_name::text as display_name,
        a.profile_photo_url::text,
        a.grade::text,
        a.status::text,
        COALESCE(sb.name, 'Branch Registry')::text as branch_name,
        v_current_year_id::bigint as academic_year_id,
        a.student_user_id::uuid,
        sb.name::text as school_name,
        NULL::text as class_name,
        a.student_id_number::text
    FROM public.admissions a
    LEFT JOIN public.school_branches sb ON a.branch_id = sb.id
    WHERE a.parent_id = v_parent_id 
      AND (a.student_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.student_parents psm WHERE psm.student_id = a.student_user_id AND psm.parent_id = v_parent_id))
      AND a.status NOT IN ('ENROLLED', 'VERIFIED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parent_authorized_nodes() TO authenticated;

COMMIT;
