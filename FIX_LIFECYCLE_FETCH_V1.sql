-- 1. Ensure Schema Integrity (Idempotent Column Additions)
-- FIX: Changed enquiry_id type from BIGINT to UUID based on error message 'incompatible types: bigint and uuid'
-- This confirms enquiries.id is UUID.

DO $$ 
BEGIN
    -- Add 'source' to enquiries if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enquiries' AND column_name = 'source') THEN
        ALTER TABLE enquiries ADD COLUMN source TEXT DEFAULT 'Direct Visit';
    END IF;

    -- Add 'enquiry_id' to admissions if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admissions' AND column_name = 'enquiry_id') THEN
        ALTER TABLE admissions ADD COLUMN enquiry_id UUID REFERENCES enquiries(id);
    END IF;

    -- Add 'enquiry_id' to student_profiles if missing (for direct lookup)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'enquiry_id') THEN
        -- Note: student_profiles usually links to admissions, but enquiry_id is good for full traceability
        ALTER TABLE student_profiles ADD COLUMN enquiry_id UUID REFERENCES enquiries(id);
    END IF;
END $$;

-- 2. Update Enquiry Fetch Function (v2 -> v3)
-- FIX: Changed return type of id from BIGINT to UUID
DROP FUNCTION IF EXISTS get_all_enquiries_v3(bigint);

CREATE OR REPLACE FUNCTION get_all_enquiries_v3(p_branch_id BIGINT)
RETURNS TABLE (
    id UUID,
    applicant_name TEXT,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    grade TEXT,
    status TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    branch_id BIGINT,
    profile_photo_url TEXT,
    source TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.applicant_name,
        e.parent_name,
        e.parent_email,
        e.parent_phone,
        e.grade,
        e.status::TEXT,
        e.notes,
        e.updated_at,
        e.created_at,
        e.branch_id,
        e.profile_photo_url,
        e.source
    FROM enquiries e
    WHERE (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    ORDER BY e.created_at DESC;
END;
$$;

-- 3. Update Admission Fetch Function (v2 -> v3)
-- FIX: Changed return type of enquiry_id from BIGINT to UUID
DROP FUNCTION IF EXISTS get_admissions_v3(bigint);

CREATE OR REPLACE FUNCTION get_admissions_v3(p_branch_id BIGINT)
RETURNS TABLE (
    id UUID,
    applicant_name TEXT,
    grade TEXT,
    status TEXT,
    submitted_at TIMESTAMPTZ,
    profile_photo_url TEXT,
    application_number TEXT,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    student_id_number TEXT,
    branch_id BIGINT,
    enquiry_id UUID,
    gender TEXT,
    source_type TEXT,
    registered_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.applicant_name,
        a.grade,
        a.status,
        a.submitted_at,
        a.profile_photo_url,
        a.application_number,
        a.parent_name,
        a.parent_email,
        a.parent_phone,
        a.student_id_number,
        a.branch_id,
        a.enquiry_id,
        a.gender,
        a.source_type,
        a.registered_at
    FROM admissions a
    WHERE (p_branch_id IS NULL OR a.branch_id = p_branch_id)
    ORDER BY a.submitted_at DESC;
END;
$$;

-- 4. New RPC for Full Student Profile Fetch
CREATE OR REPLACE FUNCTION get_student_full_profile_v1(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student_data JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', sp.user_id,
        'student_id_number', sp.student_id_number,
        'roll_number', sp.roll_number,
        'grade', sp.grade,
        'gender', sp.gender,
        'date_of_birth', sp.date_of_birth,
        'address', sp.address,
        'admission_id', sp.admission_id,
        'enquiry_id', sp.enquiry_id,
        'parent_guardian_details', sp.parent_guardian_details,
        'assigned_class_id', sp.assigned_class_id,
        'created_at', sp.created_at,
        -- Profile Data
        'display_name', p.display_name,
        'email', p.email,
        'phone', p.phone,
        'profile_photo_url', p.profile_photo_url,
        'is_active', p.is_active,
        -- Admission Data
        'admission', (
            SELECT jsonb_build_object(
                'id', a.id,
                'application_number', a.application_number,
                'status', a.status,
                'submitted_at', a.submitted_at,
                'enquiry_id', a.enquiry_id
            ) FROM admissions a WHERE a.id = sp.admission_id
        ),
        -- Shared Parent Profile Data (if linked)
        'parents', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'relationship', pp.relationship_to_student,
                    'name', pp_prof.display_name,
                    'email', pp_prof.email,
                    'phone', pp_prof.phone,
                    'address', pp.address,
                    'city', pp.city
                )
            )
            FROM student_parents stp
            JOIN parent_profiles pp ON pp.user_id = stp.parent_id
            JOIN profiles pp_prof ON pp_prof.id = pp.user_id
            WHERE stp.student_id = sp.user_id
        )
    ) INTO v_student_data
    FROM student_profiles sp
    JOIN profiles p ON p.id = sp.user_id
    WHERE sp.user_id = p_student_id;

    RETURN v_student_data;
END;
$$;

-- 5. Fix RSL Linkage during Conversion (Enquiry -> Admission)
CREATE OR REPLACE FUNCTION sync_student_enquiry_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.admission_id IS NOT NULL AND NEW.enquiry_id IS NULL THEN
        SELECT enquiry_id INTO NEW.enquiry_id
        FROM admissions
        WHERE id = NEW.admission_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_student_enquiry_id ON student_profiles;
CREATE TRIGGER trg_sync_student_enquiry_id
BEFORE INSERT ON student_profiles
FOR EACH ROW
EXECUTE FUNCTION sync_student_enquiry_id();
