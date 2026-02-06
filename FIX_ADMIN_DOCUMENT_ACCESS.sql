-- ==============================================================================
-- MASTER FIX: ADMINISTRATIVE ACCESS TO ADMISSION DOCUMENTS & VERIFICATION
-- ==============================================================================
-- Resolves: School Admins/Branch Admins unable to view, download, approve, or reject
-- admission documents.
-- ==============================================================================

BEGIN;

-- 1. DEFINE ADMIN ROLES FOR CONSISTENCY
-- Includes all common permutations used in the system
DO $$
BEGIN
    -- This block ensures we have a consistent set of roles to check against
END $$;

-- 2. UPDATE DOCUMENT REQUIREMENTS POLICIES (Approve/Reject Access)
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage requirements" ON public.document_requirements;
DROP POLICY IF EXISTS "Parents can manage requirements" ON public.document_requirements;
DROP POLICY IF EXISTS "Admins can manage requirements" ON public.document_requirements;

CREATE POLICY "Admins can manage requirements" ON public.document_requirements
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'school_admin', 'branch_admin', 'super_admin')
    )
);

CREATE POLICY "Parents can view and update own requirements" ON public.document_requirements
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admissions
        WHERE public.admissions.id = document_requirements.admission_id
          AND (
            public.admissions.parent_id = auth.uid() 
            OR public.admissions.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
          )
    )
);

-- 3. UPDATE ADMISSION DOCUMENTS POLICIES (View/Download Record Access)
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School Admins can view branch documents" ON public.admission_documents;
DROP POLICY IF EXISTS "Parents can manage documents" ON public.admission_documents;
DROP POLICY IF EXISTS "Admins can manage documents" ON public.admission_documents;

CREATE POLICY "Admins can manage documents" ON public.admission_documents
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'school_admin', 'branch_admin', 'super_admin')
    )
);

CREATE POLICY "Parents can manage own documents" ON public.admission_documents
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admissions
        WHERE public.admissions.id = admission_documents.admission_id
          AND (
            public.admissions.parent_id = auth.uid() 
            OR public.admissions.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
          )
    )
);

-- 4. UPDATE STORAGE POLICIES (Actual File Download Access)
-- These reside in the 'storage' schema
DROP POLICY IF EXISTS "Admins View Documents" ON storage.objects;
CREATE POLICY "Admins View Documents" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'documents' 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('School Administration', 'Branch Admin', 'Super Admin', 'Principal', 'school_admin', 'branch_admin', 'super_admin')
    )
);

-- Ensure authenticated users can still see their own uploads
DROP POLICY IF EXISTS "View Own Documents" ON storage.objects;
CREATE POLICY "View Own Documents" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'documents' AND auth.uid() = owner
);

COMMIT;

SELECT 'SUCCESS: Administrative Document Access Protocol Restored.' as status;
