DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE 'Columns of public.payments:';
    FOR r IN SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments' LOOP
        RAISE NOTICE '% (%)', r.column_name, r.data_type;
    END LOOP;
END $$;
