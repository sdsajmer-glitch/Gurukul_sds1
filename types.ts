
import React from 'react';

export type Role = string;
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export enum BuiltInRoles {
    SCHOOL_ADMINISTRATION = 'School Administration',
    BRANCH_ADMIN = 'Branch Admin',
    PARENT_GUARDIAN = 'Parent/Guardian',
    STUDENT = 'Student',
    TEACHER = 'Teacher',
    SUPER_ADMIN = 'Super Admin',
    PRINCIPAL = 'Principal',
    HR_MANAGER = 'HR Manager',
    ACADEMIC_COORDINATOR = 'Academic Coordinator',
    ACCOUNTANT = 'Accountant',
    TRANSPORT_STAFF = 'Transport Staff',
    ECOMMERCE_OPERATOR = 'Ecommerce Operator'
}

export interface UserProfile {
    id: string;
    email: string;
    display_name: string;
    role?: Role;
    phone?: string;
    is_active: boolean;
    profile_completed: boolean;
    created_at: string;
    branch_id?: number | null;
    profile_photo_url?: string | null;
    base_currency?: CurrencyCode;
    email_confirmed_at?: string;
}

// Fix: Added missing SubmissionStatus type.
export type SubmissionStatus = 'Not Submitted' | 'Submitted' | 'Late' | 'Graded';

// Fix: Added missing StudentAssignment interface used in dashboards.
export interface StudentAssignment {
    id: number;
    title: string;
    subject: string;
    description: string;
    due_date: string;
    status: SubmissionStatus;
    submission_grade?: string;
    teacher_feedback?: string;
    file_path?: string;
    file_name?: string;
}

export type TaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AdminTask {
    id: string;
    branch_id: number | null;
    title: string;
    description: string;
    priority: TaskPriority;
    category: string;
    status: 'Todo' | 'Completed';
    created_at: string;
    due_date?: string;
}

export interface TimelineEvent {
    id: string;
    status: string;
    label: string;
    timestamp: string;
    role: string;
    icon: 'create' | 'submit' | 'audit' | 'seal';
}

export interface Expense {
    id: number;
    category: string;
    category_name?: string;
    amount: number;
    base_amount?: number;
    tax_amount?: number;
    adjustments?: number;
    description: string;
    vendor_name?: string;
    vendor_account?: string;
    payment_method?: string;
    expense_date: string;
    created_at?: string;
    status: string;
    invoice_url?: string;
    invoice_id?: string;
    currency?: CurrencyCode;
    timeline?: TimelineEvent[];
    invoice?: {
        id: string;
        file_name: string;
        storage_path: string;
        file_size?: number;
    };
}

export interface ExpenseDashboardData {
    total_expenses_month: number;
    pending_approvals: number;
    recent_expenses: Expense[];
}

export interface SchoolBranch {
    id: number;
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    is_main_branch: boolean;
    admin_email?: string;
    admin_name?: string;
    admin_phone?: string;
    status?: string;
    base_currency?: CurrencyCode;
    school_user_id?: string;
}

export interface Communication {
    id: string;
    subject: string;
    body: string;
    sent_at: string;
    sender_name: string;
    status?: string;
    recipients?: string[];
    target_criteria?: any;
}

export interface TimetableEntry {
    id: string;
    day: string;
    startTime: string;
    endTime: string;
    subject: string;
    teacher: string;
    room: string;
    isConflict?: boolean;
}

export interface StudentDashboardData {
    profile: UserProfile & {
        roll_number?: string;
        student_id_number?: string;
        grade?: string;
        parent_guardian_details?: string;
    };
    admission: AdmissionApplication;
    attendanceSummary: {
        total_days: number;
        present_days: number;
        absent_days: number;
        late_days: number;
    };
    assignments: StudentAssignment[];
    timetable: TimetableEntry[];
    announcements: Communication[];
    recentGrades: any[];
    classInfo?: {
        name: string;
        teacher_name: string;
    };
    studyMaterials: StudyMaterial[];
    needs_onboarding?: boolean;
}

export interface AdmissionApplication {
    id: string;
    applicant_name: string;
    grade: string;
    status: string;
    registered_at?: string;
    submitted_at: string;
    profile_photo_url?: string | null;
    application_number?: string;
    parent_name?: string;
    parent_email?: string;
    parent_phone?: string;
    student_id_number?: string;
    class_name?: string;
    student_user_id?: string;
    medical_info?: string;
    emergency_contact?: string;
    branch_id?: number | null;
    address?: string;
    date_of_birth?: string;
    gender?: string;
    source_type?: 'Enquiry' | 'Admission';
    enquiry_id?: string;
    school_name?: string;
}
export interface FinanceData {
    total_assigned: number;
    total_collected: number;
    total_pending: number;
    total_overdue: number;
    monthly_collection: number;
    today_collection: number;
    currency: CurrencyCode;
    // Enterprise Health Metrics
    health_index?: number;
    collection_efficiency?: number;
    outstanding_ratio?: number;
    burn_rate_stability?: number;
    total_revenue_30d?: number;
    total_expense_30d?: number;
    // Legacy mapping
    revenue_ytd?: number;
    collections_this_month?: number;
    pending_dues?: number;
    online_payments?: number;
}

