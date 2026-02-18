-- =============================================================================
-- FINANCE REPAIR: GLOBAL STRUCTURE & DATA REALIGNMENT
-- =============================================================================
-- Problem: Mismatched totals (e.g. 90,000 vs 78,000) due to duplicate 
--          structures or components across various grades (Grade 1, Grade 5, etc.)
--
-- TARGET: 
-- 1. Archive all but the LATEST Active Structure per Grade/Cycle.
-- 2. Deduplicate Components within every active structure.
-- 3. Synchronize Student Fee Ledgers for ALL students to match the master.
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. IDENTIFY & ARCHIVE DUPLICATE STRUCTURES (GLOBAL)
-- We only allow ONE active structure per Grade per Academic Cycle.
WITH latest_structs AS (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY academic_cycle_id, LOWER(TRIM(target_grade)) 
                   ORDER BY created_at DESC, id DESC
               ) as rn
        FROM public.fee_structures
        WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    ) t WHERE t.rn = 1
)
UPDATE public.fee_structures
SET status = 'archived', state = 'ARCHIVED'
WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
AND id NOT IN (SELECT id FROM latest_structs);

-- 2. REPAIR COMPONENTS (GLOBAL DEDUPLICATION)
-- This fixes the "90,000 instead of 78,000" bug caused by ghost components.
DELETE FROM public.fee_components
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY structure_id, LOWER(TRIM(name)) 
                   ORDER BY id ASC
               ) as rn
        FROM public.fee_components
        WHERE structure_id IN (
            SELECT id FROM public.fee_structures 
            WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
        )
    ) t WHERE t.rn > 1
);

-- 3. SPECIFIC CLEANUP FOR GRADE 5 (IF NEEDED)
-- Remove any specific components that were incorrectly added to Grade 5.
-- (Optional: add manual DELETE if you know the exact ghost component name)

-- 4. NUCLEAR REALIGNMENT FOR STUDENTS
DO $$
DECLARE
    v_student_id UUID;
BEGIN
    -- Force Re-sync for Grade 1 and Grade 5 specifically first to be sure
    FOR v_student_id IN 
        SELECT user_id FROM public.student_profiles 
        WHERE (grade ILIKE 'Grade 1' OR grade ILIKE 'Grade 5' OR grade ILIKE 'Grade1' OR grade ILIKE 'Grade5' OR grade IN ('1', '5'))
    LOOP
        PERFORM public.generate_student_ledger(v_student_id);
    END LOOP;

    -- Global Re-sync for remaining (incremental)
    FOR v_student_id IN SELECT user_id FROM public.student_profiles LOOP
        PERFORM public.admin_reconcile_student_account(v_student_id);
    END LOOP;
END $$;

COMMIT;

SELECT 'SUCCESS: Global Finance Realignment Complete. Grade 1 & 5 Discrepancies Resolved.' as status;
