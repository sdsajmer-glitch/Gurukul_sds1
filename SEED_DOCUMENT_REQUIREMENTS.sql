-- ============================================
-- SEED DOCUMENT REQUIREMENTS & AUTO-TRIGGER
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create a function to auto-assign requirements
CREATE OR REPLACE FUNCTION public.assign_default_docs_to_admission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert default requirements for the new admission
  INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, notes_for_parent)
  VALUES 
    (new.id, 'Birth Certificate', true, 'Official government-issued birth certificate.'),
    (new.id, 'Passport Size Photo', true, 'Recent color photograph with white background.'),
    (new.id, 'Previous Report Card', false, 'Report card from the previous academic year (if applicable).'),
    (new.id, 'Transfer Certificate', true, 'Transfer certificate from previous school.');
  
  RETURN new;
END;
$$;

-- 2. Attach Trigger to Admissions Table
DROP TRIGGER IF EXISTS trg_assign_docs ON public.admissions;
CREATE TRIGGER trg_assign_docs
  AFTER INSERT ON public.admissions
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_docs_to_admission();

-- 3. ONE-TIME FIX: Add requirements for EXISTING admissions (like Rishabh)
INSERT INTO public.document_requirements (admission_id, document_name, is_mandatory, notes_for_parent)
SELECT 
  a.id, 
  doc.name, 
  doc.mandatory, 
  doc.notes
FROM public.admissions a
CROSS JOIN (
  VALUES 
    ('Birth Certificate', true, 'Official government-issued birth certificate.'),
    ('Passport Size Photo', true, 'Recent color photograph with white background.'),
    ('Previous Report Card', false, 'Report card from the previous academic year (if applicable).'),
    ('Transfer Certificate', true, 'Transfer certificate from previous school.')
) AS doc(name, mandatory, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_requirements dr WHERE dr.admission_id = a.id
);

SELECT 'SUCCESS: Default documents assigned to all students!' as status;
