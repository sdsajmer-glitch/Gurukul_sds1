-- ==============================================================================
-- DIAGNOSTIC: CHECK ACADEMIC PLACEMENT STATUS
-- Run this in the Supabase SQL Editor to diagnose persistence issues
-- ==============================================================================

-- 1. Check if the admin_assign_student_class function exists and its definition
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'admin_assign_student_class'
  AND n.nspname = 'public';

-- 2. Check the student_profiles table schema - verify assigned_class_id column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'student_profiles' 
  AND column_name IN ('assigned_class_id', 'enrollment_status', 'grade', 'branch_id', 'updated_at')
ORDER BY column_name;

-- 3. Check the audit_logs table schema - verify it has all required columns
-- (audit_logs schema mismatch is the most likely cause of the rollback)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;

-- 4. Show students with their current class assignment status
SELECT 
    sp.user_id,
    p.display_name,
    sp.assigned_class_id,
    sc.name AS class_name,
    sp.enrollment_status,
    sp.grade,
    sp.updated_at
FROM student_profiles sp
JOIN profiles p ON sp.user_id = p.id
LEFT JOIN school_classes sc ON sp.assigned_class_id = sc.id
ORDER BY sp.updated_at DESC
LIMIT 20;

-- 5. Check recent audit logs for placement attempts (shows if auditing is failing)
SELECT 
    id,
    user_id,
    action,
    module,
    details,
    severity,
    created_at
FROM audit_logs
WHERE action ILIKE '%PLACEMENT%' 
   OR action ILIKE '%ENROLLMENT%'
   OR action ILIKE '%ASSIGN%'
ORDER BY created_at DESC
LIMIT 20;

-- 6. Check RLS policies on student_profiles that might block updates
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'student_profiles';

-- 7. Verify the function has proper EXECUTE grants
SELECT 
    grantee, 
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'admin_assign_student_class'
  AND routine_schema = 'public';
