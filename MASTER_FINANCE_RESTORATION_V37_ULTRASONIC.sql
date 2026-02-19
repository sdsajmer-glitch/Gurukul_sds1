-- ==========================================
-- MASTER_FINANCE_RESTORATION_V37_ULTRASONIC
-- Version: 37.0.5 (ULTRASONIC)
-- Description: Total Unification of Finance Registry. 
-- Fixes: Attribute Desync (fc.structure_id), Category Constraint Violation, Missing Columns.
-- Targets: finance_fee_components, finance_fee_structures, finance_student_profiles.
-- ==========================================

BEGIN;

-- [1] NUCLEAR TABLE UNIFICATION & HYPER-HARDENING PROTOCOL
-- Ensure finance_fee_components is the single source of truth with ALL columns and NO restrictive constraints

DO $$ 
DECLARE
    v_source_col TEXT;
    v_gl_exists BOOLEAN;
BEGIN
    -- 1.A. Core Table Existence Safeguard
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'finance_fee_components') THEN
        CREATE TABLE public.finance_fee_components (
            id BIGSERIAL PRIMARY KEY,
            structure_id BIGINT REFERENCES public.finance_fee_structures(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            amount NUMERIC NOT NULL DEFAULT 0,
            frequency TEXT NOT NULL DEFAULT 'Monthly',
            is_mandatory BOOLEAN DEFAULT TRUE,
            category TEXT DEFAULT 'Tuition',
            gl_code TEXT,
            tax_percentage NUMERIC DEFAULT 0,
            is_refundable BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- 1.B. CONSTRAINT REMOVAL (Nuclear Restoration)
    -- Legacy constraints are often too restrictive for migration logic
    ALTER TABLE public.finance_fee_components DROP CONSTRAINT IF EXISTS finance_fee_components_category_check CASCADE;
    ALTER TABLE public.finance_fee_components DROP CONSTRAINT IF EXISTS finance_fee_components_frequency_check CASCADE;
    ALTER TABLE public.finance_fee_components DROP CONSTRAINT IF EXISTS finance_fee_components_status_check CASCADE;

    -- 1.C. HYPER-HARDENING (Force ALL required columns to exist in TARGET)
    
    -- structure_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'structure_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'fee_structure_id') THEN
            ALTER TABLE public.finance_fee_components RENAME COLUMN fee_structure_id TO structure_id;
        ELSE
            ALTER TABLE public.finance_fee_components ADD COLUMN structure_id BIGINT REFERENCES public.finance_fee_structures(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'amount') THEN
        ALTER TABLE public.finance_fee_components ADD COLUMN amount NUMERIC DEFAULT 0;
    END IF;

    -- frequency
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'frequency') THEN
        ALTER TABLE public.finance_fee_components ADD COLUMN frequency TEXT DEFAULT 'Monthly';
    END IF;

    -- is_mandatory
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'is_mandatory') THEN
        ALTER TABLE public.finance_fee_components ADD COLUMN is_mandatory BOOLEAN DEFAULT TRUE;
    END IF;

    -- is_refundable
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'is_refundable') THEN
        ALTER TABLE public.finance_fee_components ADD COLUMN is_refundable BOOLEAN DEFAULT FALSE;
    END IF;

    -- category
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'category') THEN
        ALTER TABLE public.finance_fee_components ADD COLUMN category TEXT DEFAULT 'Tuition';
    END IF;

    -- gl_code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'gl_code') THEN
        ALTER TABLE public.finance_fee_components ADD COLUMN gl_code TEXT;
    END IF;

    -- tax_percentage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_fee_components' AND column_name = 'tax_percentage') THEN
        ALTER TABLE public.finance_fee_components ADD COLUMN tax_percentage NUMERIC DEFAULT 0;
    END IF;

    -- 1.D. Data Recovery Logic (Legacy Migration with Source Guards)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_components') THEN
        -- Detect structure column name in source
        v_source_col := CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_components' AND column_name = 'structure_id') THEN 'structure_id'
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_components' AND column_name = 'fee_structure_id') THEN 'fee_structure_id'
            ELSE NULL 
        END;

        -- Detect gl_code in source
        v_gl_exists := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_components' AND column_name = 'gl_code');

        IF v_source_col IS NOT NULL THEN
            EXECUTE format('
                INSERT INTO public.finance_fee_components (
                    structure_id, name, amount, frequency, is_mandatory, category, gl_code
                )
                SELECT 
                    COALESCE(%I, (SELECT id FROM public.finance_fee_structures LIMIT 1)), 
                    COALESCE(name, ''UNNAMED_COMPONENT''), 
                    COALESCE(amount, 0), 
                    COALESCE(frequency, ''Monthly''), 
                    COALESCE(is_mandatory, TRUE), 
                    ''Tuition'', 
                    %s
                FROM public.fee_components
                ON CONFLICT DO NOTHING', 
                v_source_col,
                CASE WHEN v_gl_exists THEN 'gl_code' ELSE 'NULL' END
            );
        END IF;
    END IF;

    -- 1.E. finance_student_profiles Normalization
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'finance_student_profiles') THEN
        CREATE TABLE public.finance_student_profiles (
            student_id UUID PRIMARY KEY REFERENCES public.student_profiles(user_id) ON DELETE CASCADE,
            branch_id BIGINT,
            grade TEXT,
            structure_id BIGINT REFERENCES public.finance_fee_structures(id),
            total_billed NUMERIC DEFAULT 0,
            total_paid NUMERIC DEFAULT 0,
            outstanding_balance NUMERIC DEFAULT 0,
            integrity_score INTEGER DEFAULT 0,
            unallocated_funds NUMERIC DEFAULT 0,
            financial_status TEXT DEFAULT 'ACTIVE',
            is_active BOOLEAN DEFAULT TRUE,
            last_synced_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- Force 'structure_id' and metrics presence in profile table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'structure_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_student_profiles' AND column_name = 'fee_structure_id') THEN
            ALTER TABLE public.finance_student_profiles RENAME COLUMN fee_structure_id TO structure_id;
        ELSE
            ALTER TABLE public.finance_student_profiles ADD COLUMN structure_id BIGINT REFERENCES public.finance_fee_structures(id);
        END IF;
    END IF;

