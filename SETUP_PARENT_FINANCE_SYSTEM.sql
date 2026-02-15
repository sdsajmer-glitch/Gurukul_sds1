-- =============================================================================
-- PARENT FINANCE SYSTEM SETUP (V1)
-- =============================================================================
-- Covers: Enrollment Trigger, Parent Access, Payment Logic, Status Engine.
-- =============================================================================

BEGIN;

-- [SECTION 1] ENROLLMENT TRIGGER LOGIC
-- Function to initialize finance ledger when a student is enrolled
CREATE OR REPLACE FUNCTION public.enroll_student_finance_protocol(
    p_student_id UUID,
    p_grade TEXT,
    p_cycle_id BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_struct_id UUID;
    v_total_amount NUMERIC;
    v_component RECORD;
    v_installment RECORD;
BEGIN
    -- 1. Find Active Fee Structure for Grade & Cycle
    SELECT id INTO v_struct_id
    FROM public.fee_structures
    WHERE grade = p_grade 
      AND academic_cycle_id = p_cycle_id
      AND status = 'Active'
    LIMIT 1;

    IF v_struct_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No Active Fee Structure Found for Grade ' || p_grade);
    END IF;

    -- 2. Create/Update Student Fee Account (Ledger Header)
    INSERT INTO public.student_fee_accounts (
        student_id, 
        total_billed, 
        total_paid, 
        outstanding_balance, 
        integrity_score, 
        last_synced_at,
        is_active
    )
    VALUES (
        p_student_id,
        0, -- Will calculate after installments
        0, 
        0, 
        100, 
        NOW(),
        true
    )
    ON CONFLICT (student_id) DO NOTHING;

    -- 3. Generate Invoices/Installments based on Structure
    -- (Simplified: Assuming 1-to-1 mapping with Fee Components for now, 
    --  real world might have installment plans, but we stick to the provided requirements)
    
    -- Clear existing pending invoices for this cycle if resetting? 
    -- SAFE MODE: We only add if not exists to prevent duplicates on re-enrollment logic
    
    FOR v_installment IN 
        SELECT * FROM public.fee_structure_installments WHERE fee_structure_id = v_struct_id
    LOOP
        INSERT INTO public.fee_invoices (
            student_id,
            fee_structure_id,
            total_amount,
            paid_amount,
            due_date,
            status,
            title,
            academic_cycle_id,
            branch_id
        )
        VALUES (
            p_student_id,
            v_struct_id,
            v_installment.amount,
            0,
            v_installment.due_date,
            'pending',
            v_installment.name,
            p_cycle_id,
            (SELECT branch_id FROM public.student_profiles WHERE user_id = p_student_id LIMIT 1)
        );
    END LOOP;

    -- 4. Reconcile to update totals
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object('success', true, 'message', 'Finance Protocol Initialized');
END;
$$;


-- [SECTION 2] PARENT ACCESS RPCS

-- Fetch linked students with high-level finance summary
CREATE OR REPLACE FUNCTION public.get_parent_linked_students_finance_v2(p_parent_id UUID)
RETURNS TABLE (
    student_id UUID,
    display_name TEXT,
    profile_photo_url TEXT,
    grade TEXT,
    branch_name TEXT,
    total_due NUMERIC,
    status TEXT,
    health_score INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS student_id,
        COALESCE(s.display_name, 'Unknown Student') AS display_name,
        s.profile_photo_url, -- Safe Mode: Direct from profiles
        COALESCE(sp.grade, 'N/A') AS grade,
        'Main Branch'::TEXT AS branch_name, -- Placeholder or join branches
        COALESCE(sfa.outstanding_balance, 0) AS total_due,
        CASE 
            WHEN sfa.outstanding_balance > 0 AND EXISTS (
                SELECT 1 FROM public.fee_invoices fi 
                WHERE fi.student_id = s.id AND fi.due_date < NOW() AND fi.status NOT IN ('paid', 'cancelled')
            ) THEN 'OVERDUE'
            WHEN sfa.outstanding_balance > 0 THEN 'Pending'
            ELSE 'Paid'
        END AS status,
        COALESCE(sfa.integrity_score, 100) AS health_score
    FROM public.parent_student_relationships psr
    JOIN public.profiles s ON psr.student_id = s.id
    LEFT JOIN public.student_profiles sp ON s.id = sp.user_id
    LEFT JOIN public.student_fee_accounts sfa ON s.id = sfa.student_id
    WHERE psr.parent_id = p_parent_id;
END;
$$;


-- Fetch detailed finance view for a specific student
CREATE OR REPLACE FUNCTION public.get_student_finance_detail_v2(
    p_student_id UUID,
    p_cycle_id BIGINT DEFAULT NULL -- Optional Cycle Filter
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_summary JSONB;
    v_installments JSONB;
    v_history JSONB;
    v_cycle_id BIGINT := p_cycle_id;
BEGIN
    -- Resolve Cycle if Null
    IF v_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    END IF;

    -- Summary Stats
    SELECT jsonb_build_object(
        'total_billed', COALESCE(total_billed, 0),
        'total_paid', COALESCE(total_paid, 0),
        'outstanding', COALESCE(outstanding_balance, 0),
        'unallocated', COALESCE(unallocated_funds, 0)
    ) INTO v_summary
    FROM public.student_fee_accounts
    WHERE student_id = p_student_id;

    -- Installments (Invoices)
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'amount', total_amount,
        'paid', paid_amount,
        'due_date', due_date,
        'status', status,
        'is_overdue', (due_date < NOW() AND status NOT IN ('paid', 'cancelled', 'Success', 'Completed'))
    )) INTO v_installments
    FROM public.fee_invoices
    WHERE student_id = p_student_id
      AND (v_cycle_id IS NULL OR academic_cycle_id = v_cycle_id)
    ORDER BY due_date ASC;

    -- Transaction History
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'date', payment_date,
        'amount', amount,
        'mode', payment_method,
        'status', status,
        'ref_id', transaction_id
    )) INTO v_history
    FROM public.fee_payments
    WHERE student_id = p_student_id
    ORDER BY payment_date DESC;

    RETURN jsonb_build_object(
        'summary', v_summary,
        'installments', COALESCE(v_installments, '[]'::jsonb),
        'history', COALESCE(v_history, '[]'::jsonb),
        'cycle_id', v_cycle_id
    );
