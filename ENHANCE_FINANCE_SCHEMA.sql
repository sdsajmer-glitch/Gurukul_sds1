-- ENHANCE FINANCE SCHEMA & AUTOMATION (Finance Tab V2)

-- 1. Enhance Fee Tables for broader mapping
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS type text DEFAULT 'Standard'; -- Standard, Package, Transport, etc.
ALTER TABLE fee_components ADD COLUMN IF NOT EXISTS category text DEFAULT 'Tuition'; -- Tuition, Books, Uniform, Transport, etc.
ALTER TABLE fee_components ADD COLUMN IF NOT EXISTS is_refundable boolean DEFAULT false;

-- 2. Create Trigger for AUTOMATIC FEE ASSIGNMENT
-- This function assigns the "Default" fee structure for a grade to a newly enrolled student.

CREATE OR REPLACE FUNCTION public.auto_assign_fees_on_enrollment()
RETURNS TRIGGER AS $$
DECLARE
    v_structure_id bigint;
    v_academic_year text;
BEGIN
    -- Only run if enrollment status is 'Active' or 'Enrolled'
    IF NEW.enrollment_status IN ('Active', 'Enrolled') THEN
        
        -- Determine current academic year (simple logic: current year or from a config table if needed)
        -- For now, we'll try to match the student's admission year or a global default.
        -- Assuming specific academic year isn't in student_profiles, we might use a dynamic Year.
        -- Better: Pick the Fee Structure that matches the student's Grade and is marked 'is_default'.
        
        SELECT id INTO v_structure_id
        FROM fee_structures
        WHERE target_grade = NEW.grade
          AND is_default = true
          AND status = 'Active'
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_structure_id IS NOT NULL THEN
            -- Assign the structure to the student
            INSERT INTO student_fee_assignments (student_id, structure_id, status)
            VALUES (NEW.user_id, v_structure_id, 'Active')
            ON CONFLICT (student_id, structure_id) DO NOTHING;
            
            -- Optionally: Generate the first invoice immediately? 
            -- For now, we just assign the structure so the cycle can pick it up.
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any (to avoid duplicates)
DROP TRIGGER IF EXISTS trg_auto_assign_fees ON student_profiles;

-- Create the trigger
CREATE TRIGGER trg_auto_assign_fees
AFTER INSERT OR UPDATE OF enrollment_status, grade ON student_profiles
FOR EACH ROW
EXECUTE FUNCTION auto_assign_fees_on_enrollment();


-- 3. Finance Overview Stats RPC
CREATE OR REPLACE FUNCTION get_finance_overview_stats_v2(p_branch_id bigint DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
    v_total_assigned numeric;
    v_total_collected numeric;
    v_total_pending numeric;
    v_total_overdue numeric;
    v_monthly_collection numeric;
    v_today_collection numeric;
BEGIN
    -- Calculate from student_fee_assignments (Potential/Assigned Value)
    -- This is complex because assignment doesn't mean "billed" yet.
    -- Better to calculate from INVOICES for "Assigned" (Billed) and "Collected".
    
    -- Total Billed (Assigned)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_assigned
    FROM fee_invoices
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND status != 'cancelled';

    -- Total Collected (Paid)
    SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_collected
    FROM fee_invoices
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND status != 'cancelled';

    -- Total Pending
    v_total_pending := v_total_assigned - v_total_collected;

    -- Total Overdue (Due date passed)
    SELECT COALESCE(SUM(total_amount - paid_amount), 0) INTO v_total_overdue
    FROM fee_invoices
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND status != 'cancelled'
      AND due_date < CURRENT_DATE
      AND (total_amount - paid_amount) > 0;

    -- Monthly Collection (This Month)
    SELECT COALESCE(SUM(amount), 0) INTO v_monthly_collection
    FROM fee_payments
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND payment_date >= date_trunc('month', CURRENT_DATE);

    -- Today's Collection
    SELECT COALESCE(SUM(amount), 0) INTO v_today_collection
    FROM fee_payments
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND payment_date >= CURRENT_DATE;

    RETURN jsonb_build_object(
        'total_assigned', v_total_assigned,
        'total_collected', v_total_collected,
        'total_pending', v_total_pending,
        'total_overdue', v_total_overdue,
        'monthly_collection', v_monthly_collection,
        'today_collection', v_today_collection
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Grade-wise Collection Report RPC
CREATE OR REPLACE FUNCTION get_grade_wise_collection_stats(p_branch_id bigint DEFAULT NULL)
RETURNS TABLE (
    grade text,
    section text,
    total_students bigint,
    total_billed numeric,
    total_collected numeric,
    total_pending numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.grade,
        COALESCE(sc.section, 'A') as section, -- Assuming section logic or default
        COUNT(DISTINCT sp.user_id) as total_students,
        COALESCE(SUM(fi.total_amount), 0) as total_billed,
        COALESCE(SUM(fi.paid_amount), 0) as total_collected,
        COALESCE(SUM(fi.total_amount - fi.paid_amount), 0) as total_pending
    FROM student_profiles sp
    LEFT JOIN school_classes sc ON sp.assigned_class_id = sc.id
    LEFT JOIN fee_invoices fi ON sp.user_id = fi.student_id AND fi.status != 'cancelled'
    WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
    GROUP BY sp.grade, sc.section
    ORDER BY sp.grade;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

