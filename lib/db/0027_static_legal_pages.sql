-- Retire only the unused legal publication/evidence registry.
-- A single statement is atomic, including the zero-row checks and DDL.
-- Abort rather than destroy history if any deployment has collected records.
DO $$
DECLARE table_name text; record_count bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'b1_legal_documents', 'b1_legal_active', 'b1_legal_signup_choices',
    'b1_legal_signup_reservations', 'b1_legal_acceptances', 'b1_legal_purchases'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', table_name);
      EXECUTE format('SELECT count(*) FROM public.%I', table_name) INTO record_count;
      IF record_count <> 0 THEN
        RAISE EXCEPTION 'Registry retirement refused: % contains records', table_name;
      END IF;
    END IF;
  END LOOP;
  DROP TRIGGER IF EXISTS b1_finalize_signup_legal ON public."user";
  DROP FUNCTION IF EXISTS public.b1_finalize_signup_legal();
  FOREACH table_name IN ARRAY ARRAY[
    'b1_legal_signup_reservations', 'b1_legal_signup_choices',
    'b1_legal_acceptances', 'b1_legal_purchases', 'b1_legal_active', 'b1_legal_documents'
  ] LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I', table_name);
  END LOOP;
  DROP FUNCTION IF EXISTS public.b1_legal_document_immutable();
  DROP FUNCTION IF EXISTS public.b1_legal_evidence_immutable();
END $$;
