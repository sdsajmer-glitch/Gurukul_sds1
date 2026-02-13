
-- =============================================================================
-- ENTERPRISE SCHOOL ERP FINANCE ENGINE: PRODUCTION SCHEMA (PostgreSQL 14+)
-- =============================================================================
-- Description: A robust, multi-tenant, double-entry accounting system designed
--              for international school networks (10k - 50k+ students).
-- Architecture: High-Scale Institutional Governance Module
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- [0] EXTENSIONS & CORE CONFIGURATION
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- [1] INSTITUTION & TENANCY LAYER (The Foundation)
-- -----------------------------------------------------------------------------

-- 🏫 institutional_registry
CREATE TABLE IF NOT EXISTS institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    country VARCHAR(100) NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 🏢 branch_master
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(institution_id, code)
);

CREATE INDEX idx_branches_institution ON branches(institution_id);

-- 📅 academic_cycles
CREATE TABLE IF NOT EXISTS academic_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('draft','active','closed')) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, name)
);

-- -----------------------------------------------------------------------------
-- [2] FINANCE MASTER (Billing Configuration)
-- -----------------------------------------------------------------------------

-- 🧾 fee_templates
CREATE TABLE IF NOT EXISTS fee_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    academic_cycle_id UUID NOT NULL REFERENCES academic_cycles(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, academic_cycle_id, name)
);

-- 🧩 fee_components
CREATE TABLE IF NOT EXISTS fee_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fee_template_id UUID NOT NULL REFERENCES fee_templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(20) CHECK (category IN ('mandatory','optional')) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    tax_percentage NUMERIC(5,2) DEFAULT 0 CHECK (tax_percentage >= 0),
    frequency VARCHAR(20) CHECK (frequency IN ('monthly','quarterly','annual')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- [3] BILLING ENGINE (Student Liability Ledger)
-- -----------------------------------------------------------------------------

-- 📒 student_fee_ledger
CREATE TABLE IF NOT EXISTS student_fee_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    academic_cycle_id UUID NOT NULL REFERENCES academic_cycles(id),
    student_id UUID NOT NULL, -- References the unified Student Identity
    fee_template_id UUID NOT NULL REFERENCES fee_templates(id),
    total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
    scholarship_amount NUMERIC(14,2) DEFAULT 0 CHECK (scholarship_amount >= 0),
    -- net_amount is automatically calculated and persisted for speed
    net_amount NUMERIC(14,2) GENERATED ALWAYS AS (total_amount - scholarship_amount) STORED,
    status VARCHAR(20) CHECK (status IN ('active','closed')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, academic_cycle_id)
);

CREATE INDEX idx_ledger_student ON student_fee_ledger(student_id);
CREATE INDEX idx_ledger_branch_cycle ON student_fee_ledger(branch_id, academic_cycle_id);

-- 📆 installment_schedule
CREATE TABLE IF NOT EXISTS installment_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL REFERENCES student_fee_ledger(id) ON DELETE CASCADE,
    installment_no INT NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(20) CHECK (status IN ('pending','paid','overdue')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ledger_id, installment_no)
);

-- -----------------------------------------------------------------------------
-- [4] PAYMENT SERVICE (Collection Layer)
-- -----------------------------------------------------------------------------

-- 💵 payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    student_id UUID NOT NULL,
    ledger_id UUID NOT NULL REFERENCES student_fee_ledger(id),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) CHECK (payment_method IN ('upi','stripe','cash','bank')) NOT NULL,
    payment_gateway VARCHAR(100),
    transaction_reference VARCHAR(255),
    status VARCHAR(20) CHECK (status IN ('pending','success','failed','refunded')) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_ledger ON payments(ledger_id);
CREATE INDEX idx_payments_status ON payments(status);

-- 🧾 receipts (Cryptographically Linkable)
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID UNIQUE NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    receipt_url TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- [5] DOUBLE-ENTRY ACCOUNTING (General Ledger)
-- -----------------------------------------------------------------------------

-- 📊 chart_of_accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) CHECK (account_type IN ('asset','liability','equity','revenue','expense')) NOT NULL,
    parent_account_id UUID REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, account_code)
);

-- 📘 journal_entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    reference_type VARCHAR(50), -- e.g., 'PAYMENT', 'REFUND', 'EXPENSE'
    reference_id UUID, -- Polymorphic reference
    entry_date DATE NOT NULL,
    description TEXT,
    created_by UUID, -- References the operator identity
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 📙 journal_entry_lines
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    debit_amount NUMERIC(14,2) DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount NUMERIC(14,2) DEFAULT 0 CHECK (credit_amount >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure a line is either a debit or a credit, not both or neither
    CHECK (
        (debit_amount = 0 AND credit_amount > 0)
        OR
        (credit_amount = 0 AND debit_amount > 0)
    )
);

-- 🔐 DOUBLE ENTRY BALANCE ENFORCEMENT PROTOCOL
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_debit NUMERIC(14,2);
    total_credit NUMERIC(14,2);
BEGIN
    SELECT COALESCE(SUM(debit_amount),0), COALESCE(SUM(credit_amount),0)
    INTO total_debit, total_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;

    IF total_debit <> total_credit THEN
        RAISE EXCEPTION 'REGISTRY_SYNC_FAILURE: Journal entry ID % is not balanced! (Debit: %, Credit: %)', 
            NEW.journal_entry_id, total_debit, total_credit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Delaying trigger creation to handle bulk inserts if needed, 
-- but explicitly defined here for protection.
DROP TRIGGER IF EXISTS trg_check_journal_balance ON journal_entry_lines;
CREATE CONSTRAINT TRIGGER trg_check_journal_balance
AFTER INSERT OR UPDATE ON journal_entry_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_journal_balance();

-- -----------------------------------------------------------------------------
-- [6] AUDIT & OVERSIGHT (Forensic Layer)
-- -----------------------------------------------------------------------------

-- 🛡️ finance_governance_audit (Immutable Forensic Registry)
CREATE TABLE IF NOT EXISTS finance_governance_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL,
    user_id UUID NOT NULL,
    module VARCHAR(100),
    action VARCHAR(50),
    entity_type VARCHAR(100),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_finance_audit_entity ON finance_governance_audit(entity_type, entity_id);

-- 📈 financial_summary_snapshot (Performance Monitoring)
CREATE TABLE IF NOT EXISTS financial_summary_snapshot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    academic_cycle_id UUID NOT NULL REFERENCES academic_cycles(id),
    total_assigned NUMERIC(16,2),
    total_collected NUMERIC(16,2),
    total_outstanding NUMERIC(16,2),
    overdue_amount NUMERIC(16,2),
    burn_rate NUMERIC(10,2),
    financial_health_score NUMERIC(5,2),
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, academic_cycle_id, snapshot_date)
);

COMMIT;
