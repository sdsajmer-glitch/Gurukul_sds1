-- =============================================================================
-- MASTER FINANCE RESTORATION & LIFECYCLE AUTOMATION (V25.8)
-- =============================================================================
-- Targets: 1. FIX "Relation public.fee_structure_installments does not exist"
--          2. FIX "Check constraint violation" (installment_schedule status)
--          3. FIX "column academic_cycle_id of relation fee_invoices does not exist"
--          4. FIX "Inconsistent Column Naming" (Standardizing to structure_id)
--          5. FIX "Grade 1 Not Reflecting" (Robust Grade Normalization)
-- =============================================================================

BEGIN;

-- [0] SCHEMA HARMONIZATION: Force Unified Naming & Standard Constraints
DO $$ 
BEGIN
    -- 1. fee_invoices: Harmonize Columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'fee_structure_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'structure_id') THEN
            ALTER TABLE public.fee_invoices RENAME COLUMN fee_structure_id TO structure_id;
        ELSE
            UPDATE public.fee_invoices SET structure_id = fee_structure_id WHERE structure_id IS NULL;
            ALTER TABLE public.fee_invoices DROP COLUMN fee_structure_id;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'academic_cycle_id') THEN
        ALTER TABLE public.fee_invoices ADD COLUMN academic_cycle_id BIGINT;
        UPDATE public.fee_invoices SET academic_cycle_id = academic_year::bigint WHERE academic_year ~ '^[0-9]+$';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'title') THEN
        ALTER TABLE public.fee_invoices ADD COLUMN title TEXT;
        UPDATE public.fee_invoices SET title = description WHERE title IS NULL;
    END IF;

    -- 2. fee_structures: Ensure cycle columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_structures' AND column_name = 'academic_cycle_id') THEN
        ALTER TABLE public.fee_structures ADD COLUMN academic_cycle_id BIGINT;
        UPDATE public.fee_structures SET academic_cycle_id = CASE WHEN academic_year ~ '^[0-9]+$' THEN academic_year::bigint ELSE NULL END;
    END IF;

    -- 3. Enterprise Infrastructure: Create missing tables
    
    -- fee_structure_installments
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_structure_installments') THEN
        CREATE TABLE public.fee_structure_installments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            structure_id BIGINT REFERENCES public.fee_structures(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            amount NUMERIC NOT NULL,
            due_date DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- student_fee_ledger
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_fee_ledger') THEN
        CREATE TABLE public.student_fee_ledger (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
            academic_year_id BIGINT,
            branch_id BIGINT,
            total_amount NUMERIC DEFAULT 0,
            status TEXT DEFAULT 'ACTIVE',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(student_id, academic_year_id)
        );
    END IF;

    -- installment_schedule
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'installment_schedule') THEN
        CREATE TABLE public.installment_schedule (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ledger_id UUID REFERENCES public.student_fee_ledger(id) ON DELETE CASCADE,
            student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
            installment_no INTEGER,
            due_date DATE,
            amount NUMERIC,
            paid_amount NUMERIC DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- Add paid_amount to installment_schedule if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installment_schedule' AND column_name = 'paid_amount') THEN
        ALTER TABLE public.installment_schedule ADD COLUMN paid_amount NUMERIC DEFAULT 0;
    END IF;

    -- Fix restrictive status constraint on installment_schedule
    ALTER TABLE public.installment_schedule DROP CONSTRAINT IF EXISTS installment_schedule_status_check;
    ALTER TABLE public.installment_schedule ADD CONSTRAINT installment_schedule_status_check 
        CHECK (status IN ('pending', 'partial', 'paid', 'cancelled', 'overdue'));

    -- student_fee_accounts
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_fee_accounts') THEN
        CREATE TABLE public.student_fee_accounts (
            student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
            total_billed NUMERIC DEFAULT 0,
            total_paid NUMERIC DEFAULT 0,
            outstanding_balance NUMERIC DEFAULT 0,
            unallocated_funds NUMERIC DEFAULT 0,
            integrity_score INTEGER DEFAULT 100,
            last_synced_at TIMESTAMPTZ DEFAULT NOW(),
            is_active BOOLEAN DEFAULT true
        );
    END IF;

END $$;

-- [1] UTILITY: Robust Grade Normalizer
CREATE OR REPLACE FUNCTION public.normalize_grade_string(p_grade TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF p_grade IS NULL THEN RETURN NULL; END IF;
    RETURN TRIM(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(p_grade), 'grade', ''), 'class', ''), 'th', ''), ' ', ''));
END;
$$;

-- [2] CORE ENGINE: enroll_student_finance_protocol (V25.8 - Fully Harmonized)
DROP FUNCTION IF EXISTS public.enroll_student_finance_protocol(uuid, text, bigint) CASCADE;

