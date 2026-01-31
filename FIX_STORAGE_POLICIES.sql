-- ============================================
-- FIX STORAGE POLICIES (No Bucket Creation)
-- Run this AFTER manually creating 'profiles' and 'documents' buckets
-- ============================================

-- 1. Enable RLS on objects (Ensure it is enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for 'profiles' (Public Read, Auth Upload)
-- Allow public read access to profile images
DROP POLICY IF EXISTS "Public Profile Images" ON storage.objects;
CREATE POLICY "Public Profile Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- Allow authenticated users to upload their own profile images
DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;
CREATE POLICY "Users can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profiles' AND auth.uid() = owner);

-- Allow users to update their own images
DROP POLICY IF EXISTS "Users can update specific profile images" ON storage.objects;
CREATE POLICY "Users can update specific profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profiles' AND auth.uid() = owner);

-- 3. Create Policies for 'documents' (Restricted)
DROP POLICY IF EXISTS "Users can manage their own documents" ON storage.objects;
CREATE POLICY "Users can manage their own documents"
ON storage.objects
TO authenticated
USING (bucket_id = 'documents' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'documents' AND auth.uid() = owner);

SELECT 'SUCCESS: Storage policies applied!' as status;