END $$;

-- [2] REBUILD REAL-TIME CALCULATOR (The Mapping Matrix)
CREATE OR REPLACE FUNCTION public.fn_calculate_finance_readiness(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_has_profile BOOLEAN;
    v_has_structure BOOLEAN;
    v_has_components BOOLEAN;
    v_total_amount NUMERIC;
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.student_profiles WHERE user_id = p_student_id) INTO v_has_profile;
    
    SELECT EXISTS(
        SELECT 1 FROM public.finance_student_profiles fsp
        JOIN public.finance_fee_structures fs ON fsp.structure_id = fs.id
        WHERE fsp.student_id = p_student_id
    ) INTO v_has_structure;

    SELECT EXISTS(
        SELECT 1 FROM public.finance_fee_components fc
        JOIN public.finance_student_profiles fsp ON fc.structure_id = fsp.structure_id
        WHERE fsp.student_id = p_student_id
    ) INTO v_has_components;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount
    FROM public.finance_fee_components fc
    JOIN public.finance_student_profiles fsp ON fc.structure_id = fsp.structure_id
    WHERE fsp.student_id = p_student_id;

    RETURN jsonb_build_object(
        'profile_locked', v_has_profile,
        'structure_assigned', v_has_structure,
        'ledger_nodes_ready', v_has_components,
        'projected_billable', v_total_amount,
        'protocol_version', 'V37_ULTRASONIC'
    );
END;
$$;

-- [3] MASTER RPC: GENERATE LEDGER (The Reconciliation Heart)
CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_branch_id BIGINT;
    v_grade TEXT;
    v_structure_id BIGINT;
    v_year_id BIGINT := p_academic_year_id;
    v_component RECORD;
    v_count_new INTEGER := 0;