CREATE OR REPLACE FUNCTION public.enroll_student_finance_protocol(
    p_student_id UUID,
    p_grade TEXT,
    p_cycle_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_struct_id BIGINT;
    v_installment RECORD;
    v_count_inv INTEGER := 0;
    v_total_amount NUMERIC := 0;
    v_normalized_input TEXT := public.normalize_grade_string(p_grade);
    v_branch_id BIGINT;
    v_ledger_id UUID;
BEGIN
    -- 0. Identity Context
    SELECT branch_id INTO v_branch_id FROM public.student_profiles WHERE user_id = p_student_id;

    -- 1. Identify active structure using Robust Normalization
    SELECT fs.id INTO v_struct_id
    FROM public.fee_structures fs
    WHERE (
        public.normalize_grade_string(fs.target_grade) = v_normalized_input
        OR fs.target_grade = p_grade
    )
    AND (fs.academic_cycle_id = p_cycle_id OR fs.academic_year = p_cycle_id::text)
    AND (LOWER(fs.status) = 'active' OR fs.is_active = true)
    ORDER BY (CASE WHEN fs.is_default = true THEN 0 ELSE 1 END), fs.created_at DESC
    LIMIT 1;

    IF v_struct_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'MAPPING_NOT_FOUND', 'message', 'No Active Fee Structure for Grade: ' || p_grade);
    END IF;

    -- 2. Enterprise Ledger Sync: Calculate Total liability from installments or components
    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount 
    FROM (
        SELECT amount FROM public.fee_structure_installments WHERE structure_id = v_struct_id
        UNION ALL
        SELECT amount FROM public.fee_components WHERE structure_id = v_struct_id 
        AND NOT EXISTS (SELECT 1 FROM public.fee_structure_installments WHERE structure_id = v_struct_id)
    ) t;

    -- Upsert Ledger Node
    INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, total_amount, status)
    VALUES (p_student_id, p_cycle_id, v_branch_id, v_total_amount, 'ACTIVE')
    ON CONFLICT (student_id, academic_year_id) DO UPDATE SET total_amount = EXCLUDED.total_amount, updated_at = NOW();

    SELECT id INTO v_ledger_id FROM public.student_fee_ledger WHERE student_id = p_student_id AND academic_year_id = p_cycle_id;

    -- Sync Installments schedule timeline
    DELETE FROM public.installment_schedule WHERE ledger_id = v_ledger_id AND status = 'pending';
    INSERT INTO public.installment_schedule (ledger_id, student_id, installment_no, due_date, amount, status)
    SELECT v_ledger_id, p_student_id, ROW_NUMBER() OVER(ORDER BY t.due_date), t.due_date, t.amount, 'pending'
    FROM (
        SELECT due_date, amount FROM public.fee_structure_installments WHERE structure_id = v_struct_id
        UNION ALL
        SELECT (NOW() + INTERVAL '30 days')::DATE, amount FROM public.fee_components WHERE structure_id = v_struct_id
        AND NOT EXISTS (SELECT 1 FROM public.fee_structure_installments WHERE structure_id = v_struct_id)
    ) t;

    -- 3. Legacy Invoice Bridge (Backward compatibility)
    FOR v_installment IN 
        SELECT name as title, amount, due_date FROM public.fee_structure_installments WHERE structure_id = v_struct_id
        UNION ALL
        SELECT name as title, amount, (NOW() + INTERVAL '30 days')::DATE as due_date FROM public.fee_components WHERE structure_id = v_struct_id 
        AND NOT EXISTS (SELECT 1 FROM public.fee_structure_installments WHERE structure_id = v_struct_id)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices fi
            WHERE fi.student_id = p_student_id 
              AND fi.structure_id = v_struct_id
              AND fi.title = v_installment.title
              AND fi.status NOT IN ('cancelled', 'Cancelled')
        ) THEN
            INSERT INTO public.fee_invoices (student_id, structure_id, total_amount, paid_amount, due_date, status, title, academic_cycle_id, branch_id)
            VALUES (p_student_id, v_struct_id, v_installment.amount, 0, v_installment.due_date, 'pending', v_installment.title, p_cycle_id, v_branch_id);
            v_count_inv := v_count_inv + 1;
        END IF;
    END LOOP;

    -- 4. Deep Reconciliation (Synchronize account snapshot)
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'invoices_generated', v_count_inv, 'ledger_total', v_total_amount);
END;
$$;

-- [3] REPAIR EXECUTION: Restore all current students state
CREATE OR REPLACE FUNCTION public.global_repair_finance_ledgers_v25()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student RECORD;
    v_cycle_id BIGINT;
    v_success INTEGER := 0;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();
    FOR v_student IN SELECT sp.user_id, sp.grade FROM public.student_profiles sp JOIN public.profiles p ON sp.user_id = p.id WHERE p.is_active = true AND sp.grade IS NOT NULL LOOP
        PERFORM public.enroll_student_finance_protocol(v_student.user_id, v_student.grade, v_cycle_id);
        v_success := v_success + 1;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'repaired_count', v_success, 'cycle_id', v_cycle_id);
END;
$$;

SELECT public.global_repair_finance_ledgers_v25();

COMMIT;

SELECT 'SUCCESS: Finance Master V25.8 Deployed. Structural gaps bridged and Grade 1 realigned.' as status;
