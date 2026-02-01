-- ==============================================================================
-- FIX: Enable RLS Policies for Document Management by Parents
-- ==============================================================================

-- 1. DOCUMENT REQUIREMENTS POLICIES
-- Allow parents to add/view/delete requirements for their own children's admissions

DROP POLICY IF EXISTS "Parents can manage requirements" ON public.document_requirements;

CREATE POLICY "Parents can manage requirements" ON public.document_requirements
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.admissions
        WHERE public.admissions.id = document_requirements.admission_id
          AND (
            public.admissions.parent_id = auth.uid() 
            OR public.admissions.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
          )
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admissions
        WHERE public.admissions.id = document_requirements.admission_id
          AND (
            public.admissions.parent_id = auth.uid() 
            OR public.admissions.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
          )
    )
);

-- 2. ADMISSION DOCUMENTS POLICIES
-- Allow parents to upload/view files for their requirements

DROP POLICY IF EXISTS "Parents can manage documents" ON public.admission_documents;

CREATE POLICY "Parents can manage documents" ON public.admission_documents
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

-- Allow School Admins to view too
DROP POLICY IF EXISTS "School Admins can view branch documents" ON public.admission_documents;
CREATE POLICY "School Admins can view branch documents" ON public.admission_documents
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.admissions
        JOIN public.profiles ON profiles.id = auth.uid()
        WHERE public.admissions.id = admission_documents.admission_id
          AND profiles.role = 'School Administration'
          AND (profiles.branch_id = public.admissions.branch_id OR profiles.branch_id IS NULL)
    )
);