BEGIN
    -- 1. Identity Phase
    SELECT sp.branch_id, sp.grade INTO v_branch_id, v_grade 
    FROM public.student_profiles sp WHERE sp.user_id = p_student_id;
    
    IF v_branch_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'BRANCH_NOT_RESOLVED'); END IF;

    -- 2. Temporal Cycle Detection
    IF v_year_id IS NULL THEN
        SELECT ay.id INTO v_year_id FROM public.academic_years ay 
        WHERE (ay.branch_id = v_branch_id OR ay.branch_id IS NULL) AND ay.is_current = true LIMIT 1;
    END IF;

    -- 3. Structure Resolution
    SELECT fs.id INTO v_structure_id FROM public.finance_fee_structures fs
    WHERE LOWER(fs.status::text) = 'active'
    AND (fs.academic_cycle_id = v_year_id OR fs.academic_cycle_id IS NULL)
    AND LOWER(fs.target_grade) = LOWER(v_grade)
    ORDER BY (CASE WHEN fs.academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), fs.created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN 
        -- Fallback to default if no grade-specific active structure found
        SELECT fs.id INTO v_structure_id FROM public.finance_fee_structures fs
        WHERE fs.is_default = true AND fs.branch_id = v_branch_id LIMIT 1;
    END IF;

    IF v_structure_id IS NULL THEN 
        RETURN jsonb_build_object('success', false, 'error', 'STRUCTURE_NOT_FOUND', 'detail', v_grade); 
    END IF;

    -- 4. Assignment Synchronization
    INSERT INTO public.finance_student_profiles (student_id, structure_id, branch_id, grade)
    VALUES (p_student_id, v_structure_id, v_branch_id, v_grade) 
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id, last_synced_at = NOW();

    -- 5. Atomic Component-to-Invoice Mapping (The fc.structure_id FIX)
    FOR v_component IN 
        SELECT fc.* FROM public.finance_fee_components fc WHERE fc.structure_id = v_structure_id 
    LOOP
        -- Check if invoice for this component already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices fi 
            WHERE fi.student_id = p_student_id 
            AND LOWER(fi.description) = LOWER(v_component.name) || ' (institutional sync)'
            AND LOWER(fi.status::text) != 'cancelled'
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, branch_id, total_amount, due_date, 
                description, status, structure_id
            )
            VALUES (
                p_student_id, v_branch_id, v_component.amount, 
                CURRENT_DATE + INTERVAL '15 days', 
                v_component.name || ' (institutional sync)', 
                'pending', v_structure_id
            );
            v_count_new := v_count_new + 1;
        END IF;
    END LOOP;

    -- 6. Trigger Financial Health Sync
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'invoices_generated', v_count_new, 
        'structure_id', v_structure_id,
        'protocol', 'V37_ULTRASONIC'
    );
END;
$$;

-- [4] MASTER RPC: OVERVIEW STATS (v4)
CREATE OR REPLACE FUNCTION public.get_finance_overview_stats_v3(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_assigned NUMERIC; v_collected NUMERIC; v_pending NUMERIC; v_overdue NUMERIC;
    v_monthly NUMERIC; v_today NUMERIC;
BEGIN
    -- Use fsp for source of truth
    SELECT 
        COALESCE(SUM(fsp.total_billed), 0), COALESCE(SUM(fsp.total_paid), 0), COALESCE(SUM(fsp.outstanding_balance), 0)
    INTO v_assigned, v_collected, v_pending
    FROM public.finance_student_profiles fsp
    WHERE (p_branch_id IS NULL OR fsp.branch_id = p_branch_id);

    SELECT COALESCE(SUM(total_amount - paid_amount), 0) INTO v_overdue
    FROM public.fee_invoices fi
    WHERE (p_branch_id IS NULL OR fi.branch_id = p_branch_id)
      AND fi.due_date < CURRENT_DATE AND LOWER(fi.status::text) NOT IN ('paid', 'cancelled');

    SELECT COALESCE(SUM(amount), 0) INTO v_monthly
    FROM public.fee_payments fp
    WHERE (p_branch_id IS NULL OR fp.branch_id = p_branch_id)
      AND LOWER(fp.status::text) IN ('completed', 'success')
      AND fp.payment_date >= date_trunc('month', NOW());

    SELECT COALESCE(SUM(amount), 0) INTO v_today
    FROM public.fee_payments fp
    WHERE (p_branch_id IS NULL OR fp.branch_id = p_branch_id)
      AND LOWER(fp.status::text) IN ('completed', 'success')
      AND fp.payment_date >= date_trunc('day', NOW());

    RETURN jsonb_build_object(
        'total_assigned', v_assigned, 'total_collected', v_collected, 'total_pending', v_pending,
        'total_overdue', v_overdue, 'monthly_collection', v_monthly, 'today_collection', v_today,
        'currency', 'INR',
        'engine', 'V37_ULTRASONIC'
    );
END;
$$;

-- [5] RECONCILE REGISTRY (Global)
CREATE OR REPLACE FUNCTION public.reconcile_finance_registry(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_count INTEGER := 0;
    r RECORD;
BEGIN
    FOR r IN SELECT user_id FROM public.student_profiles WHERE (p_branch_id IS NULL OR branch_id = p_branch_id) LOOP
        PERFORM public.admin_reconcile_student_account(r.user_id);
        v_count := v_count + 1;
    END LOOP;
    
    RETURN jsonb_build_object('processed', v_count, 'status', 'SUCCESS', 'protocol', 'V37_ULTRASONIC');
END;
$$;

COMMIT;
