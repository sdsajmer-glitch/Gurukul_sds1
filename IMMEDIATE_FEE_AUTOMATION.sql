-- AUTOMATION: GRADE-BASED FEE ASSIGNMENT & INVOICE GENERATION
-- Description: Automatically assigns default fee structures and generates initial invoices when a student's grade changes or enrollment becomes active.

-- 1. Create a function to generate the invoice and notification
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
    -- Get Structure Details
    SELECT name, academic_year INTO v_struct_name, v_academic_year
    FROM fee_structures WHERE id = p_structure_id;

    -- Calculate Invoice Amount (Annual + One-time + 1 Month of Monthly)
    FOR v_comp IN SELECT * FROM fee_components WHERE structure_id = p_structure_id LOOP
        IF v_comp.frequency IN ('Annually', 'One-time') THEN
            v_total_amount := v_total_amount + v_comp.amount;
        ELSIF v_comp.frequency = 'Monthly' THEN
            -- Add 1 month for immediate payment
             v_total_amount := v_total_amount + v_comp.amount;
        ELSIF v_comp.frequency = 'Quarterly' THEN
             v_total_amount := v_total_amount + v_comp.amount;
        END IF;

        -- Add to line items (simplified for description)
        v_line_items := v_line_items || jsonb_build_object(
            'name', v_comp.name,
            'amount', v_comp.amount,
            'frequency', v_comp.frequency
        );
    END LOOP;

    -- Create Invoice if amount > 0
    IF v_total_amount > 0 THEN
        INSERT INTO fee_invoices (
            student_id,
            fee_structure_id,
            invoice_number,
            due_date,
            total_amount,
            status,
            description,
            academic_year,
            is_auto_generated,
            created_at
        ) VALUES (
            p_student_id,
            p_structure_id,
            'INV-' || to_char(now(), 'YYYYMMDD') || '-' || substring(p_student_id::text, 1, 4),
            v_due_date,
            v_total_amount,
            'pending',
            'Automated Fee Assignment: ' || v_struct_name,
            v_academic_year,
            true,
            now()
        ) RETURNING id INTO v_invoice_id;

        -- Create Notification for Parent (Stub using communications table)
        -- Parsing parent email would be complex here, so we create a system notification log
        INSERT INTO communications (
            subject,
            body,
            sender_name,
            sender_role,
            recipients,
            status,
            sent_at
        ) VALUES (
            'Fee Structure Assigned: ' || v_struct_name,
            'Dear Parent, The fee structure for Grade ' || p_grade || ' has been assigned to your child. An invoice for ' || v_total_amount || ' is generated.',
            'System Automation',
            'System',
            ARRAY[p_student_id::text], -- Using Student ID as proxy for parent mapping in this demo
            'Sent',
            now()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Enhanced Trigger Function
CREATE OR REPLACE FUNCTION public.auto_assign_fees_on_enrollment()
RETURNS TRIGGER AS $$
DECLARE
    v_structure_id bigint;
    v_assignment_exists boolean;
BEGIN
    -- Only run if enrollment status is 'Active' or 'Enrolled'
    -- And if grade is present
    IF NEW.enrollment_status IN ('Active', 'Enrolled') AND NEW.grade IS NOT NULL THEN
        
        -- 1. Find the Default Fee Structure for this Grade
        SELECT id INTO v_structure_id
        FROM fee_structures
        WHERE target_grade = NEW.grade
          AND is_default = true
          AND status = 'Active'
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_structure_id IS NOT NULL THEN
            -- 2. Check if already assigned
            SELECT EXISTS (
                SELECT 1 FROM student_fee_assignments 
                WHERE student_id = NEW.user_id AND structure_id = v_structure_id
            ) INTO v_assignment_exists;

            IF NOT v_assignment_exists THEN
                -- 3. Assign Structure
                INSERT INTO student_fee_assignments (student_id, structure_id, status)
                VALUES (NEW.user_id, v_structure_id, 'Active');

                -- 4. Generate Invoice & Notify (Call helper function)
                PERFORM public.process_new_fee_assignment(
                    NEW.user_id, 
                    v_structure_id, 
                    NEW.grade, 
                    NEW.parent_guardian_details
                );
            END IF;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-apply Trigger
DROP TRIGGER IF EXISTS trg_auto_assign_fees ON student_profiles;

CREATE TRIGGER trg_auto_assign_fees
AFTER INSERT OR UPDATE OF enrollment_status, grade ON student_profiles
FOR EACH ROW
EXECUTE FUNCTION auto_assign_fees_on_enrollment();
