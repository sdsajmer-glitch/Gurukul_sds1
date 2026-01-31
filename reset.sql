-- Database Reset Script
-- Generated on 2026-01-31
-- This script performs a full reset of the database schema.
-- Dependencies: uuid-ossp, pgcrypto

BEGIN;

-- ============================================
-- 0. EXTENSIONS & CONFIGURATION
-- ============================================

-- Drop Extensions (if applicable)
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Disable FK checks temporarily for bulk dropping
SET session_replication_role = 'replica';

-- ============================================
-- 1. DROP EVERYTHING
-- ============================================

-- Drop Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS trg_on_student_placement ON public.student_profiles CASCADE;

-- Drop Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public can view branches" ON public.school_branches;

-- Drop Functions (Comprehensive)
DROP FUNCTION IF EXISTS public.admin_generate_bulk_invoices CASCADE;
DROP FUNCTION IF EXISTS public.admin_quick_add_student CASCADE;
DROP FUNCTION IF EXISTS public.admin_reconcile_student_account CASCADE;
DROP FUNCTION IF EXISTS public.admin_sync_student_billing CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status CASCADE;
DROP FUNCTION IF EXISTS public.admin_verify_enquiry_code CASCADE;
DROP FUNCTION IF EXISTS public.complete_branch_step CASCADE;
DROP FUNCTION IF EXISTS public.convert_enquiry_to_admission CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_ledger_for_student CASCADE;
DROP FUNCTION IF EXISTS public.get_all_classes_for_admin CASCADE;
DROP FUNCTION IF EXISTS public.get_all_teachers_for_admin CASCADE;
DROP FUNCTION IF EXISTS public.get_all_users_for_admin CASCADE;
DROP FUNCTION IF EXISTS public.get_class_roster CASCADE;
DROP FUNCTION IF EXISTS public.get_finance_dashboard_data CASCADE;
DROP FUNCTION IF EXISTS public.get_school_branches CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_nodes CASCADE;
DROP FUNCTION IF EXISTS public.get_student_running_ledger CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.initialize_school_admin CASCADE;
DROP FUNCTION IF EXISTS public.reconcile_finance_registry_v2 CASCADE;
DROP FUNCTION IF EXISTS public.switch_active_role CASCADE;
DROP FUNCTION IF EXISTS public.trigger_on_student_placement CASCADE;
DROP FUNCTION IF EXISTS public.update_school_plan CASCADE;
DROP FUNCTION IF EXISTS public.upsert_ecommerce_profile CASCADE;
DROP FUNCTION IF EXISTS public.upsert_parent_profile CASCADE;
DROP FUNCTION IF EXISTS public.upsert_student_profile CASCADE;
DROP FUNCTION IF EXISTS public.upsert_teacher_profile CASCADE;
DROP FUNCTION IF EXISTS public.upsert_transport_profile CASCADE;
DROP FUNCTION IF EXISTS public.verify_and_link_branch_admin CASCADE;

-- Drop Tables (Comprehensive list)
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
-- 3. CREATE TABLES (NO FOREIGN KEYS YET)
-- ============================================

CREATE TABLE public.school_branches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_user_id uuid, 
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
  branch_admin_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text,
  phone text,
  role text,
  branch_id bigint,
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
  class_teacher_id uuid,
  branch_id bigint,
  capacity integer DEFAULT 30,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.academic_years (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint,
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
  teacher_id uuid,
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
  branch_id bigint,
  currency text DEFAULT 'INR',
  is_active boolean DEFAULT false,
  status text DEFAULT 'Draft',
  target_grade text DEFAULT '1',
  version_locked boolean DEFAULT false,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.admin_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id bigint,
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
  branch_id bigint,
  user_id uuid,
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
  admission_id uuid,
  is_archived boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  received_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  converted_at timestamp with time zone
);

CREATE TABLE public.admissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id integer,
  applicant_name text NOT NULL,
  parent_id uuid,
  parent_name text,
  parent_email text NOT NULL,
  parent_phone text,
  grade text NOT NULL,
  status text DEFAULT 'Registered',
  application_number text,
  student_user_id uuid,
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

CREATE TABLE public.document_requirements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id uuid,
  document_name text NOT NULL,
  status text DEFAULT 'Pending',
  is_mandatory boolean DEFAULT true,
  notes_for_parent text,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.admission_documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id uuid,
  requirement_id bigint,
  uploaded_by uuid,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  status text DEFAULT 'Pending',
  file_size bigint,
  mime_type text,
  uploaded_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.student_enrollments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid,
  branch_id bigint NOT NULL,
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
  user_id uuid PRIMARY KEY,
  branch_id bigint,
  admission_id uuid,
  assigned_class_id bigint,
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

