-- ==============================================================================
-- FIX: Enquiry RLS Policies for NEW Parent Registrations
-- ==============================================================================
-- Resolves: "new row violates row-level security policy for table enquiries"
-- 1. Ensures missing columns exist on public.enquiries
-- 2. Sets up INSERT and UPDATE policies for Parents
-- 3. Sets up ALL access for School Admins
-- ==============================================================================

BEGIN;

-- 1. Ensure Schema Consistency
-- (Some fields might be missing if previous lifecycle fixes weren't applied)
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS parent_email text;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS parent_phone text;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS parent_name text;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS medical_info text;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS profile_photo_url text;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS branch_id bigint;

-- Ensure RLS is enabled
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- 2. PARENT POLICIES

-- Allow Parents to INSERT their own enquiries
DROP POLICY IF EXISTS "Parents can insert own enquiries" ON public.enquiries;
CREATE POLICY "Parents can insert own enquiries" ON public.enquiries
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid() OR 
    LOWER(parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid()) OR
    LOWER(parent_email) = (SELECT LOWER(auth.jwt() ->> 'email'))
);

-- Allow Parents to SELECT their own enquiries
DROP POLICY IF EXISTS "Parents can view own enquiries" ON public.enquiries;
CREATE POLICY "Parents can view own enquiries" ON public.enquiries
FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR 
    LOWER(parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid()) OR
    LOWER(parent_email) = (SELECT LOWER(auth.jwt() ->> 'email'))
);

-- Allow Parents to UPDATE their own enquiries
DROP POLICY IF EXISTS "Parents can update own enquiries" ON public.enquiries;
CREATE POLICY "Parents can update own enquiries" ON public.enquiries
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() OR 
    LOWER(parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid()) OR
    LOWER(parent_email) = (SELECT LOWER(auth.jwt() ->> 'email'))
)
WITH CHECK (
    user_id = auth.uid() OR 
    LOWER(parent_email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid()) OR
    LOWER(parent_email) = (SELECT LOWER(auth.jwt() ->> 'email'))
);

-- 3. SCHOOL ADMINISTRATION POLICIES

-- Allow School Admins to perform all operations on enquiries for their branch
DROP POLICY IF EXISTS "School Admins can manage branch enquiries" ON public.enquiries;
CREATE POLICY "School Admins can manage branch enquiries" ON public.enquiries
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() 
        AND p.role IN ('school_admin', 'admin', 'branch_admin', 'School Administration')
        AND (p.branch_id IS NULL OR p.branch_id = enquiries.branch_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() 
        AND p.role IN ('school_admin', 'admin', 'branch_admin', 'School Administration')
        AND (p.branch_id IS NULL OR p.branch_id = enquiries.branch_id)
    )
);

COMMIT;

SELECT 'SUCCESS: Enquiry RLS policies updated for Parent Registrations' as status;
