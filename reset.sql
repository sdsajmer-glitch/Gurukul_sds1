-- Database Reset Script
-- Generated on 2026-01-31
-- This script performs a full reset of the database schema.
-- Dependencies: uuid-ossp, pgcrypto

BEGIN;

-- ============================================
-- 0. EXTENSIONS & SETUP
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. DROP EVERYTHING
-- ============================================

-- Disable FK checks temporarily
SET session_replication_role = 'replica';

-- Drop Tables (Reverse Order of Logic/Dependencies)
DROP TABLE IF EXISTS
  academic_years,
  admin_tasks,
  admission_audit_logs,
  admission_documents,
  admission_share_codes,
  admissions,
  assignment_submissions,
  assignments,
  attendance,
  attendance_records,
  audit_logs,
  bus_attendance,
  class_fee_assignments,
  class_subjects,
  class_timetables,
  communications,
  course_drafts,
  course_enrollments,
  course_logs,
  course_materials,
  course_modules,
  course_teachers,
  course_units,
  courses,
  document_requirements,
  ecommerce_operator_profiles,
  enquiries,
  enquiry_messages,
  enrollments,
  exam_results,
  exams,
  expense_categories,
  expense_invoices,
  expenses,
  fee_components,
  fee_invoices,
  fee_payments,
  fee_structures,
  finance_audit_trail,
  invoices,
  lesson_plan_resources,
  lesson_plans,
  parent_profiles,
  profiles,
  room_availability,
  routes,
  school_admin_profiles,
  school_branch_invitations,
  school_branches,
  school_classes,
  school_departments,
  school_expenses,
  share_codes,
  storage_buckets,
  storage_files,
  student_enrollments,
  student_fee_accounts,
  student_fee_assignments,
  student_invoices,
  student_parents,
  student_payments,
  student_profiles,
  student_transport_assignments,
  study_materials,
  teacher_availability,
  teacher_awards,
  teacher_documents,
  teacher_pd_records,
  teacher_profiles,
  teacher_subject_assignments,
  timetable_entries,
  transport_routes,
  transport_staff_profiles,
  transport_vehicles,
  user_role_assignments,
  user_roles,
  user_scope_assignments,
  vendors,
  verification_audit_logs,
  workshops
CASCADE;

-- Drop Enums / Types
DROP TYPE IF EXISTS academic_year_status CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS timetable_status CASCADE;
DROP TYPE IF EXISTS result_status CASCADE;
DROP TYPE IF EXISTS exam_status CASCADE;
DROP TYPE IF EXISTS invoice_status CASCADE;
DROP TYPE IF EXISTS fee_assignment_status CASCADE;
DROP TYPE IF EXISTS transport_status CASCADE;
DROP TYPE IF EXISTS vehicle_status CASCADE;

-- Drop Sequences
DROP SEQUENCE IF EXISTS invoice_number_seq;

-- Drop Functions (Custom)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Re-enable FK checks
SET session_replication_role = 'origin';


-- ============================================
-- 2. CREATE TYPES & SEQUENCES
-- ============================================

CREATE TYPE academic_year_status AS ENUM ('active', 'inactive', 'archived', 'upcoming');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE timetable_status AS ENUM ('active', 'inactive', 'draft');
CREATE TYPE result_status AS ENUM ('pending', 'published', 'draft', 'graded');
CREATE TYPE exam_status AS ENUM ('scheduled', 'completed', 'cancelled', 'ongoing');
CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled', 'partial');
CREATE TYPE fee_assignment_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE transport_status AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE vehicle_status AS ENUM ('active', 'inactive', 'maintenance', 'retired');

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

-- ============================================
-- 3. CREATE TABLES (With Inline PKs and Basic Defaults)
-- ============================================

-- >>> CORE HIERARCHY <<<

CREATE TABLE public.school_branches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_user_id uuid, -- FK deferred
  name text NOT NULL,
  address text,
  city text,
  state text,
  country text,
  contact_number text,
  email text,
  is_main_branch boolean DEFAULT false,
  admin_name text,
  admin_phone text,
  admin_email text,
  branch_admin_id uuid, -- FK deferred
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, -- Maps to auth.users.id usually
  email text NOT NULL UNIQUE,
  display_name text,
  phone text,
  role text,
  branch_id bigint, -- FK deferred
  is_super_admin boolean DEFAULT false,
  is_active boolean DEFAULT true,
  profile_completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  email_confirmed_at timestamp with time zone,
  profile_photo_url text
);

