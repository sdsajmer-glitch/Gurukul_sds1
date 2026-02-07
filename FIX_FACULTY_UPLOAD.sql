-- Fixes for Faculty Bulk Upload Functionality

-- 1. Redefine bulk_import_teachers with correct Error handling and Upsert logic including Branch ID sync
CREATE OR REPLACE FUNCTION public.bulk_import_teachers(p_records jsonb, p_branch_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ 
DECLARE 
    rec jsonb; 
    success_count int := 0; 
    failure_count int := 0; 
    errors jsonb[] := ARRAY[]::jsonb[]; 
    v_user_id uuid; 
    v_email text; 
    v_name text; 
    v_phone text;
    v_error_msg text;
    v_current_role text;
BEGIN 
    IF p_branch_id IS NULL THEN RAISE EXCEPTION 'Branch ID must be provided'; END IF; 
    
    FOR rec IN SELECT * FROM jsonb_array_elements(p_records) 
    LOOP 
        BEGIN 
            v_email := lower(trim(rec->>'email')); 
            v_name := trim(rec->>'display_name'); 
            v_phone := rec->>'phone';
            
            IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'Email required'; END IF; 
            IF v_name IS NULL OR v_name = '' THEN RAISE EXCEPTION 'Name required'; END IF; 
            
            -- Find existing user
            SELECT id, role INTO v_user_id, v_current_role FROM public.profiles WHERE email = v_email; 
            
            IF v_user_id IS NULL THEN 
                -- Create new user
                v_user_id := gen_random_uuid(); 
                INSERT INTO public.profiles (id, email, display_name, phone, role, is_active, profile_completed) 
                VALUES (v_user_id, v_email, v_name, v_phone, 'Teacher', true, true); 
            ELSE 
                -- Update existing user
                -- Only update role to Teacher if they are not an Admin
                UPDATE public.profiles 
                SET display_name = v_name, 
                    phone = COALESCE(v_phone, phone),
                    role = CASE 
                        WHEN role IN ('Super Admin', 'School Administration', 'Branch Admin', 'Principal', 'Accountant', 'HR Manager') THEN role 
                        ELSE 'Teacher' 
                    END
                WHERE id = v_user_id;
            END IF; 
            
            -- Upsert Teacher Profile
            -- CRITICAL FIX: Update branch_id on conflict to ensure they appear in the correct roster
            INSERT INTO public.teacher_profiles (
                user_id, 
                department, 
                designation, 
                subject, 
                experience_years, 
                qualification, 
                employment_status, 
                date_of_joining, 
                branch_id
            ) 
            VALUES (
                v_user_id, 
                rec->>'department', 
                COALESCE(rec->>'designation', 'Teacher'), 
                rec->>'subject', 
                (NULLIF(rec->>'experience_years', '')::numeric), 
                rec->>'qualification', 
                COALESCE(rec->>'employment_status', 'Active'), 
                CURRENT_DATE, 
                p_branch_id
            ) 
            ON CONFLICT (user_id) DO UPDATE SET 
                department = EXCLUDED.department, 
                subject = EXCLUDED.subject,
                designation = EXCLUDED.designation,
                branch_id = EXCLUDED.branch_id, -- Sync branch
                employment_status = EXCLUDED.employment_status;
            
            success_count := success_count + 1; 
            
        EXCEPTION WHEN OTHERS THEN 
            failure_count := failure_count + 1; 
            v_error_msg := SQLERRM;
            errors := array_append(errors, jsonb_build_object('row', (rec->>'row_index')::int, 'name', v_name, 'error', v_error_msg)); 
        END; 
    END LOOP; 
    
    RETURN jsonb_build_object('success_count', success_count, 'failure_count', failure_count, 'errors', to_jsonb(errors)); 
END; 
$function$;
