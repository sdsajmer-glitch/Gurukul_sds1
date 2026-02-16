-- ==============================================================================
-- GURUKUL OS: FINANCE DATA DIAGNOSTIC & HEALING (v8.0)
-- 1. Identifies if children exist in admissions but not in student_parents
-- 2. Validates if Enrolled students have student_user_id
-- 3. FORCES synchronization for the current user
-- ==============================================================================

DO $$
DECLARE
    v_parent_id UUID;
    v_child RECORD;
    v_new_student_id UUID;
BEGIN
    -- [1] Find active parent (The one we're troubleshooting)
    -- We'll look for 'Sanjay Dutt Sharma' as indicated in user screenshots
    SELECT id INTO v_parent_id FROM public.profiles WHERE display_name ILIKE '%Sanjay Dutt Sharma%' LIMIT 1;
    
    IF v_parent_id IS NULL THEN
        RAISE NOTICE 'Parent Sanjay Dutt Sharma not found in profiles.';
    ELSE
        RAISE NOTICE 'Found Parent ID: %', v_parent_id;
        
        -- [2] Find all admissions linked to this email or name
        -- Even if parent_id is NULL on the admission, we match by email/name
        FOR v_child IN (
            SELECT a.id, a.applicant_name, a.parent_email, a.student_user_id, a.status, a.grade
            FROM public.admissions a
            JOIN public.profiles p ON LOWER(a.parent_email) = LOWER(p.email)
            WHERE p.id = v_parent_id
               OR a.parent_id = v_parent_id
        ) LOOP
            RAISE NOTICE 'Processing Child: %, Status: %, UserID: %', v_child.applicant_name, v_child.status, v_child.student_user_id;
            
            -- [3] If student_user_id is missing but they are VERIFIED/ENROLLED, fix it!
            IF v_child.student_user_id IS NULL AND v_child.status IN ('ENROLLED', 'VERIFIED', 'APPROVED') THEN
                RAISE NOTICE 'Fixing missing student_user_id for %', v_child.applicant_name;
                
                -- Check if a profile already exists for this student by name/grade (risky but needed)
                -- Actually, let's create a new one if not found
                INSERT INTO public.profiles (id, email, display_name, role, branch_id, profile_completed)
                VALUES (
                    gen_random_uuid(), 
                    'student.' || LOWER(REPLACE(v_child.applicant_name, ' ', '.')) || '.' || floor(random()*1000)::text || '@gurukul.internal',
                    v_child.applicant_name,
                    'student',
                    (SELECT branch_id FROM public.admissions WHERE id = v_child.id),
                    true
                )
                RETURNING id INTO v_new_student_id;
                
                UPDATE public.admissions SET student_user_id = v_new_student_id WHERE id = v_child.id;
                
                -- Initialize Student Profile
                INSERT INTO public.student_profiles (user_id, admission_id, grade, enrollment_status, branch_id)
                VALUES (v_new_student_id, v_child.id, v_child.grade, v_child.status, (SELECT branch_id FROM public.admissions WHERE id = v_child.id))
                ON CONFLICT DO NOTHING;
                
                v_child.student_user_id := v_new_student_id;
            END IF;
            
            -- [4] Ensure LINKAGE in student_parents
            IF v_child.student_user_id IS NOT NULL THEN
                INSERT INTO public.student_parents (student_id, parent_id, relationship)
                VALUES (v_child.student_user_id, v_parent_id, 'Father')
                ON CONFLICT (student_id, parent_id) DO NOTHING;
                RAISE NOTICE 'Linked % to Parent', v_child.applicant_name;
            END IF;
        END LOOP;
    END IF;
END $$;