CREATE TABLE public.school_classes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  grade_level text,
  section text,
  academic_year text,
  class_teacher_id uuid REFERENCES public.profiles(id),
  branch_id bigint REFERENCES public.school_branches(id),
  capacity integer DEFAULT 30,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.academic_years (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint REFERENCES public.school_branches(id),
  year_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  status academic_year_status DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.courses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  code text,
  grade_level text,
  credits numeric,
  category text,
  subject_type text,
  status text DEFAULT 'Active',
  description text,
  teacher_id uuid REFERENCES public.profiles(id),
  syllabus_pdf_url text,
  department text,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fee_structures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  academic_year text,
  description text,
  branch_id bigint REFERENCES public.school_branches(id),
  currency text DEFAULT 'INR',
  is_active boolean DEFAULT false,
  status text DEFAULT 'Draft',
  target_grade text DEFAULT '1',
  version_locked boolean DEFAULT false,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- >>> OPERATIONAL TABLES <<<

CREATE TABLE public.admin_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id bigint REFERENCES public.school_branches(id),
  title text NOT NULL,
  description text,
  priority text CHECK (priority IN ('URGENT', 'HIGH', 'MEDIUM', 'LOW')) DEFAULT 'MEDIUM',
  category text DEFAULT 'General',
  status text CHECK (status IN ('Todo', 'Completed')) DEFAULT 'Todo',
  due_date timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.enquiries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id bigint REFERENCES public.school_branches(id),
  user_id uuid REFERENCES public.profiles(id),
  enquiry_code text,
  applicant_name text NOT NULL,
  grade text,
  status text DEFAULT 'NEW',
  verification_status text DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED')),
  parent_name text,
  parent_email text,
  parent_phone text,
  notes text,
  conversion_state text DEFAULT 'NOT_CONVERTED' CHECK (conversion_state IN ('NOT_CONVERTED', 'CONVERTED')),
  admission_id uuid UNIQUE, -- Circular ref to admissions deferred if strict, but uuid ok
  is_archived boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  received_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  converted_at timestamp with time zone
);

CREATE TABLE public.admissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id integer, -- should be bigint really, matching school_branches
  applicant_name text NOT NULL,
  parent_id uuid REFERENCES public.profiles(id),
  parent_name text,
  parent_email text NOT NULL,
  parent_phone text,
  grade text NOT NULL,
  status text DEFAULT 'Registered',
  application_number text,
  student_user_id uuid REFERENCES public.profiles(id),
  date_of_birth date,
  gender text,
  profile_photo_url text,
  medical_info text,
  emergency_contact text,
  notes text,
  submitted_at timestamp with time zone DEFAULT now(),
  registered_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.admission_documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id uuid REFERENCES public.admissions(id),
  requirement_id bigint, -- FK added later or assumed table exists
  uploaded_by uuid REFERENCES public.profiles(id),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  status text DEFAULT 'Pending',
  file_size bigint,
  mime_type text,
  uploaded_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.document_requirements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id uuid REFERENCES public.admissions(id),
  document_name text NOT NULL,
  status text DEFAULT 'Pending',
  is_mandatory boolean DEFAULT true,
  notes_for_parent text,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
-- Add missing FK from admission_documents to document_requirements
ALTER TABLE public.admission_documents
ADD CONSTRAINT admission_documents_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.document_requirements(id);


CREATE TABLE public.student_enrollments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid REFERENCES public.profiles(id), -- assumed student is a profile
  branch_id bigint NOT NULL REFERENCES public.school_branches(id),
  academic_year text,
  enrollment_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Graduated', 'Transferred')),
  roll_number text,
  student_id_number text,
  parent_guardian_details text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.student_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  branch_id bigint REFERENCES public.school_branches(id),
  admission_id bigint, -- or uuid? admissions.id is uuid. 
  assigned_class_id bigint REFERENCES public.school_classes(id),
  grade text,
  roll_number text,
  student_id_number text,
  parent_guardian_details text,
  address text,
  gender text,
  date_of_birth date,
  enrollment_status text DEFAULT 'Enrolled',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