CREATE TABLE public.parent_profiles (
  user_id uuid PRIMARY KEY,
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
  user_id uuid PRIMARY KEY,
  branch_id bigint,
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
  user_id uuid PRIMARY KEY,
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
  user_id uuid,
  role_name text,
  branch_id bigint,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id bigint,
  subject_id bigint,
  teacher_id uuid,
  title text NOT NULL,
  description text,
  due_date timestamp with time zone,
  status text DEFAULT 'Draft',
  max_score integer DEFAULT 100,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.assignment_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id bigint,
  student_id uuid,
  file_path text,
  file_name text,
  status text DEFAULT 'Submitted',
  grade text,
  feedback text,
  submitted_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.attendance (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid,
  class_id bigint,
  attendance_date date NOT NULL,
  status text,
  notes text,
  late_time text,
  absence_reason text,
  recorded_by uuid,
  marked_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.class_timetables (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id bigint,
  day_of_week text CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  course_id bigint,
  teacher_id uuid,
  room_number text,
  subject_name text,
  status timetable_status DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.fee_components (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  structure_id bigint,
  name text NOT NULL,
  amount numeric NOT NULL,
  frequency text DEFAULT 'Monthly',
  is_mandatory boolean DEFAULT true
);

CREATE TABLE public.fee_invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint,
  student_id uuid,
  fee_structure_id bigint,
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
  branch_id bigint,
  invoice_id bigint,
  student_id uuid,
  amount numeric NOT NULL,
  payment_date timestamp with time zone DEFAULT now(),
  payment_method text,
  transaction_id text,
  receipt_number text,
  status text DEFAULT 'Completed',
  collected_by uuid,
  recorded_by uuid,
  notes text,
  method_details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.expense_categories (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint,
  amount numeric NOT NULL,
  vendor_name text,
  expense_date date NOT NULL,
  status text DEFAULT 'Pending',
  description text,
  invoice_url text,
  category_id integer,
  payment_mode text,
  recorded_by uuid,
  approved_by uuid,
  recorded_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  approved_at timestamp with time zone
);

CREATE TABLE public.transport_routes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint,
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
  route_id bigint,
  vehicle_number text NOT NULL UNIQUE,
  vehicle_type text,
  capacity integer,
  driver_id uuid,
  conductor_id uuid,
  fuel_type text,
  status vehicle_status DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.student_transport_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid,
  route_id bigint,
  pickup_location text,
  drop_location text,
  is_active boolean DEFAULT true,
  assigned_date date DEFAULT CURRENT_DATE,
  assigned_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Additional tables from Table_Schema.txt (making sure everything is covered)

CREATE TABLE public.admission_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_type text NOT NULL,
  previous_status text,
  new_status text,
  details jsonb DEFAULT '{}'::jsonb,
  changed_by uuid,
  changed_by_name text,
  created_at timestamp with time zone DEFAULT now(),
  admission_id uuid
);

CREATE TABLE public.admission_share_codes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  admission_id bigint,
  enquiry_id bigint,
  code_type text NOT NULL,
  status text DEFAULT 'Active',
  purpose text,
  expires_at timestamp with time zone DEFAULT (now() + '1 day'::interval),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.attendance_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid,
  class_id bigint,
  attendance_date date NOT NULL,
  status attendance_status DEFAULT 'present',
  notes text,
  marked_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,
  module text,
  details jsonb DEFAULT '{}'::jsonb,
  severity text DEFAULT 'info',
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.bus_attendance (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL,
  route_id bigint NOT NULL,
  trip_date date NOT NULL,
  trip_type text NOT NULL,
  status text,
  marked_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.class_fee_assignments (
  class_id bigint NOT NULL PRIMARY KEY,
  structure_id bigint NOT NULL
);

CREATE TABLE public.class_subjects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id bigint NOT NULL,
  subject_id bigint NOT NULL,
  teacher_id uuid
);

CREATE TABLE public.communications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject text,
  body text,
  sender_id uuid,
  sender_name text,
  sender_role text,
  recipients text[],
  target_criteria jsonb,
  status text DEFAULT 'Sent',
  sent_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.course_drafts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL,
  version_number integer NOT NULL,
  data jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  commit_message text
);

CREATE TABLE public.course_enrollments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL,
  course_id bigint NOT NULL,
  enrolled_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.course_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL,
  user_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.course_units (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL,
  title text NOT NULL,
  description text,
  order_index integer,
  duration_hours numeric,
  status text DEFAULT 'Draft',
  learning_objectives text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.course_materials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL,
  unit_id bigint,
  title text NOT NULL,
  file_path text,
  file_type text,
  url text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.course_modules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL,
  title text NOT NULL,
  order_index integer,
  status text,
  duration_hours numeric
);

CREATE TABLE public.course_teachers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL,
  teacher_id uuid NOT NULL,
  role text DEFAULT 'Primary',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ecommerce_operator_profiles (
  user_id uuid PRIMARY KEY,
  store_name text,
  business_type text
);

CREATE TABLE public.enquiry_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  enquiry_id uuid NOT NULL,
  sender_id uuid,
  message text,
  is_admin_message boolean,
  created_at timestamp with time zone DEFAULT now(),
  is_admin boolean DEFAULT false
);

CREATE TABLE public.enrollments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid,
  branch_id bigint,
  academic_year text NOT NULL,
  grade text NOT NULL,
  application_status text DEFAULT 'ADMITTED',
  enrollment_status text DEFAULT 'FINALIZED',
  class_id bigint,
  enrollment_date date DEFAULT CURRENT_DATE,
  roll_number text,
  student_id_number text,
  parent_guardian_details text,
  admission_id bigint,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.exams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint,
  class_id bigint,
  title text NOT NULL,
  exam_type text,
  exam_date timestamp with time zone NOT NULL,
  duration_minutes integer,
  total_marks integer DEFAULT 100,
  instructions text,
  room_number text,
  status exam_status DEFAULT 'scheduled',
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.exam_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam_id bigint,
  student_id uuid,
  marks_obtained integer,
  grade text,
  rank integer,
  status result_status DEFAULT 'pending',
  remarks text,
  graded_by uuid,
  graded_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.vendors (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  contact_person text,
  contact_email text,
  category text,
  branch_id bigint,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.expense_invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expense_id bigint,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.finance_audit_trail (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint,
  actor_id uuid,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action_type text NOT NULL,
  magnitude numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.school_expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  vendor_name text,
  expense_date date DEFAULT CURRENT_DATE,
  payment_mode text,
  status text DEFAULT 'Approved',
  invoice_url text,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL,
  structure_id bigint,
  description text,
  amount numeric NOT NULL,
  amount_paid numeric DEFAULT 0,
  due_date date,
  status text DEFAULT 'Pending',
  created_at timestamp with time zone DEFAULT now(),
  expense_id bigint
);

CREATE TABLE public.lesson_plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_id uuid,
  class_id bigint,
  subject_id bigint,
  title text,
  lesson_date date,
  objectives text,
  activities text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.lesson_plan_resources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_plan_id bigint,
  file_name text,
  file_path text,
  file_type text
);