export interface GradeCollectionStats {
    grade: string;
    section: string;
    total_students: number;
    total_billed: number;
    total_collected: number;
    total_pending: number;
}

export interface FinancialTransaction {
    id: string;
    student_name: string;
    amount: number;
    status: string;
    performed_at: string;
    protocol: string;
}

export interface FeeComponent {
    id?: number;
    name: string;
    amount: string;
    frequency: string;
    is_mandatory: boolean;
    category?: string;
    is_refundable?: boolean;
    gl_code?: string;
    tax_percentage?: number;
    description?: string;
}

export interface FeeStructure {
    id: number;
    name: string;
    academic_year: string;
    target_grade: string;
    currency: CurrencyCode;
    status: 'Active' | 'Draft' | 'active' | 'draft'; // Support both casing conventions
    state?: string; // Matches DB UPPERCASE state constraint
    type?: 'Standard' | 'Package' | 'Transport';
    components?: FeeComponent[];
    projected_revenue?: number;
    collected_revenue?: number;
    base_amount?: number;
    student_count?: number;
    integrity_score?: number;
    created_at?: string;
}

export interface StudentFeeSummary {
    student_id: string;
    display_name: string;
    class_name: string;
    grade: string;
    total_billed: number;
    total_paid: number;
    outstanding_balance: number;
    overall_status: string;
    currency: CurrencyCode;
    branch_id?: number | null;
    profile_photo_url?: string | null;
    integrity_score?: number;
}

export interface StudentInvoice {
    id: number;
    amount: number;
    amount_paid: number;
    due_date: string;
    description: string;
    status: InvoiceStatus;
    currency?: CurrencyCode;
}

export type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Partial';

export interface StudentFinanceDetails {
    invoices: StudentInvoice[];
    payments: any[];
}

export interface Invoice {
    id: string;
    invoice_id: string;
    expense_id: string;
    status: 'DRAFT' | 'FINAL' | 'LOCKED';
    currency: CurrencyCode;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    pdf_path?: string;
    created_at: string;
}

export interface StudyMaterial {
    id: number;
    title: string;
    subject: string;
    file_name: string;
    file_path: string;
    file_type: string;
    is_bookmarked: boolean;
    created_at: string;
}

export interface DocumentRequirement {
    id: number;
    admission_id: string;
    document_name: string;
    is_mandatory: boolean;
    status: string;
    notes_for_parent?: string;
    rejection_reason?: string;
    admission_documents?: any[];
}

export interface SchoolAdminProfileData {
    user_id: string;
    school_name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    admin_contact_name: string;
    admin_contact_phone: string;
    admin_contact_email?: string;
    admin_designation?: string;
    academic_board?: string;
    affiliation_number?: string;
    school_type?: string;
    academic_year_start?: string;
    academic_year_end?: string;
    grade_range_start?: string;
    grade_range_end?: string;
    onboarding_step?: string;
    workload_limit?: number;
}

export interface ParentProfileData {
    user_id: string;
    relationship_to_student: string;
    gender: string;
    number_of_children: number;
    address: string;
    city: string;
    state: string;
    country: string;
    pin_code: string;
    secondary_parent_name?: string;
    secondary_parent_email?: string;
    secondary_parent_phone?: string;
    secondary_parent_relationship?: string;
    secondary_parent_gender?: string;
}

export interface StudentProfileData {
    user_id: string;
    applicant_name: string;
    date_of_birth: string;
    gender: string;
    grade: string;
    enrollment_status?: string;
}

export interface TeacherProfileData {
    user_id: string;
    subject: string;
    qualification: string;
    experience_years: number;
    date_of_joining: string;
    bio?: string;
    specializations?: string;
    profile_picture_url?: string;
    gender?: string;
    date_of_birth?: string;
    blood_group?: string;
    religion?: string;
    phone_number?: string;
    address?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    department?: string;
    designation?: string;
    employee_id?: string;
    employment_type?: string;
    employment_status?: string;
    branch_id?: number;
    workload_limit?: number;
    salary?: string;
    bank_details?: string;
}

export interface TransportProfileData {
    user_id: string;
    route_id: number;
    vehicle_details: string;
    license_info: string;
}

export interface BusRoute {
    id: number;
    name: string;
    description?: string;
}

