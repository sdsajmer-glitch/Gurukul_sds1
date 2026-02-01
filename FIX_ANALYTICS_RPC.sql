-- ==============================================================================
-- RPC: get_admin_analytics_stats
-- Purpose: Returns key institutional metrics for the Admin Analytics Dashboard.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_analytics_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_users bigint;
    v_total_apps bigint;
    v_pending_apps bigint;
    v_branch_id bigint;
    v_role text;
BEGIN
    -- Get caller context
    SELECT role, branch_id INTO v_role, v_branch_id 
    FROM public.profiles 
    WHERE id = auth.uid();

    -- Calculation Logic based on context
    IF v_role = 'Super Admin' THEN
        SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE role = 'Student';
        SELECT COUNT(*) INTO v_total_apps FROM public.admissions;
        SELECT COUNT(*) INTO v_pending_apps FROM public.admissions WHERE status NOT IN ('Joined', 'Admitted', 'Rejected');
    ELSIF v_branch_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE branch_id = v_branch_id AND role = 'Student';
        SELECT COUNT(*) INTO v_total_apps FROM public.admissions WHERE branch_id = v_branch_id;
        SELECT COUNT(*) INTO v_pending_apps FROM public.admissions WHERE branch_id = v_branch_id AND status NOT IN ('Joined', 'Admitted', 'Rejected');
    ELSE
        -- Head Office Admin or fallback: All stats they are authorized to see (RLS will handle actual data, but we want aggregate)
        SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE role = 'Student';
        SELECT COUNT(*) INTO v_total_apps FROM public.admissions;
        SELECT COUNT(*) INTO v_pending_apps FROM public.admissions WHERE status NOT IN ('Joined', 'Admitted', 'Rejected');
    END IF;

    RETURN jsonb_build_object(
        'total_users', COALESCE(v_total_users, 0),
        'total_applications', COALESCE(v_total_apps, 0),
        'pending_applications', COALESCE(v_pending_apps, 0)
    );
END;
$$;
