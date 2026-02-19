-- ==============================================================================
-- FINANCE PHASE 2: OPERATIONAL LEDGER GENERATION - PART 1
-- Student Synchronization & Profile Creation
-- ==============================================================================

BEGIN;

-- 1. CREATE FINANCE STUDENT PROFILE (Shadow Table)
-- ------------------------------------------------------------------------------
-- Acts as the financial identity for a student, separate from academic profile.

CREATE TABLE IF NOT EXISTS public.finance_student_profiles (
    student_id UUID PRIMARY KEY REFERENCES public.student_profiles(user_id) ON DELETE CASCADE,
    branch_id BIGINT REFERENCES public.school_branches(id),
    admission_no TEXT,
    full_name TEXT,
    grade TEXT NOT NULL,
    section TEXT,
    fee_structure_id BIGINT REFERENCES public.finance_fee_structures(id),
    
    -- Financial Health
    total_billed DECIMAL(15,2) DEFAULT 0,
    total_paid DECIMAL(15,2) DEFAULT 0,
    total_due DECIMAL(15,2) DEFAULT 0,
    wallet_balance DECIMAL(15,2) DEFAULT 0, -- Excess payments
    
    -- Status
    financial_status TEXT DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, ALUMNI
    is_structure_assigned BOOLEAN DEFAULT FALSE,
    discount_policy_ids UUID[], -- Array of valid discount IDs applied
    
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by grade/section
CREATE INDEX IF NOT EXISTS idx_finance_profiles_grade ON public.finance_student_profiles(grade);
CREATE INDEX IF NOT EXISTS idx_finance_profiles_structure ON public.finance_student_profiles(fee_structure_id);

-- 2. SYNC FUNCTION (RPC)
-- ------------------------------------------------------------------------------
-- Pulls data from student_profiles and profiles to create/update shadow nodes.

CREATE OR REPLACE FUNCTION public.fn_sync_student_finance_profiles(p_branch_id BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sync_count INTEGER := 0;
    v_new_count INTEGER := 0;
BEGIN
    -- Upsert Logic
    WITH synced_data AS (
        INSERT INTO public.finance_student_profiles (
            student_id, 
            branch_id, 
            admission_no, 
            full_name, 
            grade, 
            section,
            last_sync_at
        )
        SELECT 
            sp.user_id,
            sp.branch_id,
            sp.student_id_number,
            p.display_name,
            sp.grade,
            sc.section, -- Fetch section from school_classes if assigned
            NOW()
        FROM public.student_profiles sp
        JOIN public.profiles p ON p.id = sp.user_id
        LEFT JOIN public.school_classes sc ON sc.id = sp.assigned_class_id
        WHERE (p_branch_id IS NULL OR sp.branch_id = p_branch_id)
          AND sp.is_active = true
        ON CONFLICT (student_id) DO UPDATE SET
            grade = EXCLUDED.grade,
            section = EXCLUDED.section,
            admission_no = EXCLUDED.admission_no,
            full_name = EXCLUDED.full_name,
            last_sync_at = NOW(),
            branch_id = EXCLUDED.branch_id
        RETURNING (xmax = 0) AS is_insert -- xmax=0 means insert
    )
    SELECT 
        COUNT(*), 
        COUNT(*) FILTER (WHERE is_insert) 
    INTO v_sync_count, v_new_count
    FROM synced_data;

    RETURN jsonb_build_object(
        'success', true,
        'total_synced', v_sync_count,
        'new_profiles', v_new_count,
        'timestamp', NOW()
    );
END;
$$;


-- 3. AUTO-ASSIGN STRUCTURE FUNCTION (RPC)
-- ------------------------------------------------------------------------------
-- Assigns 'Default' Fee Structures to students based on their Grade.

CREATE OR REPLACE FUNCTION public.fn_auto_assign_fee_structure_v2(
    p_academic_year TEXT,
    p_branch_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INTEGER := 0;
BEGIN
    -- Logic:
    -- 1. Look for students with NO structure assigned (fee_structure_id IS NULL)
    -- 2. Join with finance_fee_structures ON grade matches
    -- 3. Filter for 'is_default' = TRUE and status = 'Active'
    
    WITH assigned_rows AS (
        UPDATE public.finance_student_profiles fsp
        SET 
            fee_structure_id = fs.id,
            is_structure_assigned = TRUE,
            updated_at = NOW()
        FROM public.finance_fee_structures fs
        WHERE fsp.grade = fs.target_grade
          AND fsp.branch_id = fs.branch_id
          AND fs.academic_year = p_academic_year
          AND fs.is_default = TRUE
          AND fs.status = 'Active'
          AND fs.branch_id = p_branch_id
          AND fsp.fee_structure_id IS NULL -- Only assign if currently null
        RETURNING fsp.student_id
    )
    SELECT COUNT(*) INTO v_updated_count FROM assigned_rows;

    RETURN jsonb_build_object(
        'success', true,
        'assigned_count', v_updated_count,
        'criteria', jsonb_build_object(
            'academic_year', p_academic_year,
            'branch_id', p_branch_id
        )
    );
END;
$$;

COMMIT;
