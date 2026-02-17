-- ==============================================================================
-- FIX FINANCE SELF-HEALING & RLS (MASTER RESET)
-- ==============================================================================
-- Problem: Student shows "Node Unmapped" and Incorrect Swollen Balance (e.g. 2,22,000)
--          even after mapping scripts.
-- Root Cause: 
-- 1. Junk Data: Multiple "Initial Sync" invoices piled up (Duplicates).
-- 2. Visibility: RLS Policies might be hiding the 'student_fee_assignments' row.
-- 3. Sync Logic: Button needs to "Reset & Regenerate" for unpaid students to fix junk.
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] RLS POLICY REPAIR (Fixing "Node Unmapped" visibility)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Ensure the frontend can actually SEE the assignments we are creating.

ALTER TABLE public.student_fee_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_allow_select_assignments" ON public.student_fee_assignments;

CREATE POLICY "policy_allow_select_assignments" 
ON public.student_fee_assignments 
FOR SELECT 
TO authenticated 
USING (true); -- Allow all authenticated users (Admins/Staff) to read assignments.


-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] SELF-HEALING SYNC BUTTON (Fixing "Incorrect Amount")
-- ═══════════════════════════════════════════════════════════════════════════════
-- Updates the 'Map Genesis Protocol' button logic to automatically perform a 
-- "Deep Clean" (Delete & Regenerate) if the student has NOT made any payments yet.
-- This wipes out duplicate bills (2,22,000) and restores the correct amount.

CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_payment_count BIGINT;
    v_ledger_id UUID;
BEGIN
    -- 1. Safety Check: Have they paid anything?
    SELECT COUNT(*) INTO v_payment_count 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND status IN ('Completed', 'Pending');

    -- 2. IF UNPAID: Perform Deep Clean (Wipe junk data)
    IF v_payment_count = 0 THEN
        -- A. Delete Invoices (Wiping the 2,22,000 debt)
        DELETE FROM public.fee_invoices WHERE student_id = p_student_id;
        
        -- B. Get Ledger ID
        SELECT id INTO v_ledger_id FROM public.student_fee_ledger WHERE student_id = p_student_id;
        
        -- C. Clean Ledger Artifacts
        IF v_ledger_id IS NOT NULL THEN
            DELETE FROM public.installment_schedule WHERE ledger_id = v_ledger_id;
            DELETE FROM public.student_fee_ledger WHERE id = v_ledger_id;
        END IF;

        -- D. Reset Assignment Status
        DELETE FROM public.student_fee_assignments WHERE student_id = p_student_id;
    END IF;

    -- 3. REGENERATE (Clean Slate or Gap Fill)
    -- This calls the robust V3 logic to map grade and generate fresh, correct invoices.
    RETURN public.generate_student_ledger(p_student_id);
END;
$$;

COMMIT;

SELECT 'SUCCESS: Self-Healing Logic & RLS Policies Deployed.' as status;
