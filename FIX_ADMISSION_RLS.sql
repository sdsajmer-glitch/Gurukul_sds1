-- ==============================================================================
-- FIX: Enable RLS Policies for 'admissions' table to allow Parent Registration
-- ==============================================================================

-- 1. ADMISSIONS TABLE POLICIES

-- Allow Parents to INSERT their own admissions
DROP POLICY IF EXISTS "Parents can create admissions" ON public.admissions;
CREATE POLICY "Parents can create admissions" ON public.admissions
FOR INSERT WITH CHECK (
    auth.uid() = parent_id
);

-- Allow Parents to VIEW their own admissions
DROP POLICY IF EXISTS "Parents can view own admissions" ON public.admissions;
CREATE POLICY "Parents can view own admissions" ON public.admissions
FOR SELECT USING (
    auth.uid() = parent_id
);

-- Allow Parents to UPDATE their own admissions
-- (Useful if they need to correct details while status is 'Pending' or 'Registered')
DROP POLICY IF EXISTS "Parents can update own admissions" ON public.admissions;
CREATE POLICY "Parents can update own admissions" ON public.admissions
FOR UPDATE USING (
    auth.uid() = parent_id
);

-- Allow School Admins to VIEW all admissions for their branch (Optional but good practice)
-- Assuming 'profiles' table has 'branch_id' and 'role'
DROP POLICY IF EXISTS "School Admins can view branch admissions" ON public.admissions;
CREATE POLICY "School Admins can view branch admissions" ON public.admissions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'School Administration'
          AND (profiles.branch_id = public.admissions.branch_id OR profiles.branch_id IS NULL) -- NULL might mean Super Admin or Head Office
    )
);

-- Allow School Admins to UPDATE admissions (e.g. changing status)
DROP POLICY IF EXISTS "School Admins can update branch admissions" ON public.admissions;
CREATE POLICY "School Admins can update branch admissions" ON public.admissions
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'School Administration'
          AND (profiles.branch_id = public.admissions.branch_id OR profiles.branch_id IS NULL)
    )
);

-- 2. STUDENT PROFILES POLICIES (Just in case related insert happens)
-- Allow Parents to view student profiles linked to their own admissons?
-- Usually handled by 'get_my_children_profiles', but direct access might be needed.