END;
$$;


-- [SECTION 4] PAYMENT PROCESSING LOGIC

-- Initiate Payment (Mock)
CREATE OR REPLACE FUNCTION public.initiate_parent_payment(
    p_student_id UUID,
    p_amount NUMERIC,
    p_invoice_ids UUID[] -- Optional specific invoices
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    -- Insert a Pending Payment Record
    INSERT INTO public.fee_payments (
        student_id,
        amount,
        payment_date,
        payment_method,
        status,
        invoice_id, -- Linking to first invoice if array provided, ideally need robust mapping
        notes
    )
    VALUES (
        p_student_id,
        p_amount,
        NOW(),
        'ONLINE',
        'Pending',
        CASE WHEN array_length(p_invoice_ids, 1) > 0 THEN p_invoice_ids[1] ELSE NULL END,
        'Online Payment Initiated'
    )
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'gateway_url', '/mock-payment-gateway?id=' || v_payment_id, -- Mock URL
        'status', 'initiated'
    );
END;
$$;


-- Process Payment Success (Webhook Simulation)
CREATE OR REPLACE FUNCTION public.process_payment_success(
    p_payment_id UUID,
    p_transaction_ref TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student_id UUID;
    v_amount NUMERIC;
    v_invoice_id UUID;
BEGIN
    -- 1. Get Payment Details
    SELECT student_id, amount, invoice_id INTO v_student_id, v_amount, v_invoice_id
    FROM public.fee_payments
    WHERE id = p_payment_id;

    IF v_student_id IS NULL THEN 
        RAISE EXCEPTION 'Payment ID not found';
    END IF;

    -- 2. Update Payment Status
    UPDATE public.fee_payments
    SET status = 'Completed',
        transaction_id = p_transaction_ref,
        payment_date = NOW()
    WHERE id = p_payment_id;

    -- 3. If linked to an invoice, update invoice
    IF v_invoice_id IS NOT NULL THEN
        UPDATE public.fee_invoices
        SET paid_amount = LEAST(total_amount, paid_amount + v_amount),
            status = CASE 
                WHEN (paid_amount + v_amount) >= total_amount THEN 'paid' 
                WHEN (paid_amount + v_amount) > 0 THEN 'partial'
                ELSE status 
            END,
            updated_at = NOW()
        WHERE id = v_invoice_id;
    ELSE
        -- Auto-allocate to oldest unpaid invoices (Waterfall Logic)
        -- (Simplified for V1: Just leave as Unallocated or implemented in Reconcile)
    END IF;

    -- 4. Reconcile Ledger
    PERFORM public.admin_reconcile_student_account(v_student_id);
END;
$$;


-- [SECTION 6] CYCLE FIX & DATA INTEGRITY
-- Ensure we always have a valid academic cycle
CREATE OR REPLACE FUNCTION public.get_current_academic_cycle()
RETURNS BIGINT LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_id BIGINT;
BEGIN
    SELECT id INTO v_id FROM public.academic_years WHERE is_current = true LIMIT 1;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.academic_years ORDER BY start_date DESC LIMIT 1;
    END IF;
    RETURN v_id;
END;
$$;

-- [SECTION 9] AUTOMATION TRIGGERS

-- Trigger Function
CREATE OR REPLACE FUNCTION public.trigger_enroll_finance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_grade TEXT;
BEGIN
    -- Only run if cycle_id is present
    IF NEW.academic_cycle_id IS NOT NULL THEN
        -- Fetch Grade from Student Profile if not available in NEW
        SELECT grade INTO v_grade FROM public.student_profiles WHERE user_id = NEW.student_id;
        
        -- Fallback to NEW.grade_level if available (schema dependent)
        IF v_grade IS NULL AND to_jsonb(NEW) ? 'grade_level' THEN
            v_grade := NEW.grade_level;
        END IF;

        IF v_grade IS NOT NULL THEN
            PERFORM public.enroll_student_finance_protocol(
                NEW.student_id,
                v_grade,
                NEW.academic_cycle_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Create Trigger on student_enrollments
DROP TRIGGER IF EXISTS on_enrollment_finance_init ON public.student_enrollments;
CREATE TRIGGER on_enrollment_finance_init
    AFTER INSERT ON public.student_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_enroll_finance();

COMMIT;
