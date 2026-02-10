-- MASTER FINANCE UPGRADE SCRIPT
-- 1. Ensure Types exist
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled', 'partial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Ensure Tables exist (fee_invoices, fee_payments)
CREATE TABLE IF NOT EXISTS fee_invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint,
  student_id uuid,
  fee_structure_id bigint,
  invoice_number text UNIQUE,
  due_date date NOT NULL,
  total_amount numeric NOT NULL,
  paid_amount numeric DEFAULT 0,
  status invoice_status DEFAULT 'pending',
  payment_method text,
  academic_year text,
  description text,
  billing_month text,
  billing_year text,
  is_auto_generated boolean DEFAULT false,
  storage_bucket text DEFAULT 'school_invoices',
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint,
  invoice_id bigint,
  student_id uuid,
  amount numeric NOT NULL,
  payment_date timestamp with time zone DEFAULT now(),
  payment_method text,
  transaction_id text,
  receipt_number text,
  status text DEFAULT 'Completed',
  collected_by uuid,
  recorded_by uuid,
  notes text,
  method_details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- 3. Enhance Fee Tables
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS type text DEFAULT 'Standard';
ALTER TABLE fee_components ADD COLUMN IF NOT EXISTS category text DEFAULT 'Tuition';
ALTER TABLE fee_components ADD COLUMN IF NOT EXISTS is_refundable boolean DEFAULT false;

-- 4. Enable RLS on new tables if created
ALTER TABLE fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON fee_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON fee_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON fee_invoices; 
CREATE POLICY "Enable all access for authenticated users" ON fee_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON fee_payments;
CREATE POLICY "Enable all access for authenticated users" ON fee_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 5. Automation Trigger (Auto-Assign Default Structure)
CREATE OR REPLACE FUNCTION public.auto_assign_fees_on_enrollment()
RETURNS TRIGGER AS $$
DECLARE
    v_structure_id bigint;
BEGIN
    IF NEW.enrollment_status IN ('Active', 'Enrolled') THEN
        SELECT id INTO v_structure_id
        FROM fee_structures
        WHERE target_grade = NEW.grade
          AND is_default = true
          AND status = 'Active'
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_structure_id IS NOT NULL THEN
            INSERT INTO student_fee_assignments (student_id, structure_id, status)
            VALUES (NEW.user_id, v_structure_id, 'Active')
            ON CONFLICT (student_id, structure_id) DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_assign_fees ON student_profiles;
CREATE TRIGGER trg_auto_assign_fees
AFTER INSERT OR UPDATE OF enrollment_status, grade ON student_profiles
FOR EACH ROW
EXECUTE FUNCTION auto_assign_fees_on_enrollment();

-- 6. Reporting RPCs
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
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_assigned
    FROM fee_invoices
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND status != 'cancelled';

    SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_collected
    FROM fee_invoices
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND status != 'cancelled';

    v_total_pending := v_total_assigned - v_total_collected;

    SELECT COALESCE(SUM(total_amount - paid_amount), 0) INTO v_total_overdue
    FROM fee_invoices
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND status != 'cancelled'
      AND due_date < CURRENT_DATE
      AND (total_amount - paid_amount) > 0;

    SELECT COALESCE(SUM(amount), 0) INTO v_monthly_collection
    FROM fee_payments
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND payment_date >= date_trunc('month', CURRENT_DATE);

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
        COALESCE(sc.section, 'A') as section,
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
