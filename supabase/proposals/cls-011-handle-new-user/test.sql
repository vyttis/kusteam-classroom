-- CLS-011 proposal test: what a new sign-up gets from public.handle_new_user()
-- after up.sql. Runs on the test
-- database (supabase/tests/bootstrap.sql provides auth.users). Everything
-- happens in one transaction that is rolled back.
--
-- Expected (CLS-011): every new profile starts as 'teacher' and 'pending',
-- whatever the email address; admin rights come only from the admin panel.
BEGIN;

DO $$
DECLARE
  fn record;
  p record;
BEGIN
  SELECT prosecdef, proconfig, prosrc INTO fn
  FROM pg_proc WHERE oid = 'public.handle_new_user()'::regprocedure;
  IF NOT fn.prosecdef THEN
    RAISE EXCEPTION 'handle_new_user must stay SECURITY DEFINER';
  END IF;
  IF NOT coalesce(fn.proconfig, '{}') @> ARRAY['search_path=public, extensions, pg_temp'] THEN
    RAISE EXCEPTION 'handle_new_user lost its pinned search_path: %', fn.proconfig;
  END IF;
  IF fn.prosrc ~ '@' OR fn.prosrc ~* 'super_admin|''admin''' THEN
    RAISE EXCEPTION 'handle_new_user must not grant roles by email address';
  END IF;

  -- An owner-like address and Google metadata ("name" only).
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    ('00000000-0000-4000-8000-000000000011', 'owner@example.invalid', '{"name": "Owner Example"}');
  SELECT role, status, full_name INTO p FROM public.profiles
  WHERE id = '00000000-0000-4000-8000-000000000011';
  IF p.role IS DISTINCT FROM 'teacher' OR p.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'new profile must be teacher/pending, got %/%', p.role, p.status;
  END IF;
  IF p.full_name IS DISTINCT FROM 'Owner Example' THEN
    RAISE EXCEPTION 'full_name must fall back to name, got %', p.full_name;
  END IF;

  -- full_name wins over name; no names at all gives an empty string.
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    ('00000000-0000-4000-8000-000000000012', 'a@example.invalid', '{"full_name": "Full Name", "name": "Short"}'),
    ('00000000-0000-4000-8000-000000000013', 'b@example.invalid', '{}');
  IF (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-4000-8000-000000000012') <> 'Full Name' THEN
    RAISE EXCEPTION 'full_name must take precedence over name';
  END IF;
  IF (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-4000-8000-000000000013') <> '' THEN
    RAISE EXCEPTION 'full_name must default to an empty string';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id::text LIKE '00000000-0000-4000-8000-0000000000%' AND role <> 'teacher') THEN
    RAISE EXCEPTION 'no new profile may start with an admin role';
  END IF;
END
$$;

ROLLBACK;