CREATE TABLE public.room_availability (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_name text,
  day text,
  start_time text,
  end_time text,
  is_booked boolean DEFAULT false,
  booked_by_class_id bigint
);

CREATE TABLE public.school_branch_invitations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint,
  code text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  is_revoked boolean DEFAULT false,
  redeemed_at timestamp with time zone,
  redeemed_by uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.school_departments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  description text,
  hod_id uuid,
  branch_id bigint,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.share_codes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  status text DEFAULT 'Active',
  code_type text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  purpose text,
  created_by uuid,
  redeemed_at timestamp with time zone
);

CREATE TABLE public.storage_buckets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  file_size_limit bigint DEFAULT 5242880,
  allowed_mime_types text[],
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.storage_files (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_name text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.student_fee_accounts (
  student_id uuid PRIMARY KEY,
  branch_id bigint,
  total_billed numeric DEFAULT 0,
  total_paid numeric DEFAULT 0,
  outstanding_balance numeric DEFAULT 0,
  integrity_score integer DEFAULT 100,
  last_reconciled_at timestamp with time zone DEFAULT now(),
  last_synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  last_reconciled timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  unallocated_funds numeric DEFAULT 0
);

CREATE TABLE public.student_fee_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid,
  fee_structure_id bigint,
  assigned_date date DEFAULT CURRENT_DATE,
  status fee_assignment_status DEFAULT 'active',
  discount_percentage numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  assigned_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.student_invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL,
  branch_id bigint,
  structure_id bigint,
  description text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.student_parents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  relationship text,
  is_primary boolean DEFAULT false
);

CREATE TABLE public.student_payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id bigint NOT NULL,
  student_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  transaction_reference text,
  recorded_by uuid,
  payment_date timestamp with time zone DEFAULT now()
);

CREATE TABLE public.study_materials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id bigint,
  subject_id bigint,
  title text,
  description text,
  file_path text,
  file_name text,
  file_type text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  is_bookmarked boolean DEFAULT false
);

CREATE TABLE public.teacher_availability (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_id uuid,
  day text,
  start_time text,
  end_time text,
  is_available boolean DEFAULT true
);

CREATE TABLE public.teacher_awards (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_id uuid,
  award_name text,
  awarded_date date,
  points integer
);

CREATE TABLE public.teacher_documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_id uuid,
  document_name text,
  document_type text,
  file_path text,
  status text DEFAULT 'Pending',
  rejection_reason text,
  uploaded_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.workshops (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text,
  description text,
  workshop_date date,
  points integer DEFAULT 10,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.teacher_pd_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_id uuid,
  workshop_id bigint,
  completed_at timestamp with time zone DEFAULT now(),
  points_earned integer,
  notes text
);

CREATE TABLE public.teacher_subject_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_id uuid,
  course_id bigint,
  class_id bigint,
  academic_year text,
  workload_hours integer DEFAULT 1,
  is_primary boolean DEFAULT false,
  status text DEFAULT 'Active',
  assigned_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.timetable_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id bigint,
  day text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  subject_name text,
  teacher_name text,
  room_number text,
  teacher_id uuid,
  subject_id bigint,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.transport_staff_profiles (
  user_id uuid PRIMARY KEY,
  route_id bigint,
  vehicle_details text,
  license_info text
);

CREATE TABLE public.user_scope_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  role_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  scope_data jsonb DEFAULT '{}'::jsonb,
  assigned_at timestamp with time zone DEFAULT now(),
  activated_at timestamp with time zone,
  created_by uuid
);

CREATE TABLE public.verification_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL,
  code_type text NOT NULL,
  admission_id bigint,
  enquiry_id bigint,
  applicant_name text,
  result text NOT NULL,
  error_message text,
  branch_id bigint,
  verified_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.routes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text,
    description text
);


-- ============================================
-- 4. ADD FOREIGN KEYS
-- ============================================

-- School Branches
ALTER TABLE public.school_branches
  ADD CONSTRAINT school_branches_school_user_id_fkey FOREIGN KEY (school_user_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT school_branches_branch_admin_id_fkey FOREIGN KEY (branch_admin_id) REFERENCES public.profiles(id);

-- Profiles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id);

-- School Classes
ALTER TABLE public.school_classes
  ADD CONSTRAINT school_classes_class_teacher_id_fkey FOREIGN KEY (class_teacher_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT school_classes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id);

-- Academic Years
ALTER TABLE public.academic_years
  ADD CONSTRAINT academic_years_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id);

-- Courses
ALTER TABLE public.courses
  ADD CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id);

