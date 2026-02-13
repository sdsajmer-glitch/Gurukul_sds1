
-- =============================================================================
-- ENTERPRISE FINANCE CORE: HIGH-SCALE MULTI-TENANT ARCHITECTURE
-- =============================================================================
-- Target Scale: 50,000+ Students | Architecture: Service-Oriented (Event-Driven)
-- Standard: International Double-Entry Accounting (IFRS/GAAP Compliant)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- [A] TENANCY & FOUNDATION (Institutional Layer)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    country TEXT,
    currency_code TEXT DEFAULT 'INR',
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapping to existing school_branches (Bridge Table)
-- We keep existing BIGINT IDs for branch_id to maintain compatibility with legacy modules
-- but track the new UUID-based tenancy here.

-- -----------------------------------------------------------------------------
-- [B] FINANCE MASTER SERVICE (Setup & Protocols)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_fee_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL, -- References legacy school_branches.id
    academic_cycle_id BIGINT NOT NULL, -- References legacy academic_years.id
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_fee_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_template_id UUID REFERENCES finance_fee_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT CHECK (category IN ('mandatory', 'optional')),
    amount DECIMAL(15, 2) NOT NULL,
    tax_percentage DECIMAL(5, 2) DEFAULT 0,
    frequency TEXT CHECK (frequency IN ('onetime', 'monthly', 'quarterly', 'annual')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_grade_fee_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    academic_cycle_id BIGINT NOT NULL,
    grade_id TEXT NOT NULL, -- Using text to match grade system
    section_id BIGINT,
    fee_template_id UUID REFERENCES finance_fee_templates(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_scholarship_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('percentage', 'fixed')),
    value DECIMAL(15, 2) NOT NULL,
    eligibility_criteria JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- [C] BILLING ENGINE (Student Liability Nexus)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_student_fee_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    academic_cycle_id BIGINT NOT NULL,
    student_id UUID NOT NULL, -- References user_id in profiles/student_profiles
    fee_template_id UUID REFERENCES finance_fee_templates(id),
    total_amount DECIMAL(15, 2) NOT NULL,
    scholarship_amount DECIMAL(15, 2) DEFAULT 0,
    net_amount DECIMAL(15, 2) NOT NULL,
    status TEXT CHECK (status IN ('active', 'closed')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_installment_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID REFERENCES finance_student_fee_ledger(id) ON DELETE CASCADE,
    installment_no INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'paid', 'overdue')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_student_fee_breakdown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID REFERENCES finance_student_fee_ledger(id),
    fee_component_id UUID REFERENCES finance_fee_components(id),
    amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- [D] PAYMENT SERVICE (Transaction & Receipts)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_payments_enterprise (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    student_id UUID NOT NULL,
    ledger_id UUID REFERENCES finance_student_fee_ledger(id),
    amount DECIMAL(15, 2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('upi', 'stripe', 'cash', 'bank')),
    payment_gateway TEXT,
    transaction_reference TEXT UNIQUE,
    status TEXT CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_receipts_enterprise (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES finance_payments_enterprise(id) ON DELETE CASCADE,
    receipt_number TEXT UNIQUE NOT NULL,
    receipt_url TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_refunds_enterprise (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES finance_payments_enterprise(id),
    amount DECIMAL(15, 2) NOT NULL,
    reason TEXT,
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    status TEXT DEFAULT 'Completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- [E] LEDGER SERVICE (Standard Double-Entry Accounting)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_ent_chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_account_id UUID REFERENCES finance_ent_chart_of_accounts(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, account_code)
);

CREATE TABLE IF NOT EXISTS finance_ent_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    reference_type TEXT CHECK (reference_type IN ('payment', 'expense', 'refund')),
    reference_id UUID, -- Links to specific payment/expense ID
    entry_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_ent_journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID REFERENCES finance_ent_journal_entries(id) ON DELETE CASCADE,
    account_id UUID REFERENCES finance_ent_chart_of_accounts(id),
    debit_amount DECIMAL(15, 2) DEFAULT 0,
    credit_amount DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_ent_general_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    account_id UUID REFERENCES finance_ent_chart_of_accounts(id),
    journal_entry_line_id UUID REFERENCES finance_ent_journal_entry_lines(id),
    entry_date DATE NOT NULL,
    debit_amount DECIMAL(15, 2) DEFAULT 0,
    credit_amount DECIMAL(15, 2) DEFAULT 0,
    balance_after DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- [F] EXPENSE & PAYROLL SERVICES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_ent_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    tax_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_ent_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    category TEXT NOT NULL,
    vendor_id UUID REFERENCES finance_ent_vendors(id),
    amount DECIMAL(15, 2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'cancelled')) DEFAULT 'paid',
    description TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_ent_payroll_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    employee_id UUID REFERENCES public.profiles(id), -- Unified profiles table
    gross_salary DECIMAL(15, 2) NOT NULL,
    deductions DECIMAL(15, 2) DEFAULT 0,
    net_salary DECIMAL(15, 2) NOT NULL,
    pay_date DATE NOT NULL,
    status TEXT DEFAULT 'Completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- [H] OVERSIGHT & ANALYTICS (Audit, AI Risk, Reports)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_ent_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    user_id UUID NOT NULL, -- Performed by
    module TEXT NOT NULL, -- finance/payment/master/billing/etc
    action TEXT CHECK (action IN ('create', 'update', 'delete')),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
); -- IMMUTABLE TABLE

CREATE TABLE IF NOT EXISTS finance_financial_summary_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL,
    academic_cycle_id BIGINT NOT NULL,
    total_assigned DECIMAL(15, 2),
    total_collected DECIMAL(15, 2),
    total_outstanding DECIMAL(15, 2),
    overdue_amount DECIMAL(15, 2),
    burn_rate DECIMAL(15, 2),
    financial_health_score DECIMAL(5, 2),
    snapshot_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_student_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    academic_cycle_id BIGINT NOT NULL,
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
    prediction_date DATE DEFAULT CURRENT_DATE,
    model_version TEXT DEFAULT 'v1.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    source_service TEXT NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB NOT NULL,
    processed_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- [K] CRITICAL INDEXES FOR ENTERPRISE SCALE (1M+ Students Ready)
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_ent_fin_branch ON finance_fee_templates(branch_id);
CREATE INDEX IF NOT EXISTS idx_ent_fin_cycle ON finance_fee_templates(academic_cycle_id);
CREATE INDEX IF NOT EXISTS idx_ent_fin_student ON finance_student_fee_ledger(student_id);
CREATE INDEX IF NOT EXISTS idx_ent_fin_ledger ON finance_installment_schedule(ledger_id);
CREATE INDEX IF NOT EXISTS idx_ent_fin_pay_status ON finance_payments_enterprise(status);
CREATE INDEX IF NOT EXISTS idx_ent_fin_entry_date ON finance_ent_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ent_fin_audit_entity ON finance_ent_audit_logs(entity_id);

COMMIT;
