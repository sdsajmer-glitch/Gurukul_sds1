-- ============================================================================
-- SEED: System Roles Registry
-- Populates the user_roles master table to satisfy foreign key constraints
-- across the identity and role assignment modules.
-- ============================================================================

BEGIN;

-- Insert core system roles
INSERT INTO public.user_roles (name, display_name, description, is_system_role)
VALUES 
    ('School Administration', 'Institutional Admin', 'Primary administrative role for school owners and directors.', true),
    ('Admin', 'System Administrator', 'High-level admin with cross-branch authority.', true),
    ('Branch Admin', 'Branch Manager', 'Administrator restricted to a specific school branch.', true),
    ('Principal', 'School Principal', 'Academic and administrative lead for a branch.', true),
    ('Teacher', 'Faculty Member', 'Academic staff responsible for classes and grading.', true),
    ('Student', 'Registered Student', 'Enrolled student within the institution.', true),
    ('Parent/Guardian', 'Family Guardian', 'Parent or legal guardian of students.', true),
    ('Transport Staff', 'Logistics Officer', 'Staff managing school buses and routes.', true),
    ('Ecommerce Operator', 'Merchant', 'Staff managing the institutional store.', true)
ON CONFLICT (name) DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

COMMIT;

SELECT 'SYSTEM_ROLES_SEEDED: Role registry synchronized' as status;
