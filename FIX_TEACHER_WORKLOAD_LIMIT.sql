-- Fix: Add missing 'workload_limit' column to teacher_profiles table
-- Run this in Supabase SQL Editor to resolve the schema cache error

ALTER TABLE public.teacher_profiles
ADD COLUMN IF NOT EXISTS workload_limit INTEGER DEFAULT 20;

-- Update existing records to have a default workload limit
UPDATE public.teacher_profiles
SET workload_limit = 20
WHERE workload_limit IS NULL;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'teacher_profiles' AND column_name = 'workload_limit';
