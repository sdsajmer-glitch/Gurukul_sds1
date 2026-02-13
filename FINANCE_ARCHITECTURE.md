# Enterprise Finance Microservices Architecture

## 🏛️ System Overview
The Institutional Finance Center is designed as a high-throughput, event-driven ecosystem. It moves beyond simple fee collection into an **International Standard Financial Governance Engine**, supporting multi-tenant branch isolation, double-entry bookkeeping, and AI-driven risk mitigation.

## 📊 ER Diagram (Conceptual Mapping)

### 1. Foundation & Tenancy
`Institutions` (1) ───< (N) `Branches` (1) ───< (N) `Academic Cycles`

### 2. Governance Master
`Academic Cycles` (1) ───< (N) `Fee Templates`
`Fee Templates` (1) ───┬─< (N) `Fee Components` (Tuition, Transport, etc.)
                      └─< (N) `Grade/Section Mapping`

### 3. Student Billing Engine
`Students` (1) ───< (1) `Student Fee Ledger` (Per Cycle)
`Student Fee Ledger` (1) ───┬─< (N) `Installment Schedule` (Monthly/Quarterly)
                            └─< (N) `Component Breakdown`

### 4. Payment & Fiscal Integrity
`Student Fee Ledger` (1) ───< (N) `Payments`
`Payments` (1) ───┬─< (1) `Receipts` (Cryptographically signed)
                  └─< (N) `Refunds` (Partial/Full tracks)

### 5. Ledger Service (Double-Entry Engine)
`Journal Entries` (1) ───< (N) `Journal Entry Lines`
`Chart of Accounts` (1) ───< (N) `Journal Entry Lines`
`Journal Entry Lines` (1) ───> (1) `General Ledger`
*Integrity Constraint: Σ Debit = Σ Credit*

### 6. Operational & Compliance
`Vendors` (1) ───< (N) `Expenses`
`Employees` (1) ───< (N) `Payroll Transactions`
`Audit Logs` ─── Reference ALL Entities (Immutable)

### 7. Intelligence Layer
`Financial Summary Snapshot` (Branch aggregated metrics)
`Student Risk Scores` (AI Predictive analytics)
`Finance Event Log` (Event replay & state synchronization)

## 🛠️ Technical Specifications
- **Database:** PostgreSQL (Supabase)
- **Primary Keys:** UUID (v4) for microservice scaling
- **Tenancy:** `branch_id` indexing on every transaction node
- **Accounting Standard:** IFRS/GAAP Compliant Double-Entry
- **Scaling Target:** 50,000+ Synchronous Students

## 📡 Event Lifecycle
1. **FEE_PROVISIONED**: Ledger generated from Template mapping.
2. **PAYMENT_RECEIVED**: Payment recorded -> Journal Entry created -> Ledger updated.
3. **RECONCILIATION_SYNC**: General Ledger balanced against Sub-Ledgers.
4. **RISK_EVALUATED**: AI engine triggers score update based on payment lag.
