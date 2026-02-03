-- ==============================================================================
-- FIX: DOCUMENT RESOURCES RLS & SYNC PROTOCOLS
-- This file fixes the issue where Admins cannot see documents added by students/parents
-- due to missing or restrictive RLS policies on document_requirements and admission_documents.
-- ==============================================================================

BEGIN;

-- 1. Ensure RLS is enabled
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;

-- 2. HELPER: is_admin (Ensure it exists and is up to date)
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
 BEGIN
   RETURN EXISTS (
     SELECT 1
     FROM public.profiles
     WHERE id = auth.uid()
     AND role IN (
        'School Administration', 
        'Branch Admin', 
        'Super Admin', 
        'Accountant', 
        'Principal', 
        'HR Manager', 
        'Academic Coordinator',
        'Registrar'
     )
   );
 END;
 $$;

-- 3. DOCUMENT REQUIREMENTS POLICIES
DROP POLICY IF EXISTS "Admins can manage all requirements" ON public.document_requirements;
CREATE POLICY "Admins can manage all requirements" ON public.document_requirements
FOR ALL USING (
    public.is_admin()
) WITH CHECK (
    public.is_admin()
);

DROP POLICY IF EXISTS "Parents can view their own requirements" ON public.document_requirements;
CREATE POLICY "Parents can view their own requirements" ON public.document_requirements
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.admissions
        WHERE public.admissions.id = document_requirements.admission_id
          AND (
            public.admissions.parent_id = auth.uid() 
            OR public.admissions.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
          )
    )
);

-- 4. ADMISSION DOCUMENTS POLICIES
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.admission_documents;
CREATE POLICY "Admins can manage all documents" ON public.admission_documents
FOR ALL USING (
    public.is_admin()
) WITH CHECK (
    public.is_admin()
);

DROP POLICY IF EXISTS "Parents can manage their own documents" ON public.admission_documents;
CREATE POLICY "Parents can manage their own documents" ON public.admission_documents
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.admissions
        WHERE public.admissions.id = admission_documents.admission_id
          AND (
            public.admissions.parent_id = auth.uid() 
            OR public.admissions.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
          )
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admissions
        WHERE public.admissions.id = admission_documents.admission_id
          AND (
            public.admissions.parent_id = auth.uid() 
            OR public.admissions.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
          )
    )
);

-- 5. FINAL SYNC: Ensure admissions are viewable by admins
DROP POLICY IF EXISTS "Admins can view branch admissions" ON public.admissions;
CREATE POLICY "Admins can view branch admissions" ON public.admissions
FOR SELECT USING (
    public.is_admin()
);

COMMIT;