export interface EcommerceProfileData {
    user_id: string;
    store_name: string;
    business_type: string;
}

export type ShareCodeStatus = 'Active' | 'Expired' | 'Revoked' | 'Redeemed';
export type ShareCodeType = 'Enquiry' | 'Admission';

export interface ShareCode {
    id: number;
    code: string;
    admission_id: string;
    applicant_name: string;
    status: ShareCodeStatus;
    code_type: ShareCodeType;
    purpose?: string;
    expires_at: string;
    created_at: string;
}

export interface SchoolClass {
    id: number;
    name: string;
    grade_level?: string;
    section?: string;
    academic_year?: string;
    class_teacher_id?: string | null;
    branch_id?: number | null;
    capacity?: number;
    teacher_name?: string;
    student_count?: number;
    branch_name?: string;
}

export interface StudentRosterItem {
    id: string;
    display_name: string;
    roll_number?: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late';

export interface AttendanceRecord {
    id?: number;
    student_id: string;
    class_id: number;
    attendance_date: string;
    status: AttendanceStatus;
    notes?: string;
    recorded_by?: string;
}

export type FunctionComponentWithIcon<P = {}> = React.FC<P> & {
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
};

export interface AdminAnalyticsStats {
    total_users: number;
    total_applications: number;
    pending_applications: number;
}

export type EnquiryStatus = 'NEW' | 'ENQUIRY_ACTIVE' | 'ENQUIRY_VERIFIED' | 'ENQUIRY_IN_REVIEW' | 'ENQUIRY_CONTACTED' | 'ENQUIRY_REJECTED' | 'ENQUIRY_CONVERTED';

export interface Enquiry {
    id: string;
    applicant_name: string;
    parent_name: string;
    parent_email: string;
    parent_phone?: string;
    secondary_parent_name?: string;
    secondary_parent_email?: string;
    secondary_parent_phone?: string;
    grade: string;
    status: EnquiryStatus;
    notes?: string;
    updated_at: string;
    branch_id?: number | null;
    branch_name?: string;
    profile_photo_url?: string | null;
    created_at: string;
    source?: string;
    conversion_state?: 'CONVERTED' | 'NOT_CONVERTED';
    admission_id?: string | null;
}

export interface MyEnquiry extends Enquiry {
    branch_name?: string;
}

export interface TimelineItem {
    item_type: 'MESSAGE' | 'STATUS_CHANGE' | 'DOCUMENT_REQUEST' | 'ENQUIRY_RECEIVED';
    created_at: string;
    created_by_name: string;
    is_admin: boolean;
    details: any;
    sender_photo_url?: string | null;
}

export type CourseStatus = 'Active' | 'Draft' | 'Archived' | 'Pending' | 'Inactive';

export interface Course {
    id: number;
    title: string;
    code: string;
    description?: string;
    credits: number;
    category: string;
    grade_level: string;
    status: CourseStatus;
    teacher_id?: string | null;
    teacher_name?: string;
    department?: string;
    modules_count?: number;
    enrolled_count?: number;
    subject_type?: string;
    created_at?: string;
    branch_id?: number | null;
}

export interface CourseModule {
    id: number;
    course_id: number;
    title: string;
    order_index: number;
    status?: string;
    duration_hours?: number;
}

export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type TimeSlot = '08:00' | '09:00' | '10:00' | '11:00' | '13:00' | '14:00' | '15:00';

export interface StudentForAdmin extends UserProfile {
    student_id_number?: string;
    grade: string;
    roll_number?: string;
    parent_guardian_details?: string;
    assigned_class_id?: number | null;
    assigned_class_name?: string | null;
    gender?: string;
    date_of_birth?: string;
    address?: string;
    admission_id?: string;
    enquiry_id?: string;
    enrollment_status?: string;
    academic_year?: string;
}

export interface VerifiedShareCodeData {
    found: boolean;
    admission_id: string;
    applicant_name: string;
    grade: string;
    code_type: ShareCodeType;
}

export interface TeacherClassOverview {
    id: number;
    name: string;
    student_count: number;
}

export interface TeacherClassDetails {
    roster: StudentRosterItem[];
    assignments: StudentAssignment[];
    studyMaterials: StudyMaterial[];
    subjects: ClassSubject[];
}

export interface ClassSubject {
    id: number;
    name: string;
}

export interface LessonPlan {
    id: number;
    title: string;
    subject_name: string;
    lesson_date: string;
    objectives: string;
    activities: string;
    resources: any[];
}

export interface StudentAttendanceRecord {
    date: string;
    status: 'Present' | 'Absent' | 'Late';
    notes?: string;
}

export interface ClassPerformanceSummary {
    average_grade: number;
    attendance_rate: number;
}

export interface StudentPerformanceReport {
    attendance_summary: {
        present: number;
        absent: number;
        late: number;
    };
    assignments: any[];
}

export interface Workshop {
    id: number;
    title: string;
    description: string;
    workshop_date: string;
}

export interface TeacherProfessionalDevelopmentData {
    total_points: number;
    training_records: any[];
    awards: any[];
}

export type BusTripType = 'Morning Pickup' | 'Afternoon Drop-off';
export type BusAttendanceStatus = 'Boarded' | 'Absent';

export interface BusStudent {
    id: string;
    display_name: string;
    grade: string;
    parent_guardian_details: string;
}

export interface BusAttendanceRecord {
    student_id: string;
    status: BusAttendanceStatus;
}

export interface TransportDashboardData {
    route: {
        id: number;
        name: string;
        description: string;
    };
    students: BusStudent[];
    error?: string;
}

export interface TeacherExtended extends UserProfile {
    details?: TeacherProfileData;
    dailyStatus?: string;
}

export interface TeacherDocument {
    id: number;
    document_name: string;
    document_type: string;
    file_path: string;
    status: string;
    uploaded_at: string;
}

export interface TeacherSubjectMapping {
    id: number;
    teacher_id: string;
    subject_id: number;
    class_id: number;
    academic_year: string;
    class_name?: string;
    subject_name?: string;
    credits?: number;
    category?: string;
}

export interface BulkImportResult {
    success_count: number;
    failure_count: number;
    errors: any[];
}

export interface SchoolDepartment {
    id: number;
    name: string;
    description?: string;
    hod_id?: string;
    hod_name?: string;
    teacher_count?: number;
    course_count?: number;
}

export interface StudentDuesInfo {
    student_id: string;
    display_name: string;
    class_name: string;
    outstanding_balance: number;
}

export interface ClassDuesInfo {
    class_name: string;
    total_dues: number;
}

export interface DuesDashboardData {
    total_dues: number;
    total_overdue: number;
    overdue_student_count: number;
    dues_by_class: ClassDuesInfo[];
    highest_dues_students: StudentDuesInfo[];
}

export interface FeeCollectionReportItem {
    payment_date: string;
    student_name: string;
    amount: number;
    payment_method: string;
}

export interface ExpenseReportItem {
    expense_date: string;
    category: string;
    amount: number;
    vendor_name: string;
}

export interface StudentLedgerEntry {
    transaction_date: string;
    description: string;
    debit?: number;
    credit?: number;
    balance: number;
}

// ── Enterprise Finance Interfaces ──

export type RefundStatus = 'INITIATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'PROCESSED' | 'REJECTED';

export interface RefundRequest {
    id: number;
    student_id: string;
    student_name?: string;
    invoice_id?: number;
    amount: number;
    reason: string;
    status: RefundStatus;
    requested_by: string;
    approved_by?: string;
    processed_at?: string;
    created_at: string;
    branch_id?: number | null;
    refund_method?: 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT_NOTE';
    reference_number?: string;
}

export type WaiverStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface WaiverApplication {
    id: number;
    student_id: string;
    student_name?: string;
    fee_structure_id?: number;
    waiver_type: 'PERCENTAGE' | 'FLAT' | 'FULL';
    waiver_value: number;
    reason: string;
    status: WaiverStatus;
    applied_by: string;
    approved_by?: string;
    valid_from?: string;
    valid_to?: string;
    created_at: string;
    branch_id?: number | null;
}

export type PeriodStatus = 'OPEN' | 'LOCKED' | 'CLOSED';

export interface FinancialPeriod {
    id: number;
    name: string;
    period_type: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
    start_date: string;
    end_date: string;
    status: PeriodStatus;
    locked_by?: string;
    locked_at?: string;
    branch_id?: number | null;
    total_revenue?: number;
    total_expenses?: number;
    notes?: string;
}

export interface LateFeeRule {
    id: number;
    name: string;
    fee_structure_id?: number;
    grace_period_days: number;
    fee_type: 'PERCENTAGE' | 'FLAT';
    fee_value: number;
    max_cap?: number;
    is_active: boolean;
    branch_id?: number | null;
    created_at?: string;
}

export type ReconciliationStatus = 'MATCHED' | 'UNMATCHED' | 'PARTIAL' | 'DISPUTED';

export interface BankReconciliationEntry {
    id: number;
    transaction_date: string;
    bank_reference: string;
    bank_amount: number;
    system_amount?: number;
    student_name?: string;
    payment_id?: number;
    status: ReconciliationStatus;
    matched_at?: string;
    branch_id?: number | null;
    notes?: string;
}

export interface BudgetAllocation {
    id: number;
    department: string;
    category: string;
    allocated_amount: number;
    spent_amount: number;
    fiscal_year: string;
    branch_id?: number | null;
    notes?: string;
    created_at?: string;
}
