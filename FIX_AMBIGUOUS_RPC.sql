BEGIN;

-- Drop the ambiguous functions to resolve the "Could not choose the best candidate function" error.
-- We must drop both signatures to ensure a clean slate.
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(text, text, text);
DROP FUNCTION IF EXISTS public.admin_update_enquiry_status(uuid, text, text);

-- Recreate the single, authoritative function accepting UUID for the ID.
-- This aligns with the 'enquiries.id' column type (UUID) and standard PostgREST behavior.
CREATE OR REPLACE FUNCTION public.admin_update_enquiry_status(
    p_enquiry_id uuid,
    p_status text,
    p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.enquiries
    SET 
        status = p_status,
        notes = p_notes,
        updated_at = now()
    WHERE id = p_enquiry_id;
END;
$$;

COMMIT;
