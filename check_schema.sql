-- check admissions columns
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'admissions';

-- check student_parents columns
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'student_parents';
