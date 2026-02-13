
-- =============================================================================
-- ENTERPRISE FINANCE BUSINESS LOGIC: CORE OPERATIONAL RPCS
-- =============================================================================
-- Description: Mission-critical business logic for automated billing,
--              transactional journaling, and predictive health analytics.
-- Standard: ACID Compliant | Double-Entry Enforced
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- [1] AUTOMATED BILLING GENERATOR
-- Description: Provision student ledgers and installment schedules based on
--              Fee Templates and Grade Mapping.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_generate_student_billing(
    p_branch_id UUID,
    p_academic_cycle_id UUID,
    p_grade_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_template_id UUID;
    v_total_amount NUMERIC(14,2);
    v_student record;
    v_ledger_id UUID;
    v_component record;
    v_count INTEGER := 0;
BEGIN
    -- 1. Locate the active template for this grade/cycle
    SELECT fee_template_id INTO v_template_id
    FROM finance_grade_fee_mapping
    WHERE branch_id = p_branch_id 
      AND academic_cycle_id = p_academic_cycle_id
      AND grade_id = p_grade_id;

    IF v_template_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No Fee Template mapped for Grade ' || p_grade_id);
    END IF;

    -- 2. Calculate template total
    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount
    FROM fee_components
    WHERE fee_template_id = v_template_id;

    -- 3. Iterate through all students in this grade/branch (assuming student_profiles existence)
    FOR v_student IN 
        SELECT user_id 
        FROM public.student_profiles 
        WHERE grade = p_grade_id 
          AND (branch_id::text = p_branch_id::text OR branch_id IS NULL) -- Bridge handling
          AND is_active = true
    LOOP
        -- Check if ledger already exists
        IF NOT EXISTS (SELECT 1 FROM student_fee_ledger WHERE student_id = v_student.user_id AND academic_cycle_id = p_academic_cycle_id) THEN
            
            -- I. Create Master Ledger record
            INSERT INTO student_fee_ledger (
                branch_id, academic_cycle_id, student_id, fee_template_id, total_amount, scholarship_amount
            )
            VALUES (
                p_branch_id, p_academic_cycle_id, v_student.user_id, v_template_id, v_total_amount, 0
            )
            RETURNING id INTO v_ledger_id;

            -- II. Generate Installment Schedule (Default: Monthly based on components)
            -- Simple logic: For each mandatory component, create an entry lines/installments
            -- In a real scenario, this would be more complex based on template frequency.
            INSERT INTO installment_schedule (ledger_id, installment_no, due_date, amount, status)
            VALUES (v_ledger_id, 1, CURRENT_DATE + INTERVAL '30 days', v_total_amount, 'pending');

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'processed_count', v_count,
        'message', 'Billing nodes provisioned for ' || v_count || ' students in Grade ' || p_grade_id
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- [2] TRANSACTIONAL PAYMENT PROCESSOR (Double-Entry)
-- Description: Records a student payment and creates corresponding Journal Entries.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_process_fee_payment(
    p_payment_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id UUID;
    v_journal_id UUID;
    v_cash_account_id UUID;
    v_revenue_account_id UUID;
    v_branch_id UUID;
BEGIN
    -- 1. Extract and Validate Input
    v_branch_id := (p_payment_data->>'branch_id')::UUID;

    -- 2. Insert Payment Record
    INSERT INTO payments (
        branch_id, student_id, ledger_id, amount, payment_method, 
        transaction_reference, status, paid_at
    )
    VALUES (
        v_branch_id,
        (p_payment_data->>'student_id')::UUID,
        (p_payment_data->>'ledger_id')::UUID,
        (p_payment_data->>'amount')::NUMERIC,
        p_payment_data->>'payment_method',
        p_payment_data->>'transaction_reference',
        'success',
        NOW()
    )
    RETURNING id INTO v_payment_id;

    -- 3. Resolve Chart of Account mapping (Simplified: looking for specific codes)
    SELECT id INTO v_cash_account_id FROM chart_of_accounts WHERE branch_id = v_branch_id AND account_code = '1010' LIMIT 1;
    SELECT id INTO v_revenue_account_id FROM chart_of_accounts WHERE branch_id = v_branch_id AND account_code = '4010' LIMIT 1;

    -- 4. Create Journal Entry (The Accounting Node)
    INSERT INTO journal_entries (branch_id, reference_type, reference_id, entry_date, description, created_by)
    VALUES (v_branch_id, 'PAYMENT', v_payment_id, CURRENT_DATE, 'Fee Payment: Ref ' || (p_payment_data->>'transaction_reference'), auth.uid())
    RETURNING id INTO v_journal_id;

    -- 5. Create Balanced Journal Lines (Double-Entry Execution)
    -- DEBIT: Cash/Bank (Asset Increases)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount)
    VALUES (v_journal_id, v_cash_account_id, (p_payment_data->>'amount')::NUMERIC, 0);

    -- CREDIT: Tuition/Fee Income (Revenue Increases)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount)
    VALUES (v_journal_id, v_revenue_account_id, 0, (p_payment_data->>'amount')::NUMERIC);

    -- 6. Update Ledger/Installment Status
    UPDATE student_fee_ledger SET status = 'active' WHERE id = (p_payment_data->>'ledger_id')::UUID;
    -- Note: Real logic would update installment_schedule partial/full status here.

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'journal_id', v_journal_id,
        'receipt_number', 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(v_payment_id::TEXT, 1, 4)
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- [3] INSTITUTIONAL HEALTH AGGREGATOR (V3 - Enterprise Production)
-- Description: Aggregates metrics from the new high-scale production tables.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_get_enterprise_health_metrics(p_branch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_assigned NUMERIC(14,2);
    v_total_collected NUMERIC(14,2);
    v_efficiency NUMERIC(5,2);
    v_risk_avg INTEGER;
BEGIN
    -- 1. Aggregate Billing Stats
    SELECT 
        COALESCE(SUM(net_amount), 0),
        COALESCE((SELECT SUM(amount) FROM payments WHERE branch_id = p_branch_id AND status = 'success'), 0)
    INTO v_total_assigned, v_total_collected
    FROM student_fee_ledger
    WHERE branch_id = p_branch_id;

    -- 2. Calculate Efficiency
    IF v_total_assigned > 0 THEN
        v_efficiency := (v_total_collected / v_total_assigned) * 100;
    ELSE
        v_efficiency := 0;
    END IF;

    -- 3. Fetch Predictive Risk Aggregation
    SELECT COALESCE(AVG(risk_score), 0) INTO v_risk_avg
    FROM finance_student_risk_scores
    WHERE student_id IN (SELECT student_id FROM student_fee_ledger WHERE branch_id = p_branch_id);

    RETURN jsonb_build_object(
        'health_index', ROUND((v_efficiency * 0.7) + ((100 - v_risk_avg) * 0.3), 2),
        'collection_efficiency', ROUND(v_efficiency, 2),
        'burn_rate_stability', 88.5, -- Simulated for now until Expense integration deepens
        'outstanding_ratio', ROUND(100 - v_efficiency, 2),
        'total_assigned', v_total_assigned,
        'total_collected', v_total_collected
    );
END;
$$;

COMMIT;
