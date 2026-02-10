-- Fix RLS Policies for Fee Management Modules
-- This script ensures valid access policies for fee_structures and fee_components

-- 1. fee_structures
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON fee_structures;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON fee_structures;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON fee_structures;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON fee_structures;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON fee_structures;

-- Create a broad policy for authenticated users to ensure functional access
CREATE POLICY "Enable all access for authenticated users"
ON fee_structures
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. fee_components
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

-- 3. fee_adjustments (just in case)
ALTER TABLE fee_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON fee_adjustments;

CREATE POLICY "Enable all access for authenticated users"
ON fee_adjustments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. student_fee_assignments (just in case)
ALTER TABLE student_fee_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON student_fee_assignments;

CREATE POLICY "Enable all access for authenticated users"
ON student_fee_assignments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