-- Fee Structures
ALTER TABLE public.fee_structures
  ADD CONSTRAINT fee_structures_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id);

-- Admin Tasks
ALTER TABLE public.admin_tasks
  ADD CONSTRAINT admin_tasks_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id);

-- Enquiries
ALTER TABLE public.enquiries
  ADD CONSTRAINT enquiries_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id),
  ADD CONSTRAINT enquiries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- Admissions
ALTER TABLE public.admissions
  ADD CONSTRAINT admissions_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT admissions_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES public.profiles(id);

-- Document Requirements
ALTER TABLE public.document_requirements
  ADD CONSTRAINT document_requirements_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Admission Documents
ALTER TABLE public.admission_documents
  ADD CONSTRAINT admission_documents_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id),
  ADD CONSTRAINT admission_documents_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.document_requirements(id),
  ADD CONSTRAINT admission_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);

-- Student Enrollments
ALTER TABLE public.student_enrollments
  ADD CONSTRAINT student_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT student_enrollments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id);

-- Student Profiles
ALTER TABLE public.student_profiles
  ADD CONSTRAINT student_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT student_profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id),
  ADD CONSTRAINT student_profiles_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id),
  ADD CONSTRAINT student_profiles_assigned_class_id_fkey FOREIGN KEY (assigned_class_id) REFERENCES public.school_classes(id);

-- Parent Profiles
ALTER TABLE public.parent_profiles
  ADD CONSTRAINT parent_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- Teacher Profiles
ALTER TABLE public.teacher_profiles
  ADD CONSTRAINT teacher_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT teacher_profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id);

-- School Admin Profiles (Self Ref if needed, mainly profile ext)
ALTER TABLE public.school_admin_profiles
  ADD CONSTRAINT school_admin_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- User Role Assignments
ALTER TABLE public.user_role_assignments
  ADD CONSTRAINT user_role_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT user_role_assignments_role_name_fkey FOREIGN KEY (role_name) REFERENCES public.user_roles(name),
  ADD CONSTRAINT user_role_assignments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id),
  ADD CONSTRAINT user_role_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id);

-- Assignments
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.school_classes(id),
  ADD CONSTRAINT assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.courses(id),
  ADD CONSTRAINT assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id);

-- Assignment Submissions
ALTER TABLE public.assignment_submissions
  ADD CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id),
  ADD CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);

-- Attendance
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.school_classes(id),
  ADD CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id);

-- Class Timetables
ALTER TABLE public.class_timetables
  ADD CONSTRAINT class_timetables_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.school_classes(id),
  ADD CONSTRAINT class_timetables_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  ADD CONSTRAINT class_timetables_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id);

-- Fee Components
ALTER TABLE public.fee_components
  ADD CONSTRAINT fee_components_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.fee_structures(id);

-- Fee Invoices
ALTER TABLE public.fee_invoices
  ADD CONSTRAINT fee_invoices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id),
  ADD CONSTRAINT fee_invoices_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT fee_invoices_fee_structure_id_fkey FOREIGN KEY (fee_structure_id) REFERENCES public.fee_structures(id);

-- Fee Payments
ALTER TABLE public.fee_payments
  ADD CONSTRAINT fee_payments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id),
  ADD CONSTRAINT fee_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.fee_invoices(id),
  ADD CONSTRAINT fee_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT fee_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id);

-- Expenses
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id),
  ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id),
  ADD CONSTRAINT expenses_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id);

-- Transport Routes
ALTER TABLE public.transport_routes
  ADD CONSTRAINT transport_routes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id);

-- Transport Vehicles
ALTER TABLE public.transport_vehicles
  ADD CONSTRAINT transport_vehicles_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.transport_routes(id);

-- Student Transport Assignments
ALTER TABLE public.student_transport_assignments
  ADD CONSTRAINT student_transport_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT student_transport_assignments_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.transport_routes(id),
  ADD CONSTRAINT student_transport_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id);

-- Enquiry Messages
ALTER TABLE public.enquiry_messages
  ADD CONSTRAINT enquiry_messages_enquiry_id_fkey FOREIGN KEY (enquiry_id) REFERENCES public.enquiries(id),
  ADD CONSTRAINT enquiry_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);

-- Share Codes (Admission)
ALTER TABLE public.share_codes
  ADD CONSTRAINT share_codes_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Student Fee Accounts
ALTER TABLE public.student_fee_accounts
  ADD CONSTRAINT student_fee_accounts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT student_fee_accounts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.school_branches(id);

-- ============================================
-- 5. INDEXES (PERFORMANCE)
-- ============================================

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
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_transport_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_share_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_files ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Examples, extend as needed)

-- 1. Profiles: Reading own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);


-- 2. Profiles: Updating own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2b. Profiles: Inserting own profile (Self-healing)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Public Read for School Branches (for login/enquiry)
CREATE POLICY "Public can view branches" ON public.school_branches
  FOR SELECT USING (true);


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


