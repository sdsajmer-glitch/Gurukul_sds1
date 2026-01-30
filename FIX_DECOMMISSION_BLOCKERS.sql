-- ===============================================================================================
--  GURUKUL OS: DECOMMISSIONING PROTOCOL PATCH (v1.0)
--  Fixes Foreign Key Blockers preventing Branch Deletion (Decommissioning)
-- ===============================================================================================

BEGIN;

    -- 1. Fix Profiles (SET NULL on delete so users aren't wiped)
    ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS fk_profiles_branch,
    DROP CONSTRAINT IF EXISTS profiles_branch_id_fkey;
    
    ALTER TABLE public.profiles 
    ADD CONSTRAINT fk_profiles_branch 
    FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE SET NULL;

    -- 2. Fix Departments (CASCADE since departments are branch-specific)
    ALTER TABLE public.school_departments
    DROP CONSTRAINT IF EXISTS school_departments_branch_id_fkey;
    
    ALTER TABLE public.school_departments
    ADD CONSTRAINT school_departments_branch_id_fkey 
    FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE CASCADE;

    -- 3. Fix Classes (CASCADE)
    ALTER TABLE public.school_classes
    DROP CONSTRAINT IF EXISTS school_classes_branch_id_fkey;
    
    ALTER TABLE public.school_classes
    ADD CONSTRAINT school_classes_branch_id_fkey 
    FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE CASCADE;

    -- 4. Fix Student Profiles (SET NULL)
    ALTER TABLE public.student_profiles
    DROP CONSTRAINT IF EXISTS student_profiles_branch_id_fkey;
    
    ALTER TABLE public.student_profiles
    ADD CONSTRAINT student_profiles_branch_id_fkey 
    FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE SET NULL;

    -- 5. Fix Store Products (CASCADE)
    ALTER TABLE public.store_products
    DROP CONSTRAINT IF EXISTS store_products_branch_id_fkey;
    
    ALTER TABLE public.store_products
    ADD CONSTRAINT store_products_branch_id_fkey 
    FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE CASCADE;

    -- 6. Fix Handshake Logs (SET NULL or CASCADE)
    ALTER TABLE public.handshake_audit_logs
    DROP CONSTRAINT IF EXISTS handshake_audit_logs_branch_id_fkey;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'handshake_audit_logs') THEN
        ALTER TABLE public.handshake_audit_logs
        ADD CONSTRAINT handshake_audit_logs_branch_id_fkey 
        FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE SET NULL;
    END IF;

    -- 7. Refresh Schema Cache
    NOTIFY pgrst, 'reload schema';

COMMIT;
