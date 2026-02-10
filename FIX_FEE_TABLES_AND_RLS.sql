-- Fix Missing Fee Tables and Apply RLS
-- This script creates the missing fee_adjustments and student_fee_assignments tables and applies RLS.

-- 1. Create fee_adjustments table if it doesn't exist
CREATE TABLE IF NOT EXISTS fee_adjustments (
    id bigint generated always as identity primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    student_id uuid references students(id) on delete cascade,
    amount numeric not null,
    reason text,
    type text, -- 'Credit' or 'Debit' or 'Concession'
    branch_id bigint references branches(id) on delete set null
);

-- 2. Create student_fee_assignments if it doesn't exist
CREATE TABLE IF NOT EXISTS student_fee_assignments (
    id bigint generated always as identity primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    student_id uuid references students(id) on delete cascade,
    structure_id bigint references fee_structures(id) on delete set null,
    status text default 'Active',
    unique(student_id, structure_id)
);

-- 3. Apply RLS Policies (From previous fix)

-- fee_structures
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON fee_structures;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON fee_structures;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON fee_structures;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON fee_structures;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON fee_structures;

CREATE POLICY "Enable all access for authenticated users"
ON fee_structures
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- fee_components
ALTER TABLE fee_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON fee_components;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON fee_components;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON fee_components;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON fee_components;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON fee_components;

CREATE POLICY "Enable all access for authenticated users"
ON fee_components
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- fee_adjustments
ALTER TABLE fee_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON fee_adjustments;

CREATE POLICY "Enable all access for authenticated users"
ON fee_adjustments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- student_fee_assignments
ALTER TABLE student_fee_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON student_fee_assignments;

CREATE POLICY "Enable all access for authenticated users"
ON student_fee_assignments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions just in case
GRANT ALL ON fee_adjustments TO authenticated;
GRANT ALL ON student_fee_assignments TO authenticated;
GRANT ALL ON fee_structures TO authenticated;
GRANT ALL ON fee_components TO authenticated;
GRANT ALL ON SEQUENCE fee_adjustments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE student_fee_assignments_id_seq TO authenticated;
