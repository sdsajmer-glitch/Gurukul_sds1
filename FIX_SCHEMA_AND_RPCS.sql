-- ===============================================================================================
--  GURUKUL OS - CRITICAL SCHEMA REMEDIATION
--  Description: Fixes "COLUMN 'SCHOOL_ID' DOES NOT EXIST" and "0 Branches" visibility issues.
--  Instructions: Run this ENTIRE script in the Supabase SQL Editor.
-- ===============================================================================================

BEGIN;

-- 1. FORCE ADD MISSING COLUMNS
-- ===============================================================================================
DO $$ 
BEGIN
    -- Ensure school_id exists on 'school_branches'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'school_branches' AND column_name = 'school_id') THEN
        ALTER TABLE public.school_branches ADD COLUMN school_id UUID REFERENCES public.school_admin_profiles(user_id) ON DELETE CASCADE;
    END IF;

    -- Ensure school_id exists on 'profiles'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'school_id') THEN
        ALTER TABLE public.profiles ADD COLUMN school_id UUID;
    END IF;

    -- Ensure branch_id exists on 'profiles'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'branch_id') THEN
        ALTER TABLE public.profiles ADD COLUMN branch_id BIGINT REFERENCES public.school_branches(id);
    END IF;
END $$;

-- 2. UPDATE RPCs WITH ROBUST FALLBACK LOGIC
-- ===============================================================================================

-- RPC: Get School Branches (With Fallback for School Admin)
CREATE OR REPLACE FUNCTION public.get_school_branches()
RETURNS SETOF public.school_branches LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_role TEXT;
    v_my_school_id UUID;
    v_my_branch_id BIGINT;
    v_user_email TEXT;
BEGIN
    SELECT role, school_id, branch_id INTO v_user_role, v_my_school_id, v_my_branch_id 
    FROM public.profiles WHERE id = auth.uid();
    
    -- Fallback: If school_id is missing in profile, try to find it in school_admin_profiles
    IF v_my_school_id IS NULL AND v_user_role IN ('School Admin', 'School Administration') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_admin_profiles') THEN
            SELECT school_id INTO v_my_school_id FROM public.school_admin_profiles WHERE user_id = auth.uid();
        END IF;
    END IF;

    v_user_email := auth.jwt() ->> 'email';

    -- Case 1: Super Admin (See All)
    IF v_user_role = 'Super Admin' THEN
        RETURN QUERY SELECT * FROM public.school_branches ORDER BY name;
        RETURN;
    END IF;

    -- Case 2: School Admin (See All in School)
    IF v_user_role IN ('School Admin', 'School Administration') AND v_my_branch_id IS NULL THEN
        -- He is a centralized admin
        RETURN QUERY SELECT * FROM public.school_branches 
        WHERE school_id = v_my_school_id
        ORDER BY is_main_branch DESC, name;
        RETURN;
    END IF;

    -- Case 3: Branch Admin / Staff (See ONLY Own Branch)
    RETURN QUERY SELECT * FROM public.school_branches 
    WHERE id = v_my_branch_id 
       OR LOWER(admin_email) = LOWER(v_user_email);
END;
$$;

-- RPC: Get Network Registry Metrics (With Fallback)
CREATE OR REPLACE FUNCTION public.get_network_registry_metrics()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_role TEXT;
    v_school_id UUID;
    v_branch_id BIGINT;
    v_total_nodes INT;
    v_verified_links INT;
    v_online_nodes INT;
BEGIN
    SELECT role, school_id, branch_id INTO v_role, v_school_id, v_branch_id FROM public.profiles WHERE id = auth.uid();

    -- Fallback: If school_id is missing in profile, try to find it in school_admin_profiles
    IF v_school_id IS NULL AND v_role IN ('School Admin', 'School Administration') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_admin_profiles') THEN
            SELECT school_id INTO v_school_id FROM public.school_admin_profiles WHERE user_id = auth.uid();
        END IF;
    END IF;

    -- Filter base table
    IF v_role IN ('School Admin', 'School Administration') AND v_branch_id IS NULL THEN
        -- School View: All Nodes
        SELECT count(*), count(*) FILTER (WHERE status = 'Verified'), count(*) FILTER (WHERE status = 'Online')
        INTO v_total_nodes, v_verified_links, v_online_nodes
        FROM public.school_branches
        WHERE school_id = v_school_id;
    ELSE
        -- Branch View: Only Self
        SELECT count(*), count(*) FILTER (WHERE status = 'Verified'), count(*) FILTER (WHERE status = 'Online')
        INTO v_total_nodes, v_verified_links, v_online_nodes
        FROM public.school_branches
        WHERE id = v_branch_id;
    END IF;

    RETURN jsonb_build_object(
        'total_nodes', COALESCE(v_total_nodes, 0),
        'verified_links', COALESCE(v_verified_links, 0),
        'online_nodes', COALESCE(v_online_nodes, 0),
        'protocol_health', 100,
        'version', 'v4.5'
    );
END;
$$;

COMMIT;
