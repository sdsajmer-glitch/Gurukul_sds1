
-- ==============================================================================
-- FIX: Create missing RPCs for Branch Management to resolve Infinite Loading
-- ==============================================================================

-- 1. Ensure Table Exists (Idempotent check essentially, usually it exists)
CREATE TABLE IF NOT EXISTS public.school_branches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_user_id uuid, 
  name text NOT NULL,
  address text,
  city text,
  state text,
  country text,
  contact_number text,
  email text,
  is_main_branch boolean DEFAULT false,
  admin_name text,
  admin_phone text,
  admin_email text,
  branch_admin_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.school_branches ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "School Admins can view own branches" ON public.school_branches;
CREATE POLICY "School Admins can view own branches"
ON public.school_branches
FOR ALL
USING (school_user_id = auth.uid() OR branch_admin_id = auth.uid());

-- 4. RPC: get_school_branches
CREATE OR REPLACE FUNCTION public.get_school_branches()
RETURNS SETOF public.school_branches
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.school_branches
    WHERE school_user_id = auth.uid() OR branch_admin_id = auth.uid()
    ORDER BY is_main_branch DESC, created_at ASC;
END;
$$;

-- 5. RPC: create_school_branch
CREATE OR REPLACE FUNCTION public.create_school_branch(
    p_name text,
    p_address text,
    p_city text,
    p_state text,
    p_country text,
    p_contact_number text,
    p_is_main boolean,
    p_email text DEFAULT NULL,
    p_admin_name text DEFAULT NULL,
    p_admin_phone text DEFAULT NULL,
    p_admin_email text DEFAULT NULL
)
RETURNS SETOF public.school_branches
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch_id bigint;
BEGIN
    INSERT INTO public.school_branches (
        school_user_id, name, address, city, state, country, contact_number, is_main_branch,
        email, admin_name, admin_phone, admin_email, created_at
    )
    VALUES (
        auth.uid(), p_name, p_address, p_city, p_state, p_country, p_contact_number, p_is_main,
        p_email, p_admin_name, p_admin_phone, p_admin_email, now()
    )
    RETURNING id INTO v_branch_id;

    RETURN QUERY SELECT * FROM public.school_branches WHERE id = v_branch_id;
END;
$$;

-- 6. RPC: update_school_branch
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
BEGIN
    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM public.school_branches WHERE id = p_branch_id AND school_user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

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
    WHERE id = p_branch_id;

    RETURN QUERY SELECT * FROM public.school_branches WHERE id = p_branch_id;
END;
$$;

-- 7. RPC: delete_school_branch
CREATE OR REPLACE FUNCTION public.delete_school_branch(p_branch_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify ownership
    DELETE FROM public.school_branches
    WHERE id = p_branch_id AND school_user_id = auth.uid();
END;
$$;

