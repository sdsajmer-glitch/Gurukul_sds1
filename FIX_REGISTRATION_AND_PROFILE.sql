-- ==============================================================================
-- FIX: Complete Registration Fix & Storage Policies
-- 1. Adds missing columns (emergency_contact, medical_info) to admissions
-- 2. Updates get_my_children_profiles RPC to return these columns
-- 3. Sets up Storage Policies for 'profiles' bucket to ensure photos work
-- ==============================================================================

-- 1. Ensure Columns Exist in Admissions Table
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS medical_info text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS student_user_id uuid;

-- 2. Update the RPC to fetch these columns
DROP FUNCTION IF EXISTS public.get_my_children_profiles();

CREATE OR REPLACE FUNCTION public.get_my_children_profiles()
RETURNS TABLE (
  id uuid,
  applicant_name text,
  parent_name text,
  parent_email text,
  parent_phone text,
  grade text,
  status text,
  date_of_birth date,
  gender text,
  profile_photo_url text,
  branch_id integer,
  submitted_at timestamptz,
  student_user_id uuid,
  emergency_contact text,
  medical_info text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    a.id,
    a.applicant_name,
    a.parent_name,
    a.parent_email,
    a.parent_phone,
    a.grade,
    a.status,
    a.date_of_birth,
    a.gender,
    a.profile_photo_url,
    a.branch_id,
    a.submitted_at,
    a.student_user_id,
    a.emergency_contact,
    a.medical_info
  FROM public.admissions a
  WHERE a.parent_id = auth.uid()
     OR LOWER(a.parent_email) = LOWER(COALESCE((SELECT email FROM public.profiles WHERE id = auth.uid()), (SELECT auth.jwt() ->> 'email'), ''))
  ORDER BY a.submitted_at DESC;
$$;

-- 3. Storage Bucket Configuration (Idempotent)
-- Attempt to insert the bucket if it doesn't exist (Standard Supabase approach)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Storage Policies for 'profiles' bucket
-- Allow anyone to read profiles (because they are Avatars)
DROP POLICY IF EXISTS "Public Profiles Access" ON storage.objects;
CREATE POLICY "Public Profiles Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'profiles' );

-- Allow Authenticated users to upload/update their own files in 'profiles'
-- Path convention: 'child/USER_ID/...' or 'parent/USER_ID/...'
-- We allow any authenticated user to upload to 'profiles' for simplicity in this fix, 
-- but ideally we restrict by folder.
DROP POLICY IF EXISTS "Authenticated Profile Upload" ON storage.objects;
CREATE POLICY "Authenticated Profile Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'profiles' );

DROP POLICY IF EXISTS "Authenticated Profile Update" ON storage.objects;
CREATE POLICY "Authenticated Profile Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'profiles' );

-- 5. RLS for Admissions (Ensure Parents can Update)
-- Check if policy exists, if not create generic one for now
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admissions' AND policyname = 'Parents can update their own applications'
    ) THEN
        CREATE POLICY "Parents can update their own applications"
        ON public.admissions
        FOR UPDATE
        TO authenticated
        USING (
            parent_id = auth.uid() OR 
            parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
        );
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admissions' AND policyname = 'Parents can insert their own applications'
    ) THEN
        CREATE POLICY "Parents can insert their own applications"
        ON public.admissions
        FOR INSERT
        TO authenticated
        WITH CHECK (
            parent_id = auth.uid()
        );
    END IF;
END $$;
