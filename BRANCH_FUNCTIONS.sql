-- Branch Management Functions
-- Defines RPCs for creating, updating, and deleting school branches.

-- 1. Create School Branch
CREATE OR REPLACE FUNCTION public.create_school_branch(
    p_name text,
    p_address text,
    p_city text,
    p_state text,
    p_country text,
    p_contact_number text,
    p_is_main boolean,
    p_email text,
    p_admin_name text,
    p_admin_phone text,
    p_admin_email text
)
RETURNS SETOF public.school_branches
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();

    -- If setting as main branch, unset any existing main branches for this user
    IF p_is_main THEN
        UPDATE public.school_branches 
        SET is_main_branch = false 
        WHERE school_user_id = v_user_id;
    END IF;

    -- Insert new branch
    RETURN QUERY
    INSERT INTO public.school_branches (
        name,
        address,
        city,
        state,
        country,
        contact_number,
        is_main_branch,
        email,
        admin_name,
        admin_phone,
        admin_email,
        school_user_id
    ) VALUES (
        p_name,
        p_address,
        p_city,
        p_state,
        p_country,
        p_contact_number,
        p_is_main,
        p_email,
        p_admin_name,
        p_admin_phone,
        p_admin_email,
        v_user_id
    )
    RETURNING *;
END;
$$;

-- 2. Update School Branch
CREATE OR REPLACE FUNCTION public.update_school_branch(
    p_branch_id bigint,
    p_name text,
    p_address text,
    p_city text,
    p_state text,
    p_country text,
    p_contact_number text,
    p_is_main boolean,
    p_email text,
    p_admin_name text,
    p_admin_phone text,
    p_admin_email text
)
RETURNS SETOF public.school_branches
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();

    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM public.school_branches WHERE id = p_branch_id AND school_user_id = v_user_id) THEN
        RAISE EXCEPTION 'Access Denied: You do not own this branch.';
    END IF;

    -- If setting as main branch, unset any existing main branches for this user
    IF p_is_main THEN
        UPDATE public.school_branches 
        SET is_main_branch = false 
        WHERE school_user_id = v_user_id AND id != p_branch_id;
    END IF;

    RETURN QUERY
    UPDATE public.school_branches
    SET 
        name = p_name,
        address = p_address,
        city = p_city,
        state = p_state,
        country = p_country,
        contact_number = p_contact_number,
        is_main_branch = p_is_main,
        email = p_email,
        admin_name = p_admin_name,
        admin_phone = p_admin_phone,
        admin_email = p_admin_email
    WHERE id = p_branch_id
    RETURNING *;
END;
$$;

-- 3. Delete School Branch
CREATE OR REPLACE FUNCTION public.delete_school_branch(p_branch_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();

    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM public.school_branches WHERE id = p_branch_id AND school_user_id = v_user_id) THEN
        RAISE EXCEPTION 'Access Denied: You do not own this branch.';
    END IF;

    DELETE FROM public.school_branches WHERE id = p_branch_id;
END;
$$;
