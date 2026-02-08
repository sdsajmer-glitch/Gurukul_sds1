-- ==============================================================================
-- FIX: Subject Mapping Constraint
-- Description: Adds a unique constraint to `class_subjects` to allow bulk upserts.
--              Also updates the RPC to be robust.
-- ==============================================================================

-- 1. CLEANUP: Remove potential duplicates in `class_subjects` before adding constraint
DELETE FROM public.class_subjects a 
USING public.class_subjects b
WHERE a.id > b.id 
  AND a.class_id = b.class_id 
  AND a.subject_id = b.subject_id;

-- 2. CONSTRAINT: Add unique constraint on (class_id, subject_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'class_subjects_class_id_subject_id_key'
    ) THEN
        ALTER TABLE public.class_subjects 
        ADD CONSTRAINT class_subjects_class_id_subject_id_key UNIQUE (class_id, subject_id);
    END IF;
END $$;

-- 3. RPC UPDATE: bulk_map_subjects_to_classes
-- Ensures correct error handling and branch scoping
CREATE OR REPLACE FUNCTION public.bulk_map_subjects_to_classes(p_mappings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE 
    rec jsonb; 
    v_class_id bigint; 
    v_subject_id bigint; 
    success_count int := 0; 
    failure_count int := 0; 
    errors jsonb[] := ARRAY[]::jsonb[];
    v_class_name text;
    v_subject_code text;
BEGIN 
    FOR rec IN SELECT * FROM jsonb_array_elements(p_mappings) 
    LOOP 
        BEGIN 
            v_class_name := trim(both '' from rec->>'class_name');
            v_subject_code := trim(both '' from rec->>'subject_code');

            -- Find Class (scoped to user's branches)
            SELECT id INTO v_class_id 
            FROM public.school_classes 
            WHERE upper(trim(name)) = upper(v_class_name) 
            AND branch_id IN (SELECT * FROM public.get_my_branch_ids()); 
            
            IF v_class_id IS NULL THEN 
                RAISE EXCEPTION 'Class "%" not found in your branches', v_class_name; 
            END IF; 
            
            -- Find Subject (Course)
            SELECT id INTO v_subject_id 
            FROM public.courses 
            WHERE upper(trim(code)) = upper(v_subject_code); -- Subject code should be unique
            
            IF v_subject_id IS NULL THEN 
                RAISE EXCEPTION 'Subject code "%" not found', v_subject_code; 
            END IF; 
            
            -- Insert Mapping
            INSERT INTO public.class_subjects (class_id, subject_id) 
            VALUES (v_class_id, v_subject_id) 
            ON CONFLICT (class_id, subject_id) DO NOTHING; 
            
            success_count := success_count + 1; 
            
        EXCEPTION WHEN OTHERS THEN 
            failure_count := failure_count + 1; 
            errors := array_append(errors, jsonb_build_object(
                'class', v_class_name, 
                'subject', v_subject_code,
                'error', SQLERRM
            )); 
        END; 
    END LOOP; 
    
    RETURN jsonb_build_object(
        'success_count', success_count, 
        'failure_count', failure_count, 
        'errors', to_jsonb(errors)
    ); 
END; 
$function$;

-- 4. PERMISSIONS
GRANT ALL ON public.class_subjects TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_map_subjects_to_classes TO authenticated;
