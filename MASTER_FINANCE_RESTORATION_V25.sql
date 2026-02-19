-- =============================================================================
-- MASTER FINANCE RESTORATION & LIFECYCLE AUTOMATION (V25.1)
-- =============================================================================
-- Targets: 1. FIX "Column reference does not exist" (fee_structure_id vs structure_id)
--          2. FIX "Relation does not exist" (fee_structure_installments)
--          3. FIX "Grade 1 Not Reflecting" (Robust Grade Normalization)
--          4. UNIFY Double-Architecture (Invoices + Ledger Support)
-- =============================================================================

BEGIN;

-- [0] INFRASTRUCTURE HARDENING: Standardize Schema to structure_id
-- This resolves the structural desync between legacy and enterprise modules

DO $$ 
BEGIN
    -- 1. fee_invoices: Standardize to structure_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'fee_structure_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'structure_id') THEN
            ALTER TABLE public.fee_invoices RENAME COLUMN fee_structure_id TO structure_id;
        ELSE
            -- Both exist? Drop the redundant one after syncing if needed (Rare)
            ALTER TABLE public.fee_invoices DROP COLUMN fee_structure_id;
        END IF;
    END IF;

    -- 2. fee_structures: Ensure cycle columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_structures' AND column_name = 'academic_cycle_id') THEN
        ALTER TABLE public.fee_structures ADD COLUMN academic_cycle_id BIGINT;
        UPDATE public.fee_structures SET academic_cycle_id = academic_year::bigint WHERE academic_year ~ '^[0-9]+$';
    END IF;

    -- 3. Create missing Ledger Supporting Tables (Standardized to architecture)
    CREATE TABLE IF NOT EXISTS public.fee_structure_installments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fee_structure_id BIGINT REFERENCES public.fee_structures(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        due_date DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.student_fee_ledger (
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

    CREATE TABLE IF NOT EXISTS public.installment_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ledger_id UUID REFERENCES public.student_fee_ledger(id) ON DELETE CASCADE,
        student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        installment_no INTEGER,
        due_date DATE,
        amount NUMERIC,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.student_fee_accounts (
        student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
        total_billed NUMERIC DEFAULT 0,
        total_paid NUMERIC DEFAULT 0,
        outstanding_balance NUMERIC DEFAULT 0,
        unallocated_funds NUMERIC DEFAULT 0,
        integrity_score INTEGER DEFAULT 100,
        last_synced_at TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
    );
END $$;

-- [1] UTILITY: Robust Grade Normalizer
CREATE OR REPLACE FUNCTION public.normalize_grade_string(p_grade TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF p_grade IS NULL THEN RETURN NULL; END IF;
    RETURN TRIM(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(p_grade), 'grade', ''), 'class', ''), 'th', ''), ' ', ''));
END;
$$;

-- [2] CORE REPAIR: enroll_student_finance_protocol (V25.1 - Harmonized Columns)
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

    -- 1. Identify active structure
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

    -- 2. Calculate Total Liability
    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount 
    FROM (
        SELECT amount FROM public.fee_structure_installments WHERE fee_structure_id = v_struct_id
        UNION ALL
        SELECT amount FROM public.fee_components WHERE structure_id = v_struct_id 
        AND NOT EXISTS (SELECT 1 FROM public.fee_structure_installments WHERE fee_structure_id = v_struct_id)
    ) t;

    -- Upsert Ledger
    INSERT INTO public.student_fee_ledger (student_id, academic_year_id, branch_id, total_amount, status)
    VALUES (p_student_id, p_cycle_id, v_branch_id, v_total_amount, 'ACTIVE')
    ON CONFLICT (student_id, academic_year_id) DO UPDATE SET total_amount = EXCLUDED.total_amount, status = 'ACTIVE', updated_at = NOW()
    RETURNING id INTO v_ledger_id;

    -- Sync Installments Schedule
    DELETE FROM public.installment_schedule WHERE ledger_id = v_ledger_id AND status = 'pending';
    INSERT INTO public.installment_schedule (ledger_id, student_id, installment_no, due_date, amount, status)
    SELECT v_ledger_id, p_student_id, ROW_NUMBER() OVER(ORDER BY t.due_date), t.due_date, t.amount, 'pending'
    FROM (
        SELECT due_date, amount FROM public.fee_structure_installments WHERE fee_structure_id = v_struct_id
        UNION ALL
        SELECT (NOW() + INTERVAL '30 days')::DATE, amount FROM public.fee_components WHERE structure_id = v_struct_id
        AND NOT EXISTS (SELECT 1 FROM public.fee_structure_installments WHERE fee_structure_id = v_struct_id)
    ) t;

    -- Architecture B: Invoices (Backward compatibility using standardized structure_id column)
    FOR v_installment IN 
        SELECT name as title, amount, due_date FROM public.fee_structure_installments WHERE fee_structure_id = v_struct_id
        UNION ALL
        SELECT name as title, amount, (NOW() + INTERVAL '30 days')::DATE as due_date FROM public.fee_components WHERE structure_id = v_struct_id 
        AND NOT EXISTS (SELECT 1 FROM public.fee_structure_installments WHERE fee_structure_id = v_struct_id)
    LOOP
        -- Note: We now exclusively use 'structure_id' which was harmonized in the setup block
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
              AND structure_id = v_struct_id
              AND title = v_installment.title
              AND status NOT IN ('cancelled', 'Cancelled')
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, structure_id, total_amount, paid_amount, 
                due_date, status, title, academic_cycle_id, branch_id
            )
            VALUES (
                p_student_id, v_struct_id, v_installment.amount, 0,
                v_installment.due_date, 'pending', v_installment.title, p_cycle_id, v_branch_id
            );
            v_count_inv := v_count_inv + 1;
        END IF;
    END LOOP;

    -- 3. Synchronize Account Snapshot
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'invoices_generated', v_count_inv, 'ledger_total', v_total_amount);
END;
$$;

