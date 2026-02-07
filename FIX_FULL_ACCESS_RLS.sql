-- ==============================================================================
-- FIX: FULL PARENT ACCESS RLS POLICIES
-- ==============================================================================

BEGIN;

-- 1. Enable Row Level Security (RLS) if not already enabled
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- 2. ADMISSIONS POLICIES
-- Grant full CRUD access to parents for their own records

-- SELECT
DROP POLICY IF EXISTS "Parents can view own admissions" ON public.admissions;
CREATE POLICY "Parents can view own admissions" ON public.admissions FOR SELECT USING (parent_id = auth.uid());

-- INSERT
DROP POLICY IF EXISTS "Parents can insert own admissions" ON public.admissions;
CREATE POLICY "Parents can insert own admissions" ON public.admissions FOR INSERT WITH CHECK (parent_id = auth.uid());

-- UPDATE (Full Update Access)
DROP POLICY IF EXISTS "Parents can update own admissions" ON public.admissions;
CREATE POLICY "Parents can update own admissions"
ON public.admissions FOR UPDATE
TO authenticated
USING (parent_id = auth.uid())
WITH CHECK (parent_id = auth.uid());

-- 3. ENQUIRIES POLICIES
-- Grant full CRUD access to parents for their own records

-- SELECT
DROP POLICY IF EXISTS "Parents can view own enquiries" ON public.enquiries;
CREATE POLICY "Parents can view own enquiries" ON public.enquiries FOR SELECT USING (user_id = auth.uid());

-- INSERT
DROP POLICY IF EXISTS "Parents can insert own enquiries" ON public.enquiries;
CREATE POLICY "Parents can insert own enquiries" ON public.enquiries FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE (Full Update Access)
DROP POLICY IF EXISTS "Parents can update own enquiries" ON public.enquiries;
CREATE POLICY "Parents can update own enquiries"
ON public.enquiries FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Audit Log
INSERT INTO public.audit_logs (user_id, action, module, details)
VALUES (
    auth.uid(), 
    'SECURITY_UPDATE', 
    'ACCESS_CONTROL', 
    '{"description": "Enforced Full Parent Access Policies on Admissions/Enquiries"}'::jsonb
);

COMMIT;