-- Switch Active Role Function
CREATE OR REPLACE FUNCTION public.switch_active_role(p_target_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  UPDATE public.profiles
  SET role = p_target_role
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Verify Branch Invitation
CREATE OR REPLACE FUNCTION public.verify_and_link_branch_admin(p_invitation_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_invitation record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Find valid invitation
  SELECT * INTO v_invitation
  FROM public.school_branch_invitations
  WHERE code = p_invitation_code
    AND expires_at > now()
    AND is_revoked = false
    AND redeemed_at IS NULL;

  IF v_invitation IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired access key');
  END IF;

  -- Update Invitation
  UPDATE public.school_branch_invitations
  SET redeemed_at = now(),
      redeemed_by = v_user_id
  WHERE id = v_invitation.id;

  -- Link user to branch
  UPDATE public.profiles
  SET role = 'School Administration', 
      branch_id = v_invitation.branch_id
  WHERE id = v_user_id;
  
  -- Update school_branches table
  UPDATE public.school_branches
  SET branch_admin_id = v_user_id
  WHERE id = v_invitation.branch_id;

  RETURN jsonb_build_object('success', true, 'branch_id', v_invitation.branch_id);
END;
$$;


-- Get All Users (Admin)
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.profiles ORDER BY created_at DESC;
$$;

-- Verify Enquiry Code
CREATE OR REPLACE FUNCTION public.admin_verify_enquiry_code(p_code text, p_branch_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enquiry_id uuid;
BEGIN
  SELECT id INTO v_enquiry_id FROM public.enquiries 
  WHERE enquiry_code = p_code AND (branch_id = p_branch_id OR p_branch_id IS NULL)
  LIMIT 1;
  
  IF v_enquiry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Verified', 'enquiry_id', v_enquiry_id);
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid Code');
  END IF;
END;
$$;

-- Update Enquiry Status
CREATE OR REPLACE FUNCTION public.admin_update_enquiry_status(p_enquiry_id uuid, p_status text, p_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.enquiries SET status = p_status, notes = COALESCE(p_notes, notes) WHERE id = p_enquiry_id;
END;
$$;

-- Convert Enquiry to Admission
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_admission(p_enquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enquiry record;
  v_admission_id uuid;
BEGIN
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id;
  IF v_enquiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enquiry not found');
  END IF;

  INSERT INTO public.admissions (
    branch_id, applicant_name, parent_name, parent_email, parent_phone, grade, status
  ) VALUES (
    v_enquiry.branch_id::integer, v_enquiry.applicant_name, v_enquiry.parent_name, v_enquiry.parent_email, v_enquiry.parent_phone, v_enquiry.grade, 'Registered'
  ) RETURNING id INTO v_admission_id;

  UPDATE public.enquiries SET conversion_state = 'CONVERTED', admission_id = v_admission_id WHERE id = p_enquiry_id;

  RETURN jsonb_build_object('success', true, 'admission_id', v_admission_id);
END;
$$;

-- Finance Dashboard Data
CREATE OR REPLACE FUNCTION public.get_finance_dashboard_data(p_branch_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_revenue numeric;
  v_pending numeric;
  v_monthly numeric;
  v_online numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_revenue FROM public.fee_payments WHERE (branch_id = p_branch_id OR p_branch_id IS NULL);
  SELECT COALESCE(SUM(total_amount - paid_amount), 0) INTO v_pending FROM public.fee_invoices WHERE (branch_id = p_branch_id OR p_branch_id IS NULL) AND status != 'paid';
  SELECT COALESCE(SUM(amount), 0) INTO v_monthly FROM public.fee_payments WHERE (branch_id = p_branch_id OR p_branch_id IS NULL) AND payment_date >= date_trunc('month', now());
  SELECT COALESCE(SUM(amount), 0) INTO v_online FROM public.fee_payments WHERE (branch_id = p_branch_id OR p_branch_id IS NULL) AND payment_method = 'Online';
  
  RETURN jsonb_build_object(
    'revenue_ytd', v_revenue,
    'pending_dues', v_pending,
    'collections_this_month', v_monthly,
    'online_payments', v_online
  );
END;
$$;

-- Student Financial Nodes
-- ============================================
-- ENHANCED FINANCE EQUILIBRIUM ENGINE
-- ============================================

-- 1. Rebuilds the student's financial summary node from raw transaction data.
CREATE OR REPLACE FUNCTION public.admin_reconcile_student_account(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_billed NUMERIC;
    v_total_paid NUMERIC;
    v_unallocated NUMERIC;
    v_integrity INT;
BEGIN
    -- Calculate Total Liability (Excluding cancelled invoices)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_billed 
    FROM public.fee_invoices 
    WHERE student_id = p_student_id AND status != 'Cancelled';

    -- Calculate Total Settlements (Completed and Pending payments)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND status IN ('Completed', 'Pending');

    -- Identify Unallocated Magnitude (Payments not linked to a specific invoice)
    SELECT COALESCE(SUM(amount), 0) INTO v_unallocated
    FROM public.fee_payments
    WHERE student_id = p_student_id AND invoice_id IS NULL AND status = 'Completed';

    -- Calculate Integrity Score (Percentage of dues cleared)
    v_integrity := CASE 
        WHEN v_total_billed <= 0 AND v_total_paid > 0 THEN 100
        WHEN v_total_billed <= 0 THEN 100
        ELSE GREATEST(0, LEAST(100, (v_total_paid / v_total_billed * 100)::INT))
    END;

    -- Update Summary Node (Atomic Upsert)
    INSERT INTO public.student_fee_accounts (
        student_id, total_billed, total_paid, outstanding_balance, 
        integrity_score, last_synced_at, unallocated_funds
    )
    VALUES (
        p_student_id, v_total_billed, v_total_paid, (v_total_billed - v_total_paid), 
        v_integrity, NOW(), v_unallocated
    )
    ON CONFLICT (student_id) DO UPDATE SET
        total_billed = EXCLUDED.total_billed,
        total_paid = EXCLUDED.total_paid,
        outstanding_balance = EXCLUDED.outstanding_balance,
        integrity_score = EXCLUDED.integrity_score,
        unallocated_funds = EXCLUDED.unallocated_funds,
        last_synced_at = NOW();
END;
$$;

-- 2. Internal Student Provisioner
CREATE OR REPLACE FUNCTION public.generate_student_ledger_for_student(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_grade TEXT;
    v_structure_id BIGINT;
    v_component RECORD;
    v_count INT := 0;
BEGIN
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Grade context not initialized.');
    END IF;

    SELECT id INTO v_structure_id 
    FROM public.fee_structures 
    WHERE target_grade = v_grade AND status = 'Active' AND is_default = true
    ORDER BY created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No default active structure for Grade ' || v_grade);
    END IF;

    INSERT INTO public.student_fee_assignments (student_id, fee_structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET fee_structure_id = v_structure_id;

    FOR v_component IN 
        SELECT * FROM public.fee_components WHERE structure_id = v_structure_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
            AND description ILIKE v_component.name || '%'
            AND status != 'Cancelled'
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, amount, due_date, description, status, created_at
            ) VALUES (
                p_student_id, v_component.amount, NOW() + INTERVAL '15 days',
                v_component.name || ' (INITIAL_SYNC)', 'Pending', NOW()
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'invoices_created', v_count, 'structure_id', v_structure_id);
END;
$$;

-- 3. Frontend Handshake Protocol
CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN public.generate_student_ledger_for_student(p_student_id);
END;
$$;

-- 4. Placement Engine Trigger
CREATE OR REPLACE FUNCTION public.trigger_on_student_placement()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') AND 
       (COALESCE(NEW.grade, '') <> COALESCE(OLD.grade, '') OR 
        COALESCE(NEW.assigned_class_id, 0) <> COALESCE(OLD.assigned_class_id, 0)) THEN
        PERFORM public.generate_student_ledger_for_student(NEW.user_id);
    END IF;
    IF (TG_OP = 'INSERT') AND NEW.grade IS NOT NULL THEN
        PERFORM public.generate_student_ledger_for_student(NEW.user_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_student_placement
    AFTER INSERT OR UPDATE OF grade, assigned_class_id ON public.student_profiles
    FOR EACH ROW EXECUTE FUNCTION public.trigger_on_student_placement();

-- 5. Mass Invoicing Engine
CREATE OR REPLACE FUNCTION public.admin_generate_bulk_invoices(
    p_branch_id BIGINT,
    p_class_id BIGINT,
    p_billing_month TEXT,
    p_billing_year TEXT,
    p_due_date DATE
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student RECORD;
    v_component RECORD;
    v_count INT := 0;
BEGIN
    FOR v_student IN 
        SELECT sp.user_id, sfa.fee_structure_id as structure_id
        FROM public.student_profiles sp
        JOIN public.student_fee_assignments sfa ON sp.user_id = sfa.student_id
        WHERE sp.assigned_class_id = p_class_id
    LOOP
        FOR v_component IN 
            SELECT * FROM public.fee_components 
            WHERE structure_id = v_student.structure_id 
            AND frequency IN ('Monthly', 'Quarterly')
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.fee_invoices 
                WHERE student_id = v_student.user_id 
                AND description ILIKE v_component.name || '%'
                AND description ILIKE '%' || p_billing_month || ' ' || p_billing_year || '%'
                AND status != 'Cancelled'
            ) THEN
                INSERT INTO public.fee_invoices (
                    student_id, amount, due_date, description, status
                ) VALUES (
                    v_student.user_id, v_component.amount, p_due_date,
                    v_component.name || ' (' || p_billing_month || ' ' || p_billing_year || ')', 'Pending'
                );
                v_count := v_count + 1;
            END IF;
        END LOOP;
        PERFORM public.admin_reconcile_student_account(v_student.user_id);
    END LOOP;
    RETURN jsonb_build_object('success', true, 'invoices_generated', v_count);
END;
$$;

-- 6. Forensic Ledger Reconstructor
CREATE OR REPLACE FUNCTION public.get_student_running_ledger(p_student_id UUID)
RETURNS TABLE (
    transaction_date TIMESTAMPTZ,
    identifier TEXT,
    description TEXT,
    debit NUMERIC,
    credit NUMERIC,
    running_balance NUMERIC,
    protocol TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    WITH raw_entries AS (
        SELECT 
            fi.created_at as t_date,
            'INV-' || fi.id::TEXT as idnt,
            fi.description as descr,
            fi.amount as dbt,
            0::NUMERIC as crdt,
            CASE 
                WHEN fi.description ILIKE '%SYSTEM_AUTO_SYNC%' THEN 'SYSTEM_SYNC'
                ELSE 'MANUAL_DEBIT'
            END as prot
        FROM public.fee_invoices fi
        WHERE fi.student_id = p_student_id AND fi.status != 'Cancelled'

        UNION ALL

        SELECT 
            COALESCE(fp.payment_date, fp.created_at) as t_date,
            'PAY-' || fp.id::TEXT as idnt,
            'Settlement: ' || COALESCE(fp.payment_method, 'Transfer'),
            0::NUMERIC as dbt,
            fp.amount as crdt,
            CASE 
                WHEN fp.invoice_id IS NULL THEN 'UNALLOCATED_ADVANCE'
                ELSE 'ALLOCATED_SETTLEMENT'
            END as prot
        FROM public.fee_payments fp
        WHERE fp.student_id = p_student_id AND fp.status = 'Completed'
    )
    SELECT 
        t_date as transaction_date,
        idnt as identifier,
        descr as description,
        dbt as debit,
        crdt as credit,
        SUM(dbt - crdt) OVER (ORDER BY t_date ASC, idnt ASC) as running_balance,
        prot as protocol
    FROM raw_entries
    ORDER BY t_date DESC, idnt DESC;
END;
$$;

-- 7. Multi-Node Identity Handshake
CREATE OR REPLACE FUNCTION public.get_student_financial_nodes(p_branch_id BIGINT)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    grade TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INT,
    profile_photo_url TEXT,
    is_active BOOLEAN,
    is_standby BOOLEAN,
    unallocated_funds NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as student_id,
        p.display_name,
        sp.grade,
        sc.name as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        p.profile_photo_url,
        p.is_active,
        (NOT EXISTS (SELECT 1 FROM public.student_fee_assignments sfas WHERE sfas.student_id = p.id) 
         OR COALESCE(sfa.unallocated_funds, 0) > 0) as is_standby,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    AND p.role = 'Student'
    ORDER BY p.display_name ASC;
END;
$$;

-- 8. Single-Node Identity Handshake
CREATE OR REPLACE FUNCTION public.get_student_financial_node(p_student_id UUID)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    grade TEXT,
    class_name TEXT,
    total_billed NUMERIC,
    total_paid NUMERIC,
    outstanding_balance NUMERIC,
    integrity_score INT,
    profile_photo_url TEXT,
    is_active BOOLEAN,
    is_standby BOOLEAN,
    unallocated_funds NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        p.id as student_id,
        p.display_name,
        sp.grade,
        sc.name as class_name,
        COALESCE(sfa.total_billed, 0) as total_billed,
        COALESCE(sfa.total_paid, 0) as total_paid,
        COALESCE(sfa.outstanding_balance, 0) as outstanding_balance,
        COALESCE(sfa.integrity_score, 100) as integrity_score,
        p.profile_photo_url,
        p.is_active,
        (NOT EXISTS (SELECT 1 FROM public.student_fee_assignments sfas WHERE sfas.student_id = p_student_id) 
         OR COALESCE(sfa.unallocated_funds, 0) > 0) as is_standby,
        COALESCE(sfa.unallocated_funds, 0) as unallocated_funds
    FROM public.profiles p
    JOIN public.student_profiles sp ON p.id = sp.user_id
    LEFT JOIN public.school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN public.student_fee_accounts sfa ON p.id = sfa.student_id
    WHERE p.id = p_student_id;
END;
$$;



-- Get All Teachers (Admin)
CREATE OR REPLACE FUNCTION public.get_all_teachers_for_admin()
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  phone text,
  is_active boolean,
  created_at timestamp with time zone,
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
  employment_status text,
  branch_id bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.email,
    p.display_name,
    p.phone,
    p.is_active,
    p.created_at,
    tp.subject,
    tp.qualification,
    tp.experience_years,
    tp.date_of_joining,
    tp.bio,
    tp.specializations,
    tp.profile_picture_url,
    tp.gender,
    tp.date_of_birth,
    tp.department,
    tp.designation,
    tp.employee_id,
    tp.employment_type,
    tp.employment_status,
    tp.branch_id
  FROM public.teacher_profiles tp
  JOIN public.profiles p ON tp.user_id = p.id
  ORDER BY p.created_at DESC;
$$;


-- Admin Quick Add Student (Placeholder)
CREATE OR REPLACE FUNCTION public.admin_quick_add_student(
  p_display_name text, 
  p_email text, 
  p_grade text, 
  p_parent_details text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This typically requires an Edge Function to create the Auth User first.
  -- returning failure to prompt UI.
  RETURN jsonb_build_object('success', false, 'message', 'Feature requires Edge Function deployment for Auth provisioning.');
END;
$$;

COMMIT;

-- ===============================================================================================
-- GURUKUL OS - CORE MISSION-CRITICAL RPC REGISTRY
-- This file restores essential business logic functions for onboarding and role management.
-- ===============================================================================================

BEGIN;

-- 1. Initialize School Administration Node
CREATE OR REPLACE FUNCTION public.initialize_school_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Update Role in Profile
  UPDATE public.profiles
  SET role = 'School Administration'
  WHERE id = v_user_id;

  -- Ensure School Admin Profile exists
  INSERT INTO public.school_admin_profiles (user_id, onboarding_step)
  VALUES (v_user_id, 'profile')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 2. Complete Institutional Onboarding Step
CREATE OR REPLACE FUNCTION public.complete_branch_step()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Mark Profile as Fully Operational
  UPDATE public.profiles
  SET profile_completed = true
  WHERE id = v_user_id;

  -- Update Internal Step Tracking
  UPDATE public.school_admin_profiles
  SET onboarding_step = 'completed'
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 3. Unified Faculty Profile Synchronizer
CREATE OR REPLACE FUNCTION public.upsert_teacher_profile(
  p_user_id uuid,
  p_display_name text,
  p_email text,
  p_phone text,
  p_department text,
  p_designation text,
  p_subject text,
  p_qualification text,
  p_experience numeric,
  p_doj date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync Core Identity
  UPDATE public.profiles
  SET display_name = p_display_name,
      phone = p_phone,
      role = 'Teacher'
  WHERE id = p_user_id;

  -- Sync Faculty Metadata
  INSERT INTO public.teacher_profiles (
    user_id, subject, qualification, experience_years, date_of_joining, department, designation
  )
  VALUES (
    p_user_id, p_subject, p_qualification, p_experience, p_doj, p_department, p_designation
  )
  ON CONFLICT (user_id) DO UPDATE SET
    subject = EXCLUDED.subject,
    qualification = EXCLUDED.qualification,
    experience_years = EXCLUDED.experience_years,
    date_of_joining = EXCLUDED.date_of_joining,
    department = EXCLUDED.department,
    designation = EXCLUDED.designation;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 4. Get Institutional Branches (Telemetry)
CREATE OR REPLACE FUNCTION public.get_school_branches()
RETURNS SETOF public.school_branches
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.school_branches 
  WHERE school_user_id = auth.uid() 
  OR id IN (SELECT branch_id FROM public.profiles WHERE id = auth.uid());
$$;


-- 5. Atomic Student Profile Sync
CREATE OR REPLACE FUNCTION public.upsert_student_profile(
  p_user_id uuid,
  p_display_name text,
  p_grade text,
  p_gender text,
  p_dob date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync Core Identity
  UPDATE public.profiles
  SET display_name = p_display_name,
      role = 'Student'
  WHERE id = p_user_id;

  -- Sync Student Metadata
  INSERT INTO public.student_profiles (
    user_id, grade, gender, date_of_birth
  )
  VALUES (
    p_user_id, p_grade, p_gender, p_dob
  )
  ON CONFLICT (user_id) DO UPDATE SET
    grade = EXCLUDED.grade,
    gender = EXCLUDED.gender,
    date_of_birth = EXCLUDED.date_of_birth;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 6. Atomic Parent/Guardian Sync
CREATE OR REPLACE FUNCTION public.upsert_parent_profile(
  p_user_id uuid,
  p_display_name text,
  p_relationship text,
  p_gender text,
  p_num_children integer,
  p_address text,
  p_city text,
  p_state text,
  p_country text,
  p_pin_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync Core Identity
  UPDATE public.profiles
  SET display_name = p_display_name,
      role = 'Parent/Guardian'
  WHERE id = p_user_id;

  -- Sync Guardian Metadata
  INSERT INTO public.parent_profiles (
    user_id, relationship_to_student, gender, number_of_children, address, city, state, country, pin_code
  )
  VALUES (
    p_user_id, p_relationship, p_gender, p_num_children, p_address, p_city, p_state, p_country, p_pin_code
  )
  ON CONFLICT (user_id) DO UPDATE SET
    relationship_to_student = EXCLUDED.relationship_to_student,
    gender = EXCLUDED.gender,
    number_of_children = EXCLUDED.number_of_children,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    country = EXCLUDED.country,
    pin_code = EXCLUDED.pin_code;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Transport Staff Profile Sync
CREATE OR REPLACE FUNCTION public.upsert_transport_profile(
  p_user_id uuid,
  p_display_name text,
  p_vehicle_details text,
  p_license_info text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET display_name = p_display_name,
      role = 'Transport Staff'
  WHERE id = p_user_id;

  INSERT INTO public.transport_staff_profiles (user_id, vehicle_details, license_info)
  VALUES (p_user_id, p_vehicle_details, p_license_info)
  ON CONFLICT (user_id) DO UPDATE SET
    vehicle_details = EXCLUDED.vehicle_details,
    license_info = EXCLUDED.license_info;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 8. Ecommerce Operator Profile Sync
CREATE OR REPLACE FUNCTION public.upsert_ecommerce_profile(
  p_user_id uuid,
  p_display_name text,
  p_store_name text,
  p_business_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET display_name = p_display_name,
      role = 'Ecommerce Operator'
  WHERE id = p_user_id;

  INSERT INTO public.ecommerce_operator_profiles (user_id, store_name, business_type)
  VALUES (p_user_id, p_store_name, p_business_type)
  ON CONFLICT (user_id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    business_type = EXCLUDED.business_type;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. Get All Classes (Admin)
CREATE OR REPLACE FUNCTION public.get_all_classes_for_admin()
RETURNS TABLE (
  id bigint,
  name text,
  grade_level text,
  section text,
  academic_year text,
  branch_name text,
  student_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id, c.name, c.grade_level, c.section, c.academic_year,
    b.name as branch_name,
    (SELECT COUNT(*) FROM public.student_profiles s WHERE s.assigned_class_id = c.id) as student_count
  FROM public.school_classes c
  LEFT JOIN public.school_branches b ON c.branch_id = b.id
  ORDER BY c.grade_level, c.name;
$$;


-- 10. Get Class Roster (Teacher/Admin)
CREATE OR REPLACE FUNCTION public.get_class_roster(p_class_id bigint)
RETURNS TABLE (
  student_id uuid,
  display_name text,
  email text,
  roll_number text,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id as student_id,
    p.display_name,
    p.email,
    s.roll_number,
    s.enrollment_status as status
  FROM public.student_profiles s
  JOIN public.profiles p ON s.user_id = p.id
  WHERE s.assigned_class_id = p_class_id;
$$;

-- 11. Update School Plan
CREATE OR REPLACE FUNCTION public.update_school_plan(p_plan_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.school_admin_profiles
  SET 
    plan_id = p_plan_id,
    onboarding_step = 'branches'
  WHERE user_id = auth.uid();
END;
$$;

COMMIT;
