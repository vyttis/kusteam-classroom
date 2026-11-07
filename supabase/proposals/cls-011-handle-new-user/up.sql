-- CLS-011 proposal, not a migration yet: nothing in supabase/proposals is
-- applied by the Supabase CLI or to production. After Vytis approves it, it
-- becomes supabase/migrations/<timestamp>_handle_new_user_without_email_role.sql
-- with down.sql as its rollback (docs/migration-history.md, CLS-011).
--
-- Production's handle_new_user() was edited by hand: a new auth user with one
-- personal email address gets role 'super_admin' on sign-up. Roles are
-- granted in the admin panel instead (PATCH /api/admin/users, super_admin
-- only, written to admin_audit_log), so the trigger stops setting a role and
-- every new profile starts as 'teacher' (column default) and 'pending'.
-- The 'name' fallback that production added for Google sign-ins stays.
BEGIN;

-- Keep the exact current definition (whatever it is) so down.sql can put it
-- back without the email address being written into this public repository.
-- Fails if a backup already exists, so a second run never overwrites it.
CREATE SCHEMA IF NOT EXISTS backup_cls011;
REVOKE ALL ON SCHEMA backup_cls011 FROM PUBLIC;
CREATE TABLE backup_cls011.handle_new_user AS
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) AS def, now() AS saved_at;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

COMMIT;