-- Fix admission_id type mismatch if any (admissions is UUID)
-- ALTER TABLE public.student_profiles ALTER COLUMN admission_id TYPE uuid USING admission_id::uuid; -- If needed. Assuming kept as bigint in legacy or schema, but best to match.
-- For this script I will assume admission_id in student_profiles is meant to link to admissions(id) which is UUID.
-- However, strict typing:
ALTER TABLE public.student_profiles DROP COLUMN IF EXISTS admission_id;
ALTER TABLE public.student_profiles ADD COLUMN admission_id uuid REFERENCES public.admissions(id);


CREATE TABLE public.parent_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  relationship_to_student text,
  gender text,
  number_of_children integer,
  address text,
  country text,
  state text,
  city text,
  pin_code text,
  secondary_parent_name text,
  secondary_parent_relationship text,
  secondary_parent_gender text,
  secondary_parent_email text,
  secondary_parent_phone text
);

CREATE TABLE public.teacher_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  branch_id bigint REFERENCES public.school_branches(id),
  subject text,
  qualification text,
  experience_years numeric,
  date_of_joining date,
  bio text,
  specializations text,
  profile_picture_url text,
  gender text,
  date_of_birth date,
  department text,
  designation text,
  employee_id text,
  employment_type text,
  employment_status text DEFAULT 'Pending Verification',
  salary text,
  bank_details text
);

CREATE TABLE public.school_admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id), -- Removed FK check for safety in circular, but logically correct
  school_name text,
  address text,
  city text,
  state text,
  country text DEFAULT 'India',
  admin_contact_name text,
  admin_contact_phone text,
  admin_contact_email text,
  onboarding_step text DEFAULT 'profile',
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  is_system_role boolean DEFAULT false,
  permissions jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_role_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id),
  role_name text REFERENCES public.user_roles(name),
  branch_id bigint REFERENCES public.school_branches(id),
  assigned_by uuid REFERENCES public.profiles(id),
  assigned_at timestamp with time zone DEFAULT now()
);

-- >>> ACADEMIC & LMS <<<

CREATE TABLE public.assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id bigint REFERENCES public.school_classes(id),
  subject_id bigint REFERENCES public.courses(id),
  teacher_id uuid REFERENCES public.profiles(id),
  title text NOT NULL,
  description text,
  due_date timestamp with time zone,
  status text DEFAULT 'Draft',
  max_score integer DEFAULT 100,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.assignment_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id bigint REFERENCES public.assignments(id),
  student_id uuid REFERENCES public.profiles(id),
  file_path text,
  file_name text,
  status text DEFAULT 'Submitted',
  grade text,
  feedback text,
  submitted_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.attendance (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid REFERENCES public.profiles(id),
  class_id bigint REFERENCES public.school_classes(id),
  attendance_date date NOT NULL,
  status text,
  notes text,
  late_time text,
  absence_reason text,
  recorded_by uuid REFERENCES public.profiles(id),
  marked_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.class_timetables (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id bigint REFERENCES public.school_classes(id),
  day_of_week text CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  course_id bigint REFERENCES public.courses(id),
  teacher_id uuid REFERENCES public.profiles(id),
  room_number text,
  subject_name text,
  status timetable_status DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- >>> FINANCE <<<

CREATE TABLE public.fee_components (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  structure_id bigint REFERENCES public.fee_structures(id),
  name text NOT NULL,
  amount numeric NOT NULL,
  frequency text DEFAULT 'Monthly',
  is_mandatory boolean DEFAULT true
);

CREATE TABLE public.fee_invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint REFERENCES public.school_branches(id),
  student_id uuid REFERENCES public.profiles(id),
  fee_structure_id bigint REFERENCES public.fee_structures(id),
  invoice_number text UNIQUE DEFAULT ('INV-' || nextval('invoice_number_seq')::text),
  due_date date NOT NULL,
  total_amount numeric NOT NULL,
  paid_amount numeric DEFAULT 0,
  status invoice_status DEFAULT 'pending',
  payment_method text,
  academic_year text,
  description text,
  billing_month text,
  billing_year text,
  is_auto_generated boolean DEFAULT false,
  storage_bucket text DEFAULT 'school_invoices',
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.fee_payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint REFERENCES public.school_branches(id),
  invoice_id bigint REFERENCES public.fee_invoices(id),
  student_id uuid REFERENCES public.profiles(id),
  amount numeric NOT NULL,
  payment_date timestamp with time zone DEFAULT now(),
  payment_method text,
  transaction_id text,
  receipt_number text,
  status text DEFAULT 'Completed',
  collected_by uuid,
  recorded_by uuid REFERENCES public.profiles(id),
  notes text,
  method_details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint REFERENCES public.school_branches(id),
  amount numeric NOT NULL,
  vendor_name text, -- or FK to vendors
  expense_date date NOT NULL,
  status text DEFAULT 'Pending',
  description text,
  invoice_url text,
  category_id integer, -- FK to expense_categories
  payment_mode text,
  recorded_by uuid REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id), -- assuming auth.users ref, but profiles safer
  recorded_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  approved_at timestamp with time zone
);

