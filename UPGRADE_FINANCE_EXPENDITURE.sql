
-- =============================================================================
-- FINANCE EXPENDITURE ENGINE UPGRADE (Phase 3.3)
-- =============================================================================
-- Target: Operational Spending, Disbursement Nexus, and Artifact Storage.
-- Resolves: Missing admin_record_expense_v3 RPC and Schema Desync.
-- =============================================================================

BEGIN;

-- 1. [SCHEMA] Infrastructure Harmonization
DO $$ 
BEGIN
    -- Ensure Category Registry
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'expense_categories') THEN
        CREATE TABLE public.expense_categories (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Seed Core Categories
        INSERT INTO public.expense_categories (name, description) VALUES
        ('Maintenance', 'Infrastructure repairs and upkeep'),
        ('Utilities', 'Electricity, Water, and basic services'),
        ('Salaries', 'Staff and Faculty disbursements'),
        ('Marketing', 'Lead generation and events'),
        ('Academics', 'Books, Labs, and teaching materials'),
        ('General', 'Miscellaneous operations')
        ON CONFLICT (name) DO NOTHING;
    END IF;

    -- Ensure Audit Registry can handle magnitudes and action types
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_governance_audit' AND column_name = 'magnitude') THEN
        ALTER TABLE public.finance_governance_audit ADD COLUMN magnitude NUMERIC(15, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_governance_audit' AND column_name = 'action_type') THEN
        ALTER TABLE public.finance_governance_audit ADD COLUMN action_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_governance_audit' AND column_name = 'user_id') THEN
        ALTER TABLE public.finance_governance_audit ADD COLUMN user_id UUID;
    END IF;

    -- Update legacy records if needed
    UPDATE public.finance_governance_audit SET action_type = action WHERE action_type IS NULL AND action IS NOT NULL;
END $$;

-- 2. [CORE] Harmonize finance_expenses with Enterprise Protocol
CREATE TABLE IF NOT EXISTS public.finance_expenses (
    id SERIAL PRIMARY KEY,
    branch_id BIGINT REFERENCES public.school_branches(id),
    category_id INTEGER REFERENCES public.expense_categories(id),
    category VARCHAR(100), -- Legacy column for fallback
    vendor_name VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Paid',
    receipt_url TEXT,
    description TEXT,
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. [RPC] admin_record_expense_v3: The Atomic Disbursement Hook
CREATE OR REPLACE FUNCTION public.admin_record_expense_v3(
    p_branch_id BIGINT,
    p_category_id INTEGER,
    p_amount NUMERIC,
    p_vendor_name TEXT,
    p_expense_date DATE,
    p_description TEXT,
    p_payment_mode TEXT,
    p_recorded_by UUID,
    p_file_name TEXT DEFAULT NULL,
    p_storage_path TEXT DEFAULT NULL,
    p_file_size BIGINT DEFAULT NULL,
    p_mime_type TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_expense_id INTEGER;
    v_category_name TEXT;
BEGIN
    -- Resolve Category Identity
    SELECT name INTO v_category_name FROM public.expense_categories WHERE id = p_category_id;

    -- Atomic Insert into Disbursement Node
    INSERT INTO public.finance_expenses (
        branch_id,
        category_id,
        category,
        vendor_name,
        amount,
        payment_date,
        payment_method,
        status,
        receipt_url,
        description,
        recorded_by
    ) VALUES (
        p_branch_id,
        p_category_id,
        COALESCE(v_category_name, 'Uncategorized'),
        p_vendor_name,
        p_amount,
        p_expense_date,
        p_payment_mode,
        'Paid',
        p_storage_path,
        p_description,
        p_recorded_by
    ) RETURNING id INTO v_expense_id;

    -- governance_audit: Log the fiscal movement (using enterprise production schema columns)
    INSERT INTO public.finance_governance_audit (
        branch_id,
        user_id,
        action_type,
        module,
        description,
        magnitude
    ) VALUES (
        p_branch_id,
        p_recorded_by,
        'EXPENSE_RECORDED',
        'FINANCE_EXPENDITURE',
        'Recorded disbursement to ' || p_vendor_name || ' for ' || COALESCE(v_category_name, 'Uncategorized') || '. Magnitude: ₹' || p_amount::TEXT,
        p_amount
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', v_expense_id,
        'category', v_category_name,
        'timestamp', NOW()
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM,
        'hint', 'Ensure categorical node exists in registry'
    );
END;
$$;

-- 4. [PERMISSIONS] Secure the Disbursement Nexus
GRANT ALL ON public.finance_expenses TO authenticated;
GRANT ALL ON public.expense_categories TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_expense_v3 TO authenticated;

COMMIT;

SELECT 'SUCCESS: Expenditure Engine Upgraded. disbursement Nexus Active.' as report;
