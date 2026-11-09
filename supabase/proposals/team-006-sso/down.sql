-- TEAM-006 rollback: removes the TEAM sign-in for activities.
--
-- The CLASSROOM Supabase sessions opened through the TEAM sign-in are
-- deleted first, so no former staff session keeps working through the Data
-- API after the staff rule is gone.
--
-- Every SSO code and activity session is deleted. CLASSROOM 'staff' profiles
-- become blocked 'teacher' profiles: their activities are kept, nobody can
-- use them until an admin decides (delete or reassign in the admin panel).
-- Teachers, admins, participants and the TEAM-001 tables are not touched,
-- except that skip_profile_for_team_users() gets its TEAM-001 definition back.
BEGIN;
-- If a table lock cannot be taken within 5 s, the whole rollback stops and
-- is undone (error 55P03), so requests wait on it at most that long
-- (docs/migration-history.md, TEAM-006).
SET LOCAL lock_timeout = '5s';

DELETE FROM auth.sessions a
WHERE a.id IN (SELECT s.client_session_id FROM public.team_sso_sessions s WHERE s.client_session_id IS NOT NULL)
   OR a.user_id IN (SELECT p.id FROM public.profiles p WHERE p.role = 'staff');

CREATE OR REPLACE FUNCTION public.is_active_account()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
$$;

CREATE OR REPLACE FUNCTION public.can_read_game(game_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
    OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_uuid AND g.teacher_id = auth.uid())
    OR coalesce(public.get_my_role(), '') IN ('admin', 'super_admin')
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'access_requests', 'achievements', 'admin_audit_log', 'ai_usage', 'announcements',
    'challenges', 'games', 'hint_reveals', 'lesson_plans', 'library_items',
    'platform_settings', 'reflections', 'request_links', 'submissions', 'teams', 'templates'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "TEAM staff only through an active TEAM sign-in" ON public.%I', t);
    END IF;
  END LOOP;
END $$;
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "TEAM staff only through an active TEAM sign-in" ON storage.objects;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.team_staff_access_ok();

DROP TRIGGER IF EXISTS protect_staff_role ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_staff_role();
UPDATE public.profiles SET role = 'teacher', status = 'blocked' WHERE role = 'staff';
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('teacher', 'admin', 'super_admin'));

CREATE OR REPLACE FUNCTION public.skip_profile_for_team_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = NEW.id AND u.raw_user_meta_data ->> 'kusteam_app' = 'team'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_sso_revoke_on_grant_removal ON public.team_activity_grants;
DROP TRIGGER IF EXISTS team_sso_revoke_on_block ON public.team_members;
DROP FUNCTION IF EXISTS public.team_sso_revoke_on_change();
DROP FUNCTION IF EXISTS public.team_sso_revoke_handle(text, text);
DROP FUNCTION IF EXISTS public.team_register_session(uuid, uuid);
DROP FUNCTION IF EXISTS public.team_sso_revoke(uuid, text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.team_sso_link_client_session(uuid, uuid);
DROP FUNCTION IF EXISTS public.team_sso_session_status(text, uuid, text);
DROP FUNCTION IF EXISTS public.team_sso_redeem_code(text, text, text, text, interval);
DROP FUNCTION IF EXISTS public.team_sso_issue_code(uuid, text, uuid, text, text, interval, integer);
DROP FUNCTION IF EXISTS public.team_sso_access(uuid, text, uuid);
DROP TABLE IF EXISTS public.team_sso_codes;
DROP TABLE IF EXISTS public.team_sso_sessions;
DROP TABLE IF EXISTS public.team_sessions;

COMMIT;