-- [3] TRIGGER ENGINE: trigger_enroll_finance_v2 (V25.1 - Polymorphic)
CREATE OR REPLACE FUNCTION public.trigger_enroll_finance_v2()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_cycle_id BIGINT;
    v_student_id UUID;
    v_grade TEXT;
BEGIN
    v_cycle_id := public.get_current_academic_cycle();
    
    BEGIN
        v_student_id := NEW.student_id; -- student_enrollments
    EXCEPTION WHEN OTHERS THEN
        v_student_id := NEW.user_id; -- student_profiles
    END;

    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = v_student_id;
    
    IF v_grade IS NULL AND to_jsonb(NEW) ? 'grade_level' THEN v_grade := NEW.grade_level; END IF;
    IF v_grade IS NULL AND to_jsonb(NEW) ? 'grade' THEN v_grade := NEW.grade; END IF;

    IF v_student_id IS NOT NULL AND v_grade IS NOT NULL AND v_cycle_id IS NOT NULL THEN
        PERFORM public.enroll_student_finance_protocol(v_student_id, v_grade, v_cycle_id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- [4] REGISTRY REPAIR: Fix profile_photo_url Ambiguity
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_financial_node(uuid, bigint) CASCADE;

CREATE OR REPLACE FUNCTION public.get_student_financial_node(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID, display_name TEXT, profile_photo_url TEXT, grade TEXT, class_name TEXT, 
    total_billed NUMERIC, total_paid NUMERIC, outstanding_balance NUMERIC, integrity_score INTEGER, 
    unallocated_funds NUMERIC, is_active BOOLEAN, is_standby BOOLEAN, academic_cycle_id BIGINT, 
    cycle_name TEXT, branch_id BIGINT, ledger_status TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_target_cycle_id BIGINT := p_cycle_id;
    v_target_cycle_name TEXT;
BEGIN
    IF v_target_cycle_id IS NULL THEN v_target_cycle_id := public.get_current_academic_cycle(); END IF;
    SELECT year_name INTO v_target_cycle_name FROM public.academic_years WHERE id = v_target_cycle_id;
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN QUERY
    SELECT 
        prof.id::UUID,
        COALESCE(prof.display_name, prof.email)::TEXT,
        COALESCE(prof.profile_photo_url, sprof.profile_photo_url)::TEXT,
        sprof.grade::TEXT,
        COALESCE(cls.name, 'UNASSIGNED')::TEXT,
        COALESCE(sacc.total_billed, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.total_paid, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.outstanding_balance, 0::NUMERIC)::NUMERIC,
        COALESCE(sacc.integrity_score, 100)::INTEGER,
        COALESCE(sacc.unallocated_funds, 0::NUMERIC)::NUMERIC,
        prof.is_active::BOOLEAN,
        (COALESCE(sacc.total_billed, 0) = 0)::BOOLEAN,
        v_target_cycle_id,
        COALESCE(v_target_cycle_name, 'N/A'),
        sprof.branch_id::BIGINT,
        COALESCE(sfl.status, 'NO_LEDGER')::TEXT
    FROM public.profiles prof
    JOIN public.student_profiles sprof ON prof.id = sprof.user_id
    LEFT JOIN public.school_classes cls ON sprof.assigned_class_id = cls.id
    LEFT JOIN public.student_fee_accounts sacc ON prof.id = sacc.student_id
    LEFT JOIN public.student_fee_ledger sfl ON prof.id = sfl.student_id AND sfl.academic_year_id = v_target_cycle_id
    WHERE prof.id = p_student_id
    LIMIT 1;
END;
$$;

-- [5] REPAIR EXECUTION: Reset all current students
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
    RETURN jsonb_build_object('success', true, 'repaired_count', v_success);
END;
$$;

SELECT public.global_repair_finance_ledgers_v25();

COMMIT;

SELECT 'SUCCESS: Finance Master V25.1 Deployed. Column structure_id harmonized and triggers realigned.' as status;
