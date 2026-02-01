-- ==============================================================================
-- FIX: Initialize Storage Buckets and Policies
-- ==============================================================================

-- 1. Create Buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('expenses', 'expenses', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Policies for 'profiles'
DROP POLICY IF EXISTS "Public Profile Access" ON storage.objects;
CREATE POLICY "Public Profile Access" ON storage.objects
FOR SELECT USING (bucket_id = 'profiles');

DROP POLICY IF EXISTS "Users can upload own profile components" ON storage.objects;
CREATE POLICY "Users can upload own profile components" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'profiles' AND auth.uid() = owner
);

DROP POLICY IF EXISTS "Users can update own profile components" ON storage.objects;
CREATE POLICY "Users can update own profile components" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'profiles' AND auth.uid() = owner
);

-- 3. Storage Policies for 'documents'
-- Allow parents to upload to their specific folders
DROP POLICY IF EXISTS "Authenticated Uploads" ON storage.objects;
CREATE POLICY "Authenticated Uploads" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND auth.role() = 'authenticated'
);

-- Allow viewing own documents
DROP POLICY IF EXISTS "View Own Documents" ON storage.objects;
CREATE POLICY "View Own Documents" ON storage.objects
FOR SELECT USING (
    bucket_id = 'documents' AND auth.uid() = owner
);

-- Allow School Admins to view documents
DROP POLICY IF EXISTS "Admins View Documents" ON storage.objects;
CREATE POLICY "Admins View Documents" ON storage.objects
FOR SELECT USING (
    bucket_id = 'documents' AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('School Administration', 'Super Admin')
    )
);

-- 4. Storage Policies for 'expenses'
DROP POLICY IF EXISTS "Expense Receipt View" ON storage.objects;
CREATE POLICY "Expense Receipt View" ON storage.objects
FOR SELECT USING (bucket_id = 'expenses');

DROP POLICY IF EXISTS "Expense Receipt Upload" ON storage.objects;
CREATE POLICY "Expense Receipt Upload" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'expenses' AND auth.role() = 'authenticated'
);