CREATE TABLE public.expense_categories (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id);


-- >>> TRANSPORT <<<

CREATE TABLE public.transport_routes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint REFERENCES public.school_branches(id),
  route_name text NOT NULL,
  description text,
  start_location text,
  end_location text,
  estimated_duration_minutes integer,
  fare numeric,
  capacity integer,
  status transport_status DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.transport_vehicles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  route_id bigint REFERENCES public.transport_routes(id),
  vehicle_number text NOT NULL UNIQUE,
  vehicle_type text,
  capacity integer,
  driver_id uuid, -- could conform to profile FK
  conductor_id uuid,
  fuel_type text,
  status vehicle_status DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.student_transport_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid REFERENCES public.profiles(id),
  route_id bigint REFERENCES public.transport_routes(id),
  pickup_location text,
  drop_location text,
  is_active boolean DEFAULT true,
  assigned_date date DEFAULT CURRENT_DATE,
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- ============================================
-- 4. CIRCULAR DEPENDENCIES & CONSTRAINTS
-- ============================================

ALTER TABLE public.school_branches
  ADD CONSTRAINT fk_school_branches_school_user_id FOREIGN KEY (school_user_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT fk_school_branches_branch_admin_id FOREIGN KEY (branch_admin_id) REFERENCES public.profiles(id);

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_branch_id FOREIGN KEY (branch_id) REFERENCES public.school_branches(id);

-- Enquiries -> Admission (One to One optional)
-- Altered inline above or here:
-- ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


-- ============================================
-- 5. INDEXES (PERFORMANCE)
-- ============================================

-- Create indexes on all Foreign Keys and commonly filtered columns
CREATE INDEX idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

CREATE INDEX idx_school_classes_branch_id ON public.school_classes(branch_id);
CREATE INDEX idx_school_classes_teacher_id ON public.school_classes(class_teacher_id);

CREATE INDEX idx_courses_teacher_id ON public.courses(teacher_id);

CREATE INDEX idx_assignments_class_id ON public.assignments(class_id);
CREATE INDEX idx_assignments_subject_id ON public.assignments(subject_id);

CREATE INDEX idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX idx_attendance_class_id ON public.attendance(class_id);
CREATE INDEX idx_attendance_date ON public.attendance(attendance_date);

CREATE INDEX idx_fee_invoices_student_id ON public.fee_invoices(student_id);
CREATE INDEX idx_fee_invoices_branch_id ON public.fee_invoices(branch_id);
CREATE INDEX idx_fee_invoices_status ON public.fee_invoices(status);

CREATE INDEX idx_student_enrollments_branch_id ON public.student_enrollments(branch_id);
CREATE INDEX idx_student_enrollments_student_id ON public.student_enrollments(student_id);

CREATE INDEX idx_enquiries_branch_id ON public.enquiries(branch_id);
CREATE INDEX idx_enquiries_status ON public.enquiries(status);

CREATE INDEX idx_admissions_branch_id ON public.admissions(branch_id);
CREATE INDEX idx_admissions_status ON public.admissions(status);

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.school_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;

-- Basic Policies
-- 1. Profiles: Reading own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 2. Profiles: Updating own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 3. Branch Data: Public read for login (or specific role based)
CREATE POLICY "Public can view branches" ON public.school_branches
  FOR SELECT USING (true);

-- 4. School Admins can view everything in their branch
-- (Requires complex policy or role logic, simplifying for reset script)
-- CREATE POLICY "Admins view branch data" ON public.school_classes
--   FOR ALL USING (branch_id IN (SELECT branch_id FROM public.profiles WHERE id = auth.uid() AND role IN ('School Administration', 'Branch Admin')));

-- ============================================
-- 7. FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'Student')
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
