-- ===============================================================================================
--  GURUKUL OS - FUNCTIONAL EXTENSIONS (v25.2.1)
--  DOMAIN: Enquiry Desk, Finance Core, Academic Intelligence
--  DESCRIPTION: Adding missing RPC functions used in the application.
--  FIX: Added DROP FUNCTION statements to prevent type-conflict errors.
-- ===============================================================================================

BEGIN;

-- 1. ENQUIRY DESK EXTENSIONS
-- ===============================================================================================

-- Enquiry Timeline Table (If missing)
CREATE TABLE IF NOT EXISTS public.enquiry_timeline (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    enquiry_id UUID REFERENCES public.enquiries(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- 'MESSAGE', 'STATUS_CHANGE', 'DOCUMENT_REQUEST'
    details JSONB DEFAULT '{}',
    is_admin BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC: Get All Enquiries (v2)
DROP FUNCTION IF EXISTS public.get_all_enquiries_v2(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_all_enquiries_v2(p_branch_id BIGINT)
RETURNS TABLE (
    id UUID,
    applicant_name TEXT,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    grade TEXT,
    status TEXT,
    notes TEXT,
    branch_id BIGINT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    branch_name TEXT
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
        e.status, 
        e.notes, 
        e.branch_id, 
        e.created_at, 
        e.updated_at,
        b.name as branch_name
    FROM public.enquiries e
    LEFT JOIN public.school_branches b ON b.id = e.branch_id
    WHERE (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    ORDER BY e.updated_at DESC;
END;
$$;

-- RPC: Get Enquiry Timeline (v3)
DROP FUNCTION IF EXISTS public.get_enquiry_timeline_v3(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.get_enquiry_timeline_v3(p_enquiry_id UUID)
RETURNS TABLE (
    id UUID,
    item_type TEXT,
    details JSONB,
    is_admin BOOLEAN,
    created_at TIMESTAMPTZ,
    created_by_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id, 
        t.item_type, 
        t.details, 
        t.is_admin, 
        t.created_at,
        p.display_name as created_by_name
    FROM public.enquiry_timeline t
    LEFT JOIN public.profiles p ON p.id = t.created_by
    WHERE t.enquiry_id = p_enquiry_id
    ORDER BY t.created_at ASC;
END;
$$;

-- RPC: Send Enquiry Message (v3)
DROP FUNCTION IF EXISTS public.send_enquiry_message_v3(UUID, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.send_enquiry_message_v3(p_enquiry_id UUID, p_message TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.enquiry_timeline (enquiry_id, item_type, details, is_admin, created_by)
    VALUES (
        p_enquiry_id, 
        'MESSAGE', 
        jsonb_build_object('message', p_message), 
        (SELECT role IN ('Admin', 'Branch Admin', 'School Administration', 'Super Admin') FROM public.profiles WHERE id = auth.uid()),
        auth.uid()
    );
END;
$$;

-- RPC: Admin Verify Enquiry Code
DROP FUNCTION IF EXISTS public.admin_verify_enquiry_code(TEXT, BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_verify_enquiry_code(p_code TEXT, p_branch_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_enquiry_id UUID;
    v_applicant_name TEXT;
BEGIN
    -- Check for direct UUID snippet match or full UUID
    SELECT id, applicant_name INTO v_enquiry_id, v_applicant_name
    FROM public.enquiries
    WHERE UPPER(REPLACE(id::text, '-', '')) LIKE '%' || UPPER(p_code) || '%'
       OR UPPER(applicant_name) = UPPER(p_code);
       
    IF v_enquiry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Verification code not recognized in registry.');
    END IF;

    UPDATE public.enquiries SET branch_id = p_branch_id WHERE id = v_enquiry_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Handshake successful. Record linked to branch nodes.',
        'enquiry_id', v_enquiry_id,
        'applicant_name', v_applicant_name
    );
END;
$$;

-- RPC: Update Enquiry Status (Admin)
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(UUID, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_update_enquiry_status(p_enquiry_id UUID, p_status TEXT, p_notes TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.enquiries 
    SET status = p_status, 
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = p_enquiry_id;

    -- Log status change in timeline
    INSERT INTO public.enquiry_timeline (enquiry_id, item_type, details, is_admin, created_by)
    VALUES (p_enquiry_id, 'STATUS_CHANGE', jsonb_build_object('new_status', p_status), true, auth.uid());
END;
$$;

-- RPC: Convert Enquiry to Admission
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_admission(p_enquiry_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_enquiry public.enquiries;
    v_admission_id UUID;
BEGIN
    SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id;
    
    IF v_enquiry IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Enquiry not found.');
    END IF;

    -- Create Admission Record
    INSERT INTO public.admissions (
        applicant_name, parent_name, parent_email, parent_phone, grade, branch_id, status
    ) VALUES (
        v_enquiry.applicant_name, v_enquiry.parent_name, v_enquiry.parent_email, 
        v_enquiry.parent_phone, v_enquiry.grade, v_enquiry.branch_id, 'Registered'
    ) RETURNING id INTO v_admission_id;

    -- Update Enquiry Status
    UPDATE public.enquiries SET status = 'ENQUIRY_CONVERTED' WHERE id = p_enquiry_id;

    RETURN jsonb_build_object('success', true, 'admission_id', v_admission_id);
END;
$$;


-- 2. FINANCE CORE EXTENSIONS
-- ===============================================================================================

-- RPC: Get Finance Dashboard Data
DROP FUNCTION IF EXISTS public.get_finance_dashboard_data(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_finance_dashboard_data(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_revenue_ytd NUMERIC;
    v_collections_month NUMERIC;
    v_pending_dues NUMERIC;
    v_online_payments NUMERIC;
BEGIN
    -- Total Revenue YTD (Sum of all completed payments)
    SELECT COALESCE(SUM(amount), 0) INTO v_revenue_ytd 
    FROM public.fee_payments 
    WHERE status = 'Completed' 
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM NOW());

    -- Collections this Month
    SELECT COALESCE(SUM(amount), 0) INTO v_collections_month
    FROM public.fee_payments
    WHERE status = 'Completed'
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM NOW())
    AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM NOW());

    -- Pending Dues (Total Billed - Total Paid)
    SELECT COALESCE(SUM(outstanding_balance), 0) INTO v_pending_dues
    FROM public.student_fee_accounts
    WHERE (p_branch_id IS NULL OR EXISTS (SELECT 1 FROM public.profiles WHERE id = student_id AND branch_id = p_branch_id));

    RETURN jsonb_build_object(
        'revenue_ytd', v_revenue_ytd,
        'collections_this_month', v_collections_month,
        'pending_dues', v_pending_dues,
        'online_payments', 0 -- Placeholder
    );
END;
$$;

-- RPC: Record Fee Payment
DROP FUNCTION IF EXISTS public.record_fee_payment(BIGINT, NUMERIC, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.record_fee_payment(
    p_invoice_id BIGINT,
    p_amount NUMERIC,
    p_payment_method TEXT DEFAULT 'Cash'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student_id UUID;
    v_branch_id BIGINT;
BEGIN
    SELECT student_id INTO v_student_id FROM public.fee_invoices WHERE id = p_invoice_id;
    SELECT branch_id INTO v_branch_id FROM public.profiles WHERE id = v_student_id;

    INSERT INTO public.fee_payments (student_id, invoice_id, amount, payment_method, status, branch_id, payment_date)
    VALUES (v_student_id, p_invoice_id, p_amount, p_payment_method, 'Completed', v_branch_id, NOW());

    -- Update invoice status
    UPDATE public.fee_invoices 
    SET amount_paid = amount_paid + p_amount,
        status = CASE WHEN amount_paid + p_amount >= amount THEN 'Paid' ELSE 'Partial' END
    WHERE id = p_invoice_id;

    -- Reconcile account
    PERFORM public.admin_reconcile_student_account(v_student_id);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Get Expense Registry (v3)
DROP FUNCTION IF EXISTS public.get_expense_registry_v3(BIGINT, BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_expense_registry_v3(
    p_branch_id BIGINT,
    p_category_id BIGINT DEFAULT NULL
) RETURNS TABLE (
    id BIGINT,
    category_name TEXT,
    amount NUMERIC,
    description TEXT,
    vendor_name TEXT,
    expense_date DATE,
    status TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id, 
        'Category' as category_name, -- Placeholder
        e.amount, 
        e.description, 
        e.vendor_name, 
        e.expense_date, 
        e.status
    FROM public.expenses e
    WHERE e.branch_id = p_branch_id
    AND (p_category_id IS NULL OR e.id = p_category_id); -- Simple filter for now
END;
$$;

-- RPC: Admin Record Expense (v3)
DROP FUNCTION IF EXISTS public.admin_record_expense_v3(BIGINT, BIGINT, NUMERIC, TEXT, TEXT, DATE, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_record_expense_v3(
    p_branch_id BIGINT,
    p_category_id BIGINT,
    p_amount NUMERIC,
    p_description TEXT,
    p_vendor_name TEXT,
    p_expense_date DATE,
    p_payment_method TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO public.expenses (
        branch_id, amount, description, vendor_name, expense_date, payment_method, status
    ) VALUES (
        p_branch_id, p_amount, p_description, p_vendor_name, p_expense_date, p_payment_method, 'Pending'
    ) RETURNING id INTO v_id;
    
    RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- RPC: Get Fee Collection Report
DROP FUNCTION IF EXISTS public.get_fee_collection_report(DATE, DATE) CASCADE;
CREATE OR REPLACE FUNCTION public.get_fee_collection_report(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    payment_date DATE,
    student_name TEXT,
    amount NUMERIC,
    payment_method TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT fp.payment_date::DATE, p.display_name, fp.amount, fp.payment_method
    FROM public.fee_payments fp
    JOIN public.profiles p ON p.id = fp.student_id
    WHERE fp.payment_date::DATE BETWEEN p_start_date AND p_end_date
    AND fp.status = 'Completed';
END;
$$;

-- RPC: Get Student Ledger Report
DROP FUNCTION IF EXISTS public.get_student_ledger_report(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.get_student_ledger_report(p_student_id UUID)
RETURNS TABLE (
    transaction_date TIMESTAMPTZ,
    description TEXT,
    debit NUMERIC,
    credit NUMERIC,
    balance NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT transaction_date, description, debit, credit, running_balance
    FROM public.get_student_running_ledger(p_student_id);
END;
$$;

-- RPC: Get Student Fee Summary (All)
DROP FUNCTION IF EXISTS public.get_student_fee_summary_all(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_student_fee_summary_all(p_branch_id BIGINT)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    overall_status TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, p.display_name, sc.name, sfa.total_billed, sfa.total_paid, 
        sfa.outstanding_balance, 
        CASE WHEN sfa.outstanding_balance <= 0 THEN 'Paid' ELSE 'Pending' END
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE (p_branch_id IS NULL OR p.branch_id = p_branch_id)
    ORDER BY p.display_name ASC;
END;
$$;


-- 3. ACADEMIC ENGINE EXTENSIONS
-- ===============================================================================================

-- RPC: Create Homework Assignment
DROP FUNCTION IF EXISTS public.create_homework_assignment(BIGINT, BIGINT, TEXT, TEXT, TIMESTAMPTZ, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.create_homework_assignment(
    p_class_id BIGINT,
    p_subject_id BIGINT,
    p_title TEXT,
    p_description TEXT,
    p_due_date TIMESTAMPTZ,
    p_file_path TEXT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO public.assignments (class_id, course_id, title, description, due_date, file_path)
    VALUES (p_class_id, p_subject_id, p_title, p_description, p_due_date, p_file_path)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- RPC: Get Admin Homework List
DROP FUNCTION IF EXISTS public.get_admin_homework_list(BIGINT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_admin_homework_list(
    p_class_id BIGINT DEFAULT NULL,
    p_status TEXT DEFAULT 'All'
) RETURNS TABLE (
    id BIGINT,
    title TEXT,
    class_name TEXT,
    subject_name TEXT,
    due_date TIMESTAMPTZ,
    submission_count INT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id, a.title, c.name, cr.title, a.due_date,
        (SELECT COUNT(*)::INT FROM public.submissions s WHERE s.assignment_id = a.id)
    FROM public.assignments a
    JOIN public.school_classes c ON c.id = a.class_id
    JOIN public.courses cr ON cr.id = a.course_id
    WHERE (p_class_id IS NULL OR a.class_id = p_class_id)
    ORDER BY a.due_date DESC;
END;
$$;


-- 4. DIRECTORY & ASSET RETRIEVAL
-- ===============================================================================================

-- RPC: Get All Teachers for Admin
DROP FUNCTION IF EXISTS public.get_all_teachers_for_admin() CASCADE;
CREATE OR REPLACE FUNCTION public.get_all_teachers_for_admin()
RETURNS TABLE (
    id UUID,
    display_name TEXT,
    email TEXT,
    phone TEXT,
    subject_specialization TEXT,
    designation TEXT,
    branch_id BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.display_name, p.email, p.phone, tp.subject_specialization, tp.designation, p.branch_id
    FROM public.profiles p
    JOIN public.teacher_profiles tp ON p.id = tp.user_id
    WHERE p.role = 'Teacher';
END;
$$;

-- RPC: Get All Students for Admin
DROP FUNCTION IF EXISTS public.get_all_students_for_admin(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_all_students_for_admin(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    display_name TEXT,
    email TEXT,
    phone TEXT,
    grade TEXT,
    roll_number TEXT,
    branch_id BIGINT,
    assigned_class_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, p.display_name, p.email, p.phone, 
        sp.grade, sp.roll_number, p.branch_id,
        sc.name as assigned_class_name
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    WHERE p.role = 'Student'
    AND (p_branch_id IS NULL OR p.branch_id = p_branch_id);
END;
$$;

-- RPC: Get All Classes for Admin
DROP FUNCTION IF EXISTS public.get_all_classes_for_admin(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_all_classes_for_admin(p_branch_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    grade_level TEXT,
    section TEXT,
    branch_id BIGINT,
    student_count INT,
    class_teacher_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.id, sc.name, sc.grade_level, sc.section, sc.branch_id,
        (SELECT COUNT(*)::INT FROM public.student_profiles sp WHERE sp.assigned_class_id = sc.id) as student_count,
        p.display_name as class_teacher_name
    FROM public.school_classes sc
    LEFT JOIN public.profiles p ON p.id = sc.class_teacher_id
    WHERE (p_branch_id IS NULL OR sc.branch_id = p_branch_id);
END;
$$;

-- RPC: Get School Departments Stats
DROP FUNCTION IF EXISTS public.get_school_departments_stats(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_school_departments_stats(p_branch_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    description TEXT,
    hod_name TEXT,
    teacher_count INT,
    course_count INT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sd.id, sd.name, sd.description, 
        p.display_name as hod_name,
        (SELECT COUNT(*)::INT FROM public.profiles prof WHERE prof.branch_id = p_branch_id AND prof.role = 'Teacher') as teacher_count,
        (SELECT COUNT(*)::INT FROM public.courses c WHERE c.branch_id = p_branch_id) as course_count
    FROM public.school_departments sd
    LEFT JOIN public.profiles p ON p.id = sd.hod_id
    WHERE sd.branch_id = p_branch_id;
END;
$$;


-- 5. IDENTITY & CORE SYNC
-- ===============================================================================================

-- RPC: Get User Completed Roles
DROP FUNCTION IF EXISTS public.get_user_completed_roles() CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_completed_roles()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_roles TEXT[];
BEGIN
    SELECT array_agg(DISTINCT role) INTO v_roles
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN jsonb_build_object('roles', v_roles);
END;
$$;

-- RPC: Complete School Onboarding
DROP FUNCTION IF EXISTS public.complete_school_onboarding(TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.complete_school_onboarding(
    p_admin_name TEXT,
    p_admin_email TEXT,
    p_admin_phone TEXT,
    p_designation TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.school_admin_profiles SET
        admin_contact_name = p_admin_name,
        admin_contact_email = p_admin_email,
        admin_contact_phone = p_admin_phone,
        admin_designation = p_designation,
        onboarding_step = 'completed'
    WHERE user_id = auth.uid();

    UPDATE public.profiles SET
        display_name = p_admin_name,
        profile_completed = true
    WHERE id = auth.uid();
END;
$$;

-- RPC: Admin Verify Share Code
DROP FUNCTION IF EXISTS public.admin_verify_share_code(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_verify_share_code(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_code RECORD;
BEGIN
    SELECT * INTO v_code 
    FROM public.share_codes 
    WHERE code = UPPER(p_code) AND status = 'Active';

    IF v_code IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired share code.');
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'admission_id', v_code.admission_id,
        'applicant_name', v_code.applicant_name,
        'grade', (SELECT grade FROM public.admissions WHERE id = v_code.admission_id),
        'code_type', v_code.code_type
    );
END;
$$;

-- RPC: Admin Import Record From Share Code
DROP FUNCTION IF EXISTS public.admin_import_record_from_share_code(UUID, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_import_record_from_share_code(
    p_admission_id UUID,
    p_code_type TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- This logic marks the handshake as complete and links the record to the current branch
    -- For now, we assume the UI handles the redirection and data fetch.
    UPDATE public.share_codes SET status = 'Redeemed' WHERE admission_id = p_admission_id;
END;
$$;

-- RPC: Get Admin Analytics Stats
DROP FUNCTION IF EXISTS public.get_admin_analytics_stats() CASCADE;
CREATE OR REPLACE FUNCTION public.get_admin_analytics_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_users INT;
    v_total_apps INT;
    v_pending_apps INT;
BEGIN
    SELECT count(*) INTO v_total_users FROM public.profiles;
    SELECT count(*) INTO v_total_apps FROM public.admissions;
    SELECT count(*) INTO v_pending_apps FROM public.admissions WHERE status = 'Registered';

    RETURN jsonb_build_object(
        'total_users', v_total_users,
        'total_applications', v_total_apps,
        'pending_applications', v_pending_apps
    );
END;
$$;

-- RPC: Upsert Attendance (Bulk)
DROP FUNCTION IF EXISTS public.upsert_attendance(JSONB) CASCADE;
CREATE OR REPLACE FUNCTION public.upsert_attendance(p_records JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_rec RECORD;
BEGIN
    FOR v_rec IN SELECT * FROM jsonb_to_recordset(p_records) AS x(student_id UUID, class_id BIGINT, attendance_date DATE, status TEXT, notes TEXT) LOOP
        INSERT INTO public.attendance_records (student_id, class_id, attendance_date, status, notes)
        VALUES (v_rec.student_id, v_rec.class_id, v_rec.attendance_date, v_rec.status, v_rec.notes)
        ON CONFLICT (student_id, class_id, attendance_date) DO UPDATE SET
            status = EXCLUDED.status,
            notes = EXCLUDED.notes;
    END LOOP;
END;
$$;

-- RPC: Admin Assign Structure to Class
DROP FUNCTION IF EXISTS public.admin_assign_structure_to_class(BIGINT, BIGINT[]) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_assign_structure_to_class(
    p_structure_id BIGINT,
    p_class_ids BIGINT[]
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    SELECT user_id, p_structure_id 
    FROM public.student_profiles 
    WHERE assigned_class_id = ANY(p_class_ids)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = p_structure_id;
END;
$$;

-- RPC: Parent Switch Student View
DROP FUNCTION IF EXISTS public.parent_switch_student_view(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.parent_switch_student_view(p_new_admission_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- This is a placeholder for session/state updates if needed.
    -- For now, we assume the frontend just needs to know it's allowed.
    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Parent Initialize Vault Slots
DROP FUNCTION IF EXISTS public.parent_initialize_vault_slots_all() CASCADE;
CREATE OR REPLACE FUNCTION public.parent_initialize_vault_slots_all()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Placeholder for initializing document slots based on requirements
    -- This usually happens via triggers, but we provide it for manual sync.
END;
$$;

COMMIT;

-- 6. BRANCH MANAGEMENT & ONBOARDING
-- ===============================================================================================

-- Ensure Schema Compatibility
-- (Add required columns if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'admin_name') THEN
        ALTER TABLE public.school_branches ADD COLUMN admin_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'admin_phone') THEN
        ALTER TABLE public.school_branches ADD COLUMN admin_phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'admin_email') THEN
        ALTER TABLE public.school_branches ADD COLUMN admin_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'school_id') THEN
        ALTER TABLE public.school_branches ADD COLUMN school_id UUID REFERENCES public.school_admin_profiles(user_id) ON DELETE CASCADE;
    END IF;
END $$;

-- RPC: Initialize School Admin
DROP FUNCTION IF EXISTS public.initialize_school_admin() CASCADE;
CREATE OR REPLACE FUNCTION public.initialize_school_admin()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Update Profile Role
    UPDATE public.profiles 
    SET role = 'School Administration',
        profile_completed = false
    WHERE id = auth.uid();

    -- Create/Update School Admin Profile
    INSERT INTO public.school_admin_profiles (user_id, onboarding_step)
    VALUES (auth.uid(), 'profile')
    ON CONFLICT (user_id) DO UPDATE SET onboarding_step = 'profile';
END;
$$;

-- RPC: Complete Branch Step
DROP FUNCTION IF EXISTS public.complete_branch_step() CASCADE;
CREATE OR REPLACE FUNCTION public.complete_branch_step()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.school_admin_profiles 
    SET onboarding_step = 'completed'
    WHERE user_id = auth.uid();
    
    UPDATE public.profiles
    SET profile_completed = true
    WHERE id = auth.uid();
END;
$$;

-- RPC: Create School Branch
DROP FUNCTION IF EXISTS public.create_school_branch(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.create_school_branch(
    p_name TEXT,
    p_address TEXT,
    p_city TEXT,
    p_state TEXT,
    p_country TEXT,
    p_contact_number TEXT,
    p_is_main BOOLEAN,
    p_email TEXT,
    p_admin_name TEXT,
    p_admin_phone TEXT,
    p_admin_email TEXT
) RETURNS TABLE (
    id BIGINT,
    name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    is_main_branch BOOLEAN,
    admin_name TEXT,
    admin_phone TEXT,
    admin_email TEXT,
    access_key TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_branch_id BIGINT;
    v_access_key TEXT;
BEGIN
    -- Generate Access Key (ABCD-1234 format)
    v_access_key := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4) || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 5, 4));

    INSERT INTO public.school_branches (
        name, address, city, state, country, 
        is_main_branch, 
        admin_name, admin_phone, admin_email,
        access_key, school_id
    ) VALUES (
        p_name, p_address, p_city, p_state, p_country,
        p_is_main,
        p_admin_name, p_admin_phone, p_admin_email,
        v_access_key, auth.uid()
    ) RETURNING school_branches.id INTO v_branch_id;

    RETURN QUERY SELECT 
        sb.id, sb.name, sb.address, sb.city, sb.state, sb.country, 
        sb.is_main_branch, sb.admin_name, sb.admin_phone, sb.admin_email, sb.access_key
    FROM public.school_branches sb WHERE sb.id = v_branch_id;
END;
$$;

-- RPC: Update School Branch
DROP FUNCTION IF EXISTS public.update_school_branch(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.update_school_branch(
    p_branch_id BIGINT,
    p_name TEXT,
    p_address TEXT,
    p_city TEXT,
    p_state TEXT,
    p_country TEXT,
    p_contact_number TEXT,
    p_is_main BOOLEAN,
    p_email TEXT,
    p_admin_name TEXT,
    p_admin_phone TEXT,
    p_admin_email TEXT
) RETURNS TABLE (
    id BIGINT,
    name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    is_main_branch BOOLEAN,
    admin_name TEXT,
    admin_phone TEXT,
    admin_email TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.school_branches SET
        name = p_name,
        address = p_address,
        city = p_city,
        state = p_state,
        country = p_country,
        is_main_branch = p_is_main,
        admin_name = p_admin_name,
        admin_phone = p_admin_phone,
        admin_email = p_admin_email,
        updated_at = NOW()
    WHERE school_branches.id = p_branch_id;  -- EXPLICIT TABLE REFERENCE FIXED

    RETURN QUERY SELECT 
        sb.id, sb.name, sb.address, sb.city, sb.state, sb.country, 
        sb.is_main_branch, sb.admin_name, sb.admin_phone, sb.admin_email
    FROM public.school_branches sb WHERE sb.id = p_branch_id;
END;
$$;

-- RPC: Delete School Branch
DROP FUNCTION IF EXISTS public.delete_school_branch(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.delete_school_branch(p_branch_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM public.school_branches WHERE id = p_branch_id;
END;
$$;

-- ===============================================================================================
-- 7. SECURE INSTITUTIONAL HANDSHAKE PROTOCOL (v9.5)
-- ===============================================================================================

-- Ensure Schema Extensions for Handshake Governance
DO $$ 
BEGIN
    -- Add Sync & Identity Metadata to Branches
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'last_sync_at') THEN
        ALTER TABLE public.school_branches ADD COLUMN last_sync_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'protocol_version') THEN
        ALTER TABLE public.school_branches ADD COLUMN protocol_version TEXT DEFAULT 'v9.5';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_branches' AND column_name = 'admin_user_id') THEN
        ALTER TABLE public.school_branches ADD COLUMN admin_user_id UUID REFERENCES public.profiles(id);
    END IF;

    -- Governance: Set status to 'Pending' by default for new branches if not specified
    ALTER TABLE public.school_branches ALTER COLUMN status SET DEFAULT 'Pending';
END $$;

-- Node Isolation Policies (v9.6)
ALTER TABLE public.school_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Head Office Master Access" ON public.school_branches;
CREATE POLICY "Head Office Master Access" ON public.school_branches
FOR ALL USING (school_id = auth.uid());

DROP POLICY IF EXISTS "Branch Admin Isolation" ON public.school_branches;
CREATE POLICY "Branch Admin Isolation" ON public.school_branches
FOR SELECT USING (
    admin_user_id = auth.uid() 
    OR LOWER(admin_email) = LOWER(auth.jwt() ->> 'email')
);

-- Handshake Audit Log for Compliance & Governance
CREATE TABLE IF NOT EXISTS public.handshake_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT,
    admin_user_id UUID REFERENCES public.profiles(id),
    target_email TEXT,
    event_type TEXT NOT NULL, -- 'HANDSHAKE_INIT', 'HANDSHAKE_SUCCESS', 'HANDSHAKE_FAILURE', 'IDENTITY_MISMATCH'
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active Handshake Sessions (Real-time telemetry)
CREATE TABLE IF NOT EXISTS public.branch_handshake_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT REFERENCES public.school_branches(id) ON DELETE CASCADE,
    admin_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_start TIMESTAMPTZ DEFAULT NOW(),
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'Online', -- 'Online', 'Offline', 'Terminated'
    UNIQUE(branch_id, admin_user_id)
);

-- RPC: Verify and Link Branch Admin (v3 - Secure Handshake)
DROP FUNCTION IF EXISTS public.verify_and_link_branch_admin(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.verify_and_link_branch_admin(p_invitation_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_branch_id BIGINT;
    v_admin_email TEXT;
    v_clean_code TEXT;
    v_user_email TEXT;
    v_existing_admin UUID;
BEGIN
    -- 1. Sanitation
    v_clean_code := UPPER(REGEXP_REPLACE(p_invitation_code, '[^A-Z0-9]', '', 'g'));
    v_user_email := auth.jwt() ->> 'email';

    -- 2. Validate Branch Registry
    SELECT id, admin_email, admin_user_id INTO v_branch_id, v_admin_email, v_existing_admin
    FROM public.school_branches 
    WHERE UPPER(REGEXP_REPLACE(access_key, '[^A-Z0-9]', '', 'g')) = v_clean_code;

    IF v_branch_id IS NULL THEN
        INSERT INTO public.handshake_audit_logs (target_email, event_type, details)
        VALUES (v_user_email, 'HANDSHAKE_FAILURE', jsonb_build_object('reason', 'Invalid Access Key', 'code', p_invitation_code));
        RETURN jsonb_build_object('success', false, 'message', 'HANDSHAKE FAILED: Access Key not found in institutional registry.');
    END IF;

    -- 3. Security Check: Email Identity Verification
    -- Both email and User must match the record to prevent hijacking
    IF LOWER(v_admin_email) != LOWER(v_user_email) THEN
        INSERT INTO public.handshake_audit_logs (branch_id, target_email, event_type, details)
        VALUES (v_branch_id, v_user_email, 'IDENTITY_MISMATCH', jsonb_build_object('expected', v_admin_email, 'provided', v_user_email));
        RETURN jsonb_build_object('success', false, 'message', 'IDENTITY MISMATCH: This node is registered to ' || v_admin_email || '. Please login with authorized credentials.');
    END IF;

    -- 4. Governance: One-to-One Mapping Check
    IF v_existing_admin IS NOT NULL AND v_existing_admin != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'SECURITY ALERT: This branch is already linked to another identity matrix.');
    END IF;

    -- 5. Successful Handshake Establishment
    -- Update branch status and link identity
    UPDATE public.school_branches SET 
        status = 'Verified',
        admin_user_id = auth.uid(),
        last_sync_at = NOW(),
        updated_at = NOW()
    WHERE id = v_branch_id;

    -- Update profile
    UPDATE public.profiles SET
        branch_id = v_branch_id,
        role = 'School Administration',
        profile_completed = true
    WHERE id = auth.uid();

    -- Create/Update specialized profile
    INSERT INTO public.school_admin_profiles (user_id, onboarding_step)
    VALUES (auth.uid(), 'completed')
    ON CONFLICT (user_id) DO UPDATE SET onboarding_step = 'completed';

    -- Establish Initial Handshake Session
    INSERT INTO public.branch_handshake_sessions (branch_id, admin_user_id, status)
    VALUES (v_branch_id, auth.uid(), 'Online')
    ON CONFLICT (branch_id, admin_user_id) DO UPDATE SET 
        last_ping = NOW(),
        status = 'Online';

    -- Audit Log
    INSERT INTO public.handshake_audit_logs (branch_id, admin_user_id, target_email, event_type)
    VALUES (v_branch_id, auth.uid(), v_user_email, 'HANDSHAKE_SUCCESS');

    RETURN jsonb_build_object(
        'success', true, 
        'branch_id', v_branch_id, 
        'message', 'Handshake Secured. Welcome to the Institutional Network.'
    );
END;
$$;

-- RPC: Auto Handshake on Login (Stealth Sync)
DROP FUNCTION IF EXISTS public.auto_handshake_on_login() CASCADE;
CREATE OR REPLACE FUNCTION public.auto_handshake_on_login()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_branch_id BIGINT;
BEGIN
    -- Detect if current user is an authorized branch admin
    SELECT id INTO v_branch_id FROM public.school_branches WHERE admin_user_id = auth.uid();

    IF v_branch_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No associated node found.');
    END IF;

    -- Auto-Sync Handshake Session
    INSERT INTO public.branch_handshake_sessions (branch_id, admin_user_id, status)
    VALUES (v_branch_id, auth.uid(), 'Online')
    ON CONFLICT (branch_id, admin_user_id) DO UPDATE SET 
        last_ping = NOW(),
        status = 'Online';

    UPDATE public.school_branches SET 
        status = 'Online',
        last_sync_at = NOW()
    WHERE id = v_branch_id;

    RETURN jsonb_build_object('success', true, 'branch_id', v_branch_id, 'status', 'Online');
END;
$$;

-- RPC: Get Network Registry Metrics (Telemetry Isolation v9.6)
DROP FUNCTION IF EXISTS public.get_network_registry_metrics() CASCADE;
CREATE OR REPLACE FUNCTION public.get_network_registry_metrics()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_nodes INT;
    v_verified_links INT;
    v_online_nodes INT;
    v_protocol_health INT;
    v_is_head_office BOOLEAN;
    v_user_email TEXT;
BEGIN
    v_user_email := auth.jwt() ->> 'email';
    
    -- Detect Authority Level
    -- Head Office admins own the school record. Branch admins are associated via status/admin_user_id.
    SELECT EXISTS (
        SELECT 1 FROM public.school_admin_profiles WHERE user_id = auth.uid()
    ) INTO v_is_head_office;

    IF v_is_head_office THEN
        -- Master View: Reflect Global Network State
        SELECT COUNT(*) INTO v_total_nodes FROM public.school_branches;
        SELECT COUNT(*) INTO v_verified_links FROM public.school_branches WHERE status IN ('Verified', 'Online', 'Synced');
        SELECT COUNT(*) INTO v_online_nodes FROM public.branch_handshake_sessions WHERE status = 'Online' AND last_ping > NOW() - INTERVAL '5 minutes';
    ELSE
        -- Isolated View: Reflect strictly the branch's local state
        SELECT COUNT(*) INTO v_total_nodes FROM public.school_branches 
        WHERE admin_user_id = auth.uid() OR LOWER(admin_email) = LOWER(v_user_email);
        
        SELECT COUNT(*) INTO v_verified_links FROM public.school_branches 
        WHERE (admin_user_id = auth.uid() OR LOWER(admin_email) = LOWER(v_user_email)) 
        AND status IN ('Verified', 'Online', 'Synced');
        
        SELECT COUNT(*) INTO v_online_nodes FROM public.branch_handshake_sessions 
        WHERE admin_user_id = auth.uid() AND status = 'Online' AND last_ping > NOW() - INTERVAL '5 minutes';
    END IF;
    
    -- Health calc: Online / Total ratio (Scoped to the view)
    IF v_total_nodes > 0 THEN
        v_protocol_health := (v_online_nodes * 100) / v_total_nodes;
    ELSE
        v_protocol_health := 100;
    END IF;

    RETURN jsonb_build_object(
        'total_nodes', v_total_nodes,
        'verified_links', v_verified_links,
        'online_nodes', v_online_nodes,
        'protocol_health', v_protocol_health,
        'version', 'v9.6',
        'isolation_active', NOT v_is_head_office
    );
END;
$$;

COMMIT;
