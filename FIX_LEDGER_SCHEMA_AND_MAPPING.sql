-- ==============================================================================
-- FIX LEDGER SCHEMA & MAPPING (GOLDEN PATCH)
-- ==============================================================================
-- Problem: "Attribute Desync: column "grade" of relation "student_fee_ledger" does not exist."
-- Cause: The ledger table is missing the 'grade' column needed for the robust mapping (V2/V3).
-- Solution: 
-- 1. Patch Schema: Add 'grade' column to student_fee_ledger.
-- 2. Re-Deploy Functions: Combine Type-Safe Logic (V3) + Self-Healing Sync (Deep Clean).
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- [1] SCHEMA REPAIR: Add Missing Column
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.student_fee_ledger ADD COLUMN IF NOT EXISTS grade TEXT;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [2] CORE: generate_student_ledger (V3 Type-Safe + Robust Logic)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_student_ledger(
    p_student_id UUID,
    p_academic_year_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_branch_id BIGINT;
    v_grade TEXT;
    v_normalized_grade TEXT;
    v_structure_id BIGINT;
    v_structure_year_id BIGINT;
    v_year_id BIGINT := p_academic_year_id;
    v_component RECORD;
    v_count INTEGER := 0;
    v_ledger_id UUID;
    v_available_structures JSONB;
BEGIN
    -- 1. Fetch Student Context
    SELECT branch_id, grade INTO v_branch_id, v_grade 
    FROM public.student_profiles WHERE user_id = p_student_id;
    
    IF v_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_PROFILE_HAS_NO_GRADE');
    END IF;

    -- 2. Auto-Detect Academic Year if NULL
    IF v_year_id IS NULL THEN
        SELECT id INTO v_year_id FROM public.academic_years 
        WHERE (branch_id = v_branch_id OR branch_id IS NULL)
        AND is_current = true
        AND LOWER(status::text) IN ('active', 'current')
        LIMIT 1;
    END IF;

    -- 3. Normalize Grade (e.g. "Grade 4" -> "4")
    v_normalized_grade := TRIM(REPLACE(REPLACE(LOWER(v_grade), 'class', ''), 'grade', ''));

    -- 4. Find Fee Structure (Robust Lookup: Global or Specific)
    SELECT id, academic_cycle_id INTO v_structure_id, v_structure_year_id
    FROM public.fee_structures 
    WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
    AND (
         (v_year_id IS NOT NULL AND academic_cycle_id = v_year_id)
         OR academic_cycle_id IS NULL
    )
    AND (
        LOWER(target_grade) = LOWER(v_grade)
        OR 
        TRIM(REPLACE(REPLACE(LOWER(target_grade), 'class', ''), 'grade', '')) = v_normalized_grade
    )
    ORDER BY (CASE WHEN academic_cycle_id IS NOT NULL THEN 0 ELSE 1 END), created_at DESC 
    LIMIT 1;

    -- 5. Handle Missing Structure
    IF v_structure_id IS NULL THEN
        SELECT jsonb_agg(DISTINCT target_grade) INTO v_available_structures
        FROM public.fee_structures
        WHERE (LOWER(status::text) = 'active' OR UPPER(state::text) = 'ACTIVE')
        AND (academic_cycle_id = v_year_id OR academic_cycle_id IS NULL);

        RETURN jsonb_build_object(
            'success', false, 
            'error', 'GRADE_MAPPING_MISSING',
            'message', 'No active fee structure found for ' || v_grade || '. Available Configs: ' || COALESCE(v_available_structures::text, 'None')
        );
    END IF;

    -- 6. Link Assignment (Crucial for UI)
    INSERT INTO public.student_fee_assignments (student_id, structure_id)
    VALUES (p_student_id, v_structure_id)
    ON CONFLICT (student_id) DO UPDATE SET structure_id = v_structure_id;

    -- 7. Create/Update Ledger (With 'grade' column now guaranteed)
    SELECT id INTO v_ledger_id FROM public.student_fee_ledger
    WHERE student_id = p_student_id AND (academic_year_id = v_year_id OR (v_year_id IS NULL AND academic_year_id IS NULL));

    IF v_ledger_id IS NULL THEN
        INSERT INTO public.student_fee_ledger (
            student_id, academic_year_id, total_amount, status, created_at, updated_at, grade
        ) VALUES (
            p_student_id, v_year_id, 0, 'active', NOW(), NOW(), v_grade
        ) RETURNING id INTO v_ledger_id;
    END IF;

    -- 8. Populate Invoices (Legacy)
    FOR v_component IN 
        SELECT * FROM public.fee_components WHERE structure_id = v_structure_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_invoices 
            WHERE student_id = p_student_id 
            AND description ILIKE v_component.name || '%'
            AND status NOT IN ('Cancelled', 'cancelled')
        ) THEN
            INSERT INTO public.fee_invoices (
                student_id, total_amount, due_date, description, status, created_at, structure_id
            ) VALUES (
                p_student_id, v_component.amount, NOW() + INTERVAL '15 days',
                v_component.name || ' (INITIAL_SYNC)', 'Pending', NOW(), v_structure_id
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 9. Update Ledger Total
    UPDATE public.student_fee_ledger
    SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM public.fee_components WHERE structure_id = v_structure_id),
        updated_at = NOW()
    WHERE id = v_ledger_id;

    -- 10. Reconcile
    PERFORM public.admin_reconcile_student_account(p_student_id);

    RETURN jsonb_build_object(
        'success', true, 
        'invoices_created', v_count, 
        'structure_id', v_structure_id,
        'ledger_id', v_ledger_id,
        'mapped_grade', v_grade
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- [3] WRAPPER: admin_sync_student_billing (Self-Healing Version)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Includes Deep Clean for unpaid students to fix the 2.22L balance issue.

CREATE OR REPLACE FUNCTION public.admin_sync_student_billing(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_payment_count BIGINT;
    v_ledger_id UUID;
BEGIN
    -- 1. Safety Check (Have they paid?)
    SELECT COUNT(*) INTO v_payment_count 
    FROM public.fee_payments 
    WHERE student_id = p_student_id AND status IN ('Completed', 'Pending');

    -- 2. IF UNPAID: Deep Clean (Wipe junk)
    IF v_payment_count = 0 THEN
        DELETE FROM public.fee_invoices WHERE student_id = p_student_id;
        
        SELECT id INTO v_ledger_id FROM public.student_fee_ledger WHERE student_id = p_student_id;
        
        IF v_ledger_id IS NOT NULL THEN
            DELETE FROM public.installment_schedule WHERE ledger_id = v_ledger_id;
            DELETE FROM public.student_fee_ledger WHERE id = v_ledger_id;
        END IF;

        DELETE FROM public.student_fee_assignments WHERE student_id = p_student_id;
    END IF;

    -- 3. REGENERATE (Using Robust V3)
    RETURN public.generate_student_ledger(p_student_id); -- Default param usage
END;
$$;

-- Alias Wrapper
CREATE OR REPLACE FUNCTION public.generate_student_ledger_for_student(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN public.generate_student_ledger(p_student_id);
END;
$$;

COMMIT;

SELECT 'SUCCESS: Ledger Schema Patched & Full Logic Deployed.' as status;
