-- ==============================================================================
-- GURUKUL OS: FINANCE ATTRIBUTE HARMONIZER (Structural Sync)
-- ==============================================================================
-- Target: Standardizes column naming across student_fee_assignments and functions.
-- Fixes: "Attribute Desync: column structure_id of relation student_fee_assignments does not exist"
-- ==============================================================================

BEGIN;

-- [1] TABLE RECONCILIATION: student_fee_assignments
DO $$ 
BEGIN
    -- Rename fee_structure_id to structure_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fee_assignments' AND column_name = 'fee_structure_id') THEN
        ALTER TABLE public.student_fee_assignments RENAME COLUMN fee_structure_id TO structure_id;
    END IF;

    -- Ensure unique constraint exists on (student_id, structure_id)
    -- First drop conflicting ones if they use old name
    ALTER TABLE public.student_fee_assignments DROP CONSTRAINT IF EXISTS student_fee_assignments_student_id_fee_structure_id_key;
    
    -- Add standardized unique constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_fee_assignments_identity_idx') THEN
        ALTER TABLE public.student_fee_assignments ADD CONSTRAINT student_fee_assignments_identity_idx UNIQUE (student_id, structure_id);
    END IF;
END $$;

-- [2] TABLE RECONCILIATION: fee_invoices
DO $$ 
BEGIN
    -- Standardize invoice structure for consistency
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_invoices' AND column_name = 'fee_structure_id') THEN
        ALTER TABLE public.fee_invoices RENAME COLUMN fee_structure_id TO structure_id;
    END IF;
END $$;

-- [3] RE-IMPLEMENT: generate_student_ledger_for_student (Unified Version)
CREATE OR REPLACE FUNCTION public.generate_student_ledger_for_student(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_grade TEXT;
    v_structure_id BIGINT;
    v_component RECORD;
    v_count INT := 0;
BEGIN
    SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = p_student_id;
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Grade context not initialized.');
    END IF;

    -- Pick the default active fee structure for this grade
    SELECT id INTO v_structure_id 
    FROM public.fee_structures 
    WHERE target_grade = v_grade AND status = 'Active' AND is_default = true
    ORDER BY created_at DESC LIMIT 1;

    IF v_structure_id IS NULL THEN
        -- Fallback: try active without default flag
        SELECT id INTO v_structure_id 
        FROM public.fee_structures 
        WHERE target_grade = v_grade AND status = 'Active'
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active fee structure found for Grade ' || v_grade);
    END IF;

    -- Assign structure to student (USING HARMONIZED structure_id)
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    -- Generate Invoices for components
    FOR v_component IN 
        SELECT * FROM public.fee_components WHERE structure_id = v_structure_id
    LOOP
        -- Avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
            AND description ILIKE v_component.name || '%'
            AND status NOT IN ('Cancelled', 'cancelled')
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, total_amount, due_date, description, status, created_at, structure_id
            ) VALUES (
                p_student_id, v_component.amount, NOW() + INTERVAL '15 days',
                v_component.name || ' (INITIAL_SYNC)', 'Pending', NOW(), v_structure_id
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- Reconcile totals
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'invoices_created', v_count, 'structure_id', v_structure_id);
END;
$$;

-- [4] RE-IMPLEMENT: admin_sync_student_billing (Frontend Entry Point)
CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
    RETURN public.generate_student_ledger_for_student(p_student_id);
END;
$$;

-- [5] RE-IMPLEMENT: process_new_fee_assignment (Automation Helper)
CREATE OR REPLACE FUNCTION public.process_new_fee_assignment(
    p_student_id uuid,
    p_structure_id bigint,
    p_grade text,
    p_parent_details text
) RETURNS void AS $$
DECLARE
    v_comp record;
    v_total_amount numeric := 0;
    v_line_items jsonb := '[]'::jsonb;
    v_invoice_id bigint;
    v_struct_name text;
    v_due_date date := CURRENT_DATE + INTERVAL '7 days';
    v_academic_year text;
BEGIN
    SELECT name, academic_year INTO v_struct_name, v_academic_year
    FROM fee_structures WHERE id = p_structure_id;

    FOR v_comp IN SELECT * FROM fee_components WHERE structure_id = p_structure_id LOOP
        IF v_comp.frequency IN ('Annually', 'One-time') THEN
            v_total_amount := v_total_amount + v_comp.amount;
        ELSIF v_comp.frequency = 'Monthly' THEN
             v_total_amount := v_total_amount + v_comp.amount;
        ELSIF v_comp.frequency = 'Quarterly' THEN
             v_total_amount := v_total_amount + v_comp.amount;
        END IF;
    END LOOP;

    IF v_total_amount > 0 THEN
        INSERT INTO fee_invoices (
            student_id, structure_id, invoice_number, due_date, total_amount, 
            status, description, academic_year, is_auto_generated, created_at
        ) VALUES (
            p_student_id, p_structure_id, 
            'INV-AUTO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(p_student_id::text, 1, 4),
            v_due_date, v_total_amount, 'pending',
            'Automated Fee Assignment: ' || v_struct_name, v_academic_year, true, now()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [6] RE-IMPLEMENT: auto_assign_fees_on_enrollment (Trigger Function)
CREATE OR REPLACE FUNCTION public.auto_assign_fees_on_enrollment()
RETURNS TRIGGER AS $$
DECLARE
    v_structure_id bigint;
BEGIN
    IF NEW.enrollment_status IN ('Active', 'Enrolled') AND NEW.grade IS NOT NULL THEN
        SELECT id INTO v_structure_id
        FROM fee_structures
        WHERE target_grade = NEW.grade AND is_default = true AND status = 'Active'
        ORDER BY created_at DESC LIMIT 1;

        IF v_structure_id IS NOT NULL THEN
            INSERT INTO student_fee_assignments (student_id, structure_id, status)
            VALUES (NEW.user_id, v_structure_id, 'Active')
            ON CONFLICT (student_id) DO UPDATE SET structure_id = EXCLUDED.structure_id;

            PERFORM public.process_new_fee_assignment(
                NEW.user_id, v_structure_id, NEW.grade, NULL
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

SELECT 'SUCCESS: Finance attributes and automation harmonized to structure_id.' as status;
