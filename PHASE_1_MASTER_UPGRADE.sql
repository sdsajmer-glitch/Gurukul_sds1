-- PHASE 1: INSTITUTIONAL OPS - FINANCE MASTER UPGRADE
-- Adds enterprise-grade mapping fields for Chart of Accounts and Taxation.

BEGIN;

-- 1. Upgrade fee_components table with accounting and regulatory nodes
ALTER TABLE fee_components ADD COLUMN IF NOT EXISTS gl_code TEXT;
ALTER TABLE fee_components ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC(5,2) DEFAULT 0;
ALTER TABLE fee_components ADD COLUMN IF NOT EXISTS is_refundable BOOLEAN DEFAULT false;

-- 2. Ensure naming follows global institutional standards if not already set
COMMENT ON COLUMN fee_components.gl_code IS 'Mapping to the Master Chart of Accounts (CoA) node identifier';
COMMENT ON COLUMN fee_components.tax_percentage IS 'Applicable tax percentage for this specific ledger node';
COMMENT ON COLUMN fee_components.is_refundable IS 'Determines if the component is eligible for exit-period refunding';

COMMIT;
