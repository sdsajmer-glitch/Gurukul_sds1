-- ==============================================================================
-- FIX: RLS POLICIES FOR MESSAGING & COMMUNICATIONS
-- ==============================================================================
-- Ensures parents can receive real-time updates and view messages.

BEGIN;

-- 1. COMMUNICATIONS (Broadcasts)
-- This allows users to see messages where they are a recipient or messages are global.
DROP POLICY IF EXISTS "Users can view relevant communications" ON public.communications;
CREATE POLICY "Users can view relevant communications" ON public.communications
  FOR SELECT USING (
    (recipients IS NULL OR array_length(recipients, 1) IS NULL)
    OR
    ((SELECT email FROM public.profiles WHERE id = auth.uid()) = ANY(recipients))
    OR
    ((SELECT auth.jwt() ->> 'email') = ANY(recipients))
  );

-- 2. ENQUIRY MESSAGES
-- This allows parents to see messages for their own enquiries.
DROP POLICY IF EXISTS "Users can view own enquiry messages" ON public.enquiry_messages;
CREATE POLICY "Users can view own enquiry messages" ON public.enquiry_messages
  FOR SELECT USING (
    enquiry_id IN (
      SELECT id FROM public.enquiries 
      WHERE user_id = auth.uid() 
      OR parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
      OR parent_email = (SELECT auth.jwt() ->> 'email')
    )
  );

-- 3. ENQUIRIES (For real-time sync)
DROP POLICY IF EXISTS "Users can view own enquiries" ON public.enquiries;
CREATE POLICY "Users can view own enquiries" ON public.enquiries
  FOR SELECT USING (
    user_id = auth.uid() 
    OR parent_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    OR parent_email = (SELECT auth.jwt() ->> 'email')
  );

COMMIT;
