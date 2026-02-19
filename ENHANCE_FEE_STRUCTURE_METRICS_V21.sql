-- =============================================================================
-- [FINANCE] MASTER CONTROL ENHANCEMENT: EXPLICIT PROTOCOL SYNC (V21)
-- Objective: Ensure "Sync" always uses the SPECIFIC structure ID clicked by the user,
--            overriding any "Default" logic for that batch.
-- =============================================================================

BEGIN;

-- 1. ENHANCED SYNC ENGINE: Explicit Structure Linking
CREATE OR REPLACE FUNCTION public.bulk_sync_grade_fee_structure(
    p_structure_id BIGINT,
    p_branch_id BIGINT
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
    v_target_grade TEXT;
    v_student_id UUID;
    v_count INT := 0;
    v_component RECORD;
BEGIN
    -- 1. Identify context
    SELECT target_grade INTO v_target_grade FROM public.fee_structures WHERE id = p_structure_id;
    
    IF v_target_grade IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Structure not found.');
    END IF;

    -- 2. Process all students in this grade for the branch
    FOR v_student_id IN 
        SELECT user_id FROM public.student_profiles 
        WHERE grade = v_target_grade AND (branch_id = p_branch_id OR p_branch_id IS NULL)
    LOOP
        -- A. Force Assignment to THIS specific structure
        INSERT INTO public.student_fee_assignments (student_id, structure_id)
        VALUES (v_student_id, p_structure_id)
        ON CONFLICT (student_id) DO UPDATE SET structure_id = p_structure_id;

        -- B. Generate Invoices for all components in THIS structure
        FOR v_component IN 
            SELECT * FROM public.fee_components WHERE structure_id = p_structure_id
        LOOP
            -- Only create if not already billed for this component to prevent duplication
            IF NOT EXISTS (
                SELECT 1 FROM public.fee_invoices 
                WHERE student_id = v_student_id 
                AND description ILIKE v_component.name || '%'
                AND status != 'Cancelled'
            ) THEN
                INSERT INTO public.fee_invoices (
                    student_id, total_amount, due_date, description, status, created_at
                ) VALUES (
                    v_student_id, v_component.amount, NOW() + INTERVAL '15 days',
                    v_component.name || ' (PROTOCOL_SYNC)', 'Pending', NOW()
                );
            END IF;
        END LOOP;

        -- C. Reconcile the student's global account
        PERFORM public.admin_reconcile_student_account(v_student_id);
        
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'students_synced', v_count,
        'protocol_id', p_structure_id,
        'grade', v_target_grade,
        'timestamp', NOW()
    );
END;
$$;

COMMIT;

SELECT 'SUCCESS: Explicit Sync V21 deployed.' as status;
