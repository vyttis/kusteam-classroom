-- TEAM-001 rollback: removes the TEAM tables and the profile guard. Every
-- TEAM member row, activity grant and pending link is lost; the auth users
-- TEAM created stay in auth.users (delete them in the Supabase dashboard if
-- needed: Authentication > Users, filter by user_metadata kusteam_app).
-- CLASSROOM profiles are not touched.
BEGIN;

DROP TRIGGER IF EXISTS skip_profile_for_team_users ON public.profiles;
DROP FUNCTION IF EXISTS public.skip_profile_for_team_users();
DROP FUNCTION IF EXISTS public.team_issue_token(uuid, text, text, timestamptz, integer, interval);
DROP TABLE IF EXISTS public.team_tokens;
DROP TABLE IF EXISTS public.team_activity_grants;
DROP TABLE IF EXISTS public.team_members;
DROP FUNCTION IF EXISTS public.team_touch_updated_at();

COMMIT;
