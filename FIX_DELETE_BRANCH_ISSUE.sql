-- ==============================================================================
-- FIX: Allow deletion of school_branches by updating Foreign Key constraints
-- ==============================================================================

-- 1. Modify 'profiles' table constraint
-- Issue: Deleting a branch fails because profiles reference it.
-- Fix: When a branch is deleted, set the 'branch_id' in profiles to NULL (preserve the user).
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_branch_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.school_branches(id)
ON DELETE SET NULL;

-- 2. Modify 'school_classes' table constraint
-- Issue: Deleting a branch fails if classes exist.
-- Fix: Delete all classes associated with the branch (Cascade).
ALTER TABLE public.school_classes
DROP CONSTRAINT IF EXISTS school_classes_branch_id_fkey;

ALTER TABLE public.school_classes
ADD CONSTRAINT school_classes_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.school_branches(id)
ON DELETE CASCADE;

-- 3. Modify 'academic_years' table constraint
-- Fix: Cascade delete academic years.
ALTER TABLE public.academic_years
DROP CONSTRAINT IF EXISTS academic_years_branch_id_fkey;

ALTER TABLE public.academic_years
ADD CONSTRAINT academic_years_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.school_branches(id)
ON DELETE CASCADE;

-- 4. Modify 'student_enrollments' table constraint
-- Fix: Cascade delete enrollments (or SET NULL if you want to keep history, but typically enrollments belong to a branch).
-- NOTE: We will CASCADE here to ensure clean deletion of branch data.
ALTER TABLE public.student_enrollments
DROP CONSTRAINT IF EXISTS student_enrollments_branch_id_fkey;

ALTER TABLE public.student_enrollments
ADD CONSTRAINT student_enrollments_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.school_branches(id)
ON DELETE CASCADE;

-- 5. Modify 'student_profiles', 'teacher_profiles', 'user_role_assignments'
-- Users often have profile extensions linked to a branch.
-- For profile extensions, we often can SET NULL or CASCADE.
-- User is preserved (profiles table), but their role assignment to that branch should be removed.

-- User Role Assignments -> CASCADE (Remove the role assignment for that branch)
ALTER TABLE public.user_role_assignments
DROP CONSTRAINT IF EXISTS user_role_assignments_branch_id_fkey;

ALTER TABLE public.user_role_assignments
ADD CONSTRAINT user_role_assignments_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.school_branches(id)
ON DELETE CASCADE;

-- Student Profiles -> SET NULL (Keep the profile data, just detach from branch)
ALTER TABLE public.student_profiles
DROP CONSTRAINT IF EXISTS student_profiles_branch_id_fkey;

ALTER TABLE public.student_profiles
ADD CONSTRAINT student_profiles_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.school_branches(id)
ON DELETE SET NULL;

-- Teacher Profiles -> SET NULL
ALTER TABLE public.teacher_profiles
DROP CONSTRAINT IF EXISTS teacher_profiles_branch_id_fkey;

ALTER TABLE public.teacher_profiles
ADD CONSTRAINT teacher_profiles_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.school_branches(id)
ON DELETE SET NULL;

-- 6. Modify 'enquiries' -> CASCADE or SET NULL
ALTER TABLE public.enquiries
DROP CONSTRAINT IF EXISTS enquiries_branch_id_fkey;

ALTER TABLE public.enquiries
ADD CONSTRAINT enquiries_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.school_branches(id)
ON DELETE SET NULL; -- Keep enquiries even if branch deleted? Maybe CASCADE is better for cleanup. Let's use SET NULL to be safe.

