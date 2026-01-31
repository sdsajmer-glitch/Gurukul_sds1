-- ============================================
-- FIX MISSING FUNCTION: parent_get_document_requirements
-- This function retrieves document requirements for all children of a parent
-- ============================================

CREATE OR REPLACE FUNCTION public.parent_get_document_requirements(p_user_id uuid)
RETURNS TABLE (
  admission_id uuid,
  student_name text,
  grade text,
  requirement_id bigint,
  doc_type text,
  is_required boolean,
  status text,
  file_name text,
  uploaded_at timestamptz,
  rejection_reason text,
  notes_for_parent text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS admission_id,
    a.applicant_name AS student_name,
    a.grade,
    dr.id AS requirement_id,
    dr.document_name AS doc_type,
    dr.is_mandatory AS is_required,
    COALESCE(ad.status, 'Pending') AS status,
    ad.file_name,
    ad.uploaded_at,
    dr.rejection_reason,
    dr.notes_for_parent
  FROM public.admissions a
  JOIN public.document_requirements dr ON a.id = dr.admission_id
  LEFT JOIN public.admission_documents ad ON dr.id = ad.requirement_id
  WHERE a.parent_id = p_user_id
  ORDER BY a.submitted_at DESC, dr.id ASC;
END;
$$;

-- Allow parents to read document requirements
DROP POLICY IF EXISTS "Parents can view requirements" ON public.document_requirements;
CREATE POLICY "Parents can view requirements"
ON public.document_requirements FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admissions a 
    WHERE a.id = document_requirements.admission_id 
    AND (a.parent_id = auth.uid() OR a.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
  )
);

-- Allow parents to read their uploaded documents
DROP POLICY IF EXISTS "Parents can view their uploads" ON public.admission_documents;
CREATE POLICY "Parents can view their uploads"
ON public.admission_documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admissions a 
    WHERE a.id = admission_documents.admission_id 
    AND (a.parent_id = auth.uid() OR a.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
  )
);

-- Allow parents to upload documents
DROP POLICY IF EXISTS "Parents can upload documents" ON public.admission_documents;
CREATE POLICY "Parents can upload documents"
ON public.admission_documents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admissions a 
    WHERE a.id = admission_documents.admission_id 
    AND (a.parent_id = auth.uid() OR a.parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
  )
);

-- Force RLS
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;

SELECT 'SUCCESS: Function parent_get_document_requirements created!' as status;
