-- TEAM-001 rollback check for production, changes nothing: runs the DROP
-- statements of down.sql (the same lines, checked by scripts/test-db.sh)
-- inside one block, counts what is left and then raises an error on purpose,
-- so Postgres undoes everything. The expected result is the error
--   TEAM-001 rollback dry run OK: 0 TEAM relations, 0 TEAM functions, profile guard false
-- Any other error means down.sql would not run as it is: do not rely on it.
-- Takes a short lock on public.profiles: run it when no activity is going on.
DO $dry$
DECLARE
  relations int;
  functions int;
  guard boolean;
BEGIN
DROP TRIGGER IF EXISTS skip_profile_for_team_users ON public.profiles;
DROP FUNCTION IF EXISTS public.skip_profile_for_team_users();
DROP FUNCTION IF EXISTS public.team_issue_token(uuid, text, text, timestamptz, integer, interval);
DROP TABLE IF EXISTS public.team_tokens;
DROP TABLE IF EXISTS public.team_activity_grants;
DROP TABLE IF EXISTS public.team_members;
DROP FUNCTION IF EXISTS public.team_touch_updated_at();

  SELECT count(*) INTO relations FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relname LIKE 'team\_%';
  SELECT count(*) INTO functions FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname IN ('team_issue_token', 'team_touch_updated_at', 'skip_profile_for_team_users');
  SELECT exists(SELECT 1 FROM pg_trigger WHERE tgname = 'skip_profile_for_team_users') INTO guard;
  RAISE EXCEPTION 'TEAM-001 rollback dry run %: % TEAM relations, % TEAM functions, profile guard %',
    CASE WHEN relations = 0 AND functions = 0 AND NOT guard THEN 'OK' ELSE 'FAILED' END,
    relations, functions, guard::text;
END
$dry$;
