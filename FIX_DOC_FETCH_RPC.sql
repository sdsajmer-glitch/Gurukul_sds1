-- ==============================================================================
-- FIX: Parent Document Fetch RPC
-- Problem: The previous RPC did not return the nested 'admission_documents' array,
-- causing the UI to think no document was uploaded even if status was 'Submitted'.
-- Solution: Use a subquery to aggregate admission_documents into a JSON column.
-- ==============================================================================

-- Drop the old function signature
DROP FUNCTION IF EXISTS public.parent_get_document_requirements(uuid);

CREATE OR REPLACE FUNCTION public.parent_get_document_requirements(p_user_id uuid)
RETURNS TABLE (
    id bigint,
    admission_id uuid,
    document_name text,
    is_mandatory boolean,
    status text,
    rejection_reason text,
    uploaded_at timestamptz,
    created_at timestamptz,
    admission_documents json
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        dr.id,
        dr.admission_id,
        dr.document_name,
        dr.is_mandatory,
        dr.status,
        dr.rejection_reason,
        dr.uploaded_at,
        dr.created_at,
        COALESCE(
            (
                SELECT json_agg(ad)
                FROM public.admission_documents ad
                WHERE ad.requirement_id = dr.id
            ),
            '[]'::json
        ) as admission_documents
    FROM public.document_requirements dr
    JOIN public.admissions a ON dr.admission_id = a.id
    WHERE a.parent_id = p_user_id 
       OR a.parent_email = (SELECT email FROM public.profiles WHERE id = p_user_id);
$$;
