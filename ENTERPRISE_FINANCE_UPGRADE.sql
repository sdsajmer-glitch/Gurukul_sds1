
-- ENTERPRISE FINANCE CORE: DOUBLE-ENTRY ACCOUNTING & GOVERNANCE
-- This script transforms the modular monolith into an enterprise-grade financial engine.

-- 1. CHART OF ACCOUNTS (CoA)
-- The backbone of double-entry bookkeeping.
CREATE TABLE IF NOT EXISTS finance_chart_of_accounts (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., '1000', '2000'
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
    category VARCHAR(100), -- e.g., 'Cash', 'Accounts Receivable', 'Tuition Income'
    branch_id INTEGER REFERENCES school_branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. JOURNAL ENTRIES & LEDGER NODES
-- Ensuring every transaction has a debit and credit.
CREATE TABLE IF NOT EXISTS finance_journal_entries (
    id SERIAL PRIMARY KEY,
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    reference_no VARCHAR(100) UNIQUE, -- e.g., Receipt No or Invoice No
    description TEXT,
    branch_id INTEGER REFERENCES school_branches(id),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_ledger_transactions (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER REFERENCES finance_journal_entries(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES finance_chart_of_accounts(id),
    debit DECIMAL(15, 2) DEFAULT 0,
    credit DECIMAL(15, 2) DEFAULT 0,
    student_id UUID REFERENCES student_profiles(user_id), -- references student specific profile
    staff_id UUID REFERENCES profiles(id), -- Corrected: references root profiles table
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXPENSE SERVICE: INSTITUTIONAL SPENDING
CREATE TABLE IF NOT EXISTS finance_expenses (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES school_branches(id),
    category VARCHAR(100) NOT NULL, -- e.g., 'Maintenance', 'Electricity', 'Marketing'
    vendor_name VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Paid', -- 'Paid', 'Pending', 'Cancelled'
    receipt_url TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. POLICIES & PROTOCOLS (MASTER LAYER)
CREATE TABLE IF NOT EXISTS finance_discount_policies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('Percentage', 'Fixed')),
    value DECIMAL(15, 2) NOT NULL,
    criteria JSONB, -- e.g., {"sibling_discount": true}
    is_active BOOLEAN DEFAULT TRUE,
    branch_id INTEGER REFERENCES school_branches(id)
);

CREATE TABLE IF NOT EXISTS finance_scholarship_mapping (
    id SERIAL PRIMARY KEY,
    student_id UUID REFERENCES student_profiles(user_id), -- Corrected: references user_id
    policy_id INTEGER REFERENCES finance_discount_policies(id),
    academic_year VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Active',
    granted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. FINANCIAL HEALTH INDEX (FHI) AGGREGATOR
-- Real-time calculation of the institutional health index.
CREATE OR REPLACE FUNCTION get_institutional_health_index(p_branch_id INTEGER)
RETURNS JSON AS $$
DECLARE
    v_total_assigned DECIMAL(15, 2);
    v_total_collected DECIMAL(15, 2);
    v_total_overdue DECIMAL(15, 2);
    v_monthly_expenses DECIMAL(15, 2);
    v_monthly_revenue DECIMAL(15, 2);
    
    v_efficiency_score DECIMAL(5, 2);
    v_outstanding_ratio DECIMAL(5, 2);
    v_burn_rate_stability DECIMAL(5, 2);
    v_health_index DECIMAL(5, 2);
BEGIN
    -- 1. Basic Metrics
    SELECT 
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(amount_paid), 0),
        COALESCE(SUM(amount - amount_paid) FILTER (WHERE due_date < NOW()), 0)
    INTO v_total_assigned, v_total_collected, v_total_overdue
    FROM fee_invoices
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 2. Expense Metrics (Last 30 days)
    SELECT COALESCE(SUM(amount), 0) INTO v_monthly_expenses
    FROM finance_expenses
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND payment_date > (NOW() - INTERVAL '30 days');

    -- 3. Revenue Metrics (Last 30 days)
    SELECT COALESCE(SUM(amount_paid), 0) INTO v_monthly_revenue
    FROM fee_payments
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND created_at > (NOW() - INTERVAL '30 days');

    -- 4. Algorithm Implementation
    -- Collection Efficiency (30%)
    IF v_total_assigned > 0 THEN
        v_efficiency_score := (v_total_collected / v_total_assigned) * 100;
        v_outstanding_ratio := (1 - (v_total_collected / v_total_assigned)) * 100;
    ELSE
        v_efficiency_score := 100;
        v_outstanding_ratio := 0;
    END IF;

    -- Burn Rate Stability (20%)
    -- Ideal burn rate < 0.7 (spending 70% of revenue)
    IF v_monthly_revenue > 0 THEN
        v_burn_rate_stability := LEAST(100, (1 - LEAST(1, v_monthly_expenses / v_monthly_revenue)) * 100);
    ELSE
        v_burn_rate_stability := 0;
    END IF;

    -- Final Health Index Calculation
    -- Weightage: Efficiency (30%) + Outstanding (20%) + Burn Rate (20%) + Constant (30% placeholder for forecast/others)
    v_health_index := (v_efficiency_score * 0.3) + ((100 - v_outstanding_ratio) * 0.2) + (v_burn_rate_stability * 0.2) + 30.0;

    RETURN json_build_object(
        'health_index', ROUND(v_health_index, 2),
        'collection_efficiency', ROUND(v_efficiency_score, 2),
        'outstanding_ratio', ROUND(v_outstanding_ratio, 2),
        'burn_rate_stability', ROUND(v_burn_rate_stability, 2),
        'total_revenue_30d', v_monthly_revenue,
        'total_expense_30d', v_monthly_expenses
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. SEED DATA: Chart of Accounts
INSERT INTO finance_chart_of_accounts (code, name, type, category) VALUES
('1010', 'Cash in Hand', 'Asset', 'Cash'),
('1020', 'Institutional Bank Account', 'Asset', 'Cash'),
('1200', 'Student Accounts Receivable', 'Asset', 'Receivable'),
('4010', 'Tuition Fee Income', 'Revenue', 'Income'),
('4020', 'Transport Fee Income', 'Revenue', 'Income'),
('5010', 'Staff Salary Expenses', 'Expense', 'Salaries'),
('5020', 'Electricity & Utilities', 'Expense', 'Operational'),
('5030', 'Marketing & Events', 'Expense', 'Operational')
ON CONFLICT (code) DO NOTHING;
