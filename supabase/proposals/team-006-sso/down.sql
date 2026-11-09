-- TEAM-006 rollback: removes the TEAM sign-in for activities.
--
-- Every SSO code and activity session is deleted. CLASSROOM 'staff' profiles
-- become blocked 'teacher' profiles: their activities are kept, nobody can
-- use them until an admin decides (delete or reassign in the admin panel).
-- Teachers, admins, participants and the TEAM-001 tables are not touched,
-- except that skip_profile_for_team_users() gets its TEAM-001 definition back.
BEGIN;

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

DROP FUNCTION IF EXISTS public.team_sso_revoke(uuid, text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.team_sso_link_client_session(uuid, uuid);
DROP FUNCTION IF EXISTS public.team_sso_session_status(text, uuid, text);
DROP FUNCTION IF EXISTS public.team_sso_redeem_code(text, text, text, text, interval);
DROP FUNCTION IF EXISTS public.team_sso_issue_code(uuid, text, uuid, text, text, interval, integer);
DROP FUNCTION IF EXISTS public.team_sso_access(uuid, text, uuid);
DROP TABLE IF EXISTS public.team_sso_codes;
DROP TABLE IF EXISTS public.team_sso_sessions;

COMMIT;
