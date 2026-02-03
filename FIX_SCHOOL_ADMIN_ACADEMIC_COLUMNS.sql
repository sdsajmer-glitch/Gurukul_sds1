-- Add missing academic columns to school_admin_profiles table
ALTER TABLE public.school_admin_profiles 
ADD COLUMN IF NOT EXISTS admin_designation text DEFAULT 'Director',
ADD COLUMN IF NOT EXISTS academic_board text,
ADD COLUMN IF NOT EXISTS school_type text,
ADD COLUMN IF NOT EXISTS academic_year_start text,
ADD COLUMN IF NOT EXISTS academic_year_end text,
ADD COLUMN IF NOT EXISTS grade_range_start text,
ADD COLUMN IF NOT EXISTS grade_range_end text;

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'school_admin_profiles'
ORDER BY ordinal_position;
