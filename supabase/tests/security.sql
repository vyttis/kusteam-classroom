-- Security checks for answers, roles, library moderation and stats.
-- Runs after bootstrap.sql and every migration (scripts/test-db.sh).
\set ON_ERROR_STOP on

-- Helpers: a query must fail with insufficient_privilege (42501), or succeed.
CREATE FUNCTION public.t_denied(q text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE q;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN;
  END;
  RAISE EXCEPTION 'expected permission denied, query ran: %', q;
END $$;
CREATE FUNCTION public.t_ok(q text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE q;
END $$;
CREATE FUNCTION public.t_rows(q text, expected int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  EXECUTE format('SELECT count(*) FROM (%s) x', q) INTO n;
  IF n <> expected THEN
    RAISE EXCEPTION 'expected % rows, got %: %', expected, n, q;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.t_denied(text), public.t_ok(text), public.t_rows(text, int)
  TO anon, authenticated, service_role;

-- Two teachers, one active activity each, one admin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'a@example.lt'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.lt'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.lt'),
  ('00000000-0000-0000-0000-0000000000ee', 'pending@example.lt');
UPDATE public.profiles SET role = 'super_admin' WHERE id = '00000000-0000-0000-0000-0000000000ad';
-- Approved accounts; ...ee stays as it was created (waiting for approval).
UPDATE public.profiles SET status = 'active'
  WHERE id IN ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000ad');

INSERT INTO public.games (id, teacher_id, title, game_code, status) VALUES
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A', 'AAAAAA', 'active'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B', 'BBBBBB', 'active');
INSERT INTO public.challenges (id, game_id, title, answer_hash, explanation) VALUES
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'A1', '$2a$10$hashA', 'A sprendimas'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'B1', '$2a$10$hashB', 'B sprendimas');
INSERT INTO public.teams (id, game_id, name, session_token) VALUES
  ('30000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'Komanda', 'token-b');
INSERT INTO public.submissions (team_id, challenge_id, answer, is_correct, points_awarded) VALUES
  ('30000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'teisingas', true, 100);
INSERT INTO public.achievements (game_id, team_id, type, challenge_id) VALUES
  ('10000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-00000000000b', 'first_solver', '20000000-0000-0000-0000-00000000000b');
INSERT INTO public.announcements (game_id, message, created_by) VALUES
  ('10000000-0000-0000-0000-00000000000b', 'Liko 5 minutės', '00000000-0000-0000-0000-00000000000b');

-- Signed in as teacher A, looking at teacher B's activity.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

SELECT public.t_denied('SELECT answer_hash FROM public.challenges');
SELECT public.t_denied('SELECT * FROM public.challenges');
SELECT public.t_denied('SELECT answer FROM public.submissions');
SELECT public.t_denied('SELECT * FROM public.submissions');
-- What pages and the live view still read keeps working.
SELECT public.t_ok('SELECT id, title, hints, options, needs_answer, explanation, verification_issues FROM public.challenges');
-- Extra accepted answers stay hidden; the facilitator sees how many (20261107100000).
SELECT public.t_denied('SELECT accepted_answer_hashes FROM public.challenges');
SELECT public.t_ok('SELECT id, accepted_answer_count FROM public.challenges');
-- Only own tasks: explanations of other activities stay hidden.
SELECT public.t_rows('SELECT id FROM public.challenges', 1);
SELECT public.t_rows($q$SELECT explanation FROM public.challenges WHERE game_id = '10000000-0000-0000-0000-00000000000b'$q$, 0);
SELECT public.t_ok('SELECT count(*) FROM public.challenges');
SELECT public.t_ok('SELECT id, team_id, challenge_id, is_correct, points_awarded, attempted_at FROM public.submissions');
SELECT public.t_ok('SELECT g.id, (SELECT count(*) FROM public.challenges c WHERE c.game_id = g.id) FROM public.games g');
-- Another facilitator's running activity cannot be listed or reached by
-- its teams, results, announcements or achievements (20261107120000).
SELECT public.t_rows('SELECT id FROM public.games', 1);
SELECT public.t_rows($q$SELECT id FROM public.games WHERE game_code = 'BBBBBB'$q$, 0);
SELECT public.t_rows('SELECT id FROM public.teams', 0);
SELECT public.t_rows('SELECT id FROM public.submissions', 0);
SELECT public.t_rows('SELECT id FROM public.announcements', 0);
SELECT public.t_rows('SELECT id FROM public.achievements', 0);
-- The participant state function is for the server only (20261106170000).
SELECT public.t_denied($q$SELECT public.get_player_game_state('AAAAAA', 'x')$q$);

-- Own profile: contact details yes, role no.
SELECT public.t_ok($q$UPDATE public.profiles SET full_name = 'Vardenis', school = 'Mokykla', phone = NULL, onboarding_completed = true WHERE id = auth.uid()$q$);
SELECT public.t_denied($q$UPDATE public.profiles SET role = 'super_admin' WHERE id = auth.uid()$q$);
SELECT public.t_denied($q$UPDATE public.profiles SET email = 'x@example.lt' WHERE id = auth.uid()$q$);
SELECT public.t_denied($q$INSERT INTO public.profiles (id, email, role) VALUES (gen_random_uuid(), 'x@example.lt', 'super_admin')$q$);

-- Own statistics fields yes; status, DI limit, approval no.
SELECT public.t_ok($q$UPDATE public.profiles SET first_name = 'Vardenis', last_name = 'Pavardenis', school_code = '190000000', municipality = 'Klaipėdos m.', subjects = '{Matematika}', grades = '{5-8}', consent_at = now() WHERE id = auth.uid()$q$);
SELECT public.t_denied($q$UPDATE public.profiles SET status = 'active' WHERE id = auth.uid()$q$);
SELECT public.t_denied($q$UPDATE public.profiles SET ai_monthly_limit = 100000 WHERE id = auth.uid()$q$);
SELECT public.t_denied($q$UPDATE public.profiles SET approved_at = now() WHERE id = auth.uid()$q$);
-- Server-only tables.
SELECT public.t_denied('SELECT * FROM public.access_requests');
SELECT public.t_denied($q$INSERT INTO public.access_requests (email, first_name, last_name, school_name, source) VALUES ('x@example.lt', 'A', 'B', 'Mokykla', 'qr')$q$);
SELECT public.t_denied('SELECT * FROM public.admin_audit_log');
SELECT public.t_denied('SELECT * FROM public.request_links');
SELECT public.t_denied('SELECT * FROM public.ai_usage');
SELECT public.t_denied('SELECT * FROM public.platform_settings');
-- KU STEAM TEAM tables (20261109111400): only the TEAM server writes them,
-- invitation and reset links are not readable by any client role.
SELECT public.t_denied('SELECT * FROM public.team_tokens');
SELECT public.t_denied($q$INSERT INTO public.team_members (user_id, email, role, status) VALUES (auth.uid(), 'a@example.lt', 'superadmin', 'active')$q$);
SELECT public.t_denied($q$INSERT INTO public.team_activity_grants (user_id, activity) VALUES (auth.uid(), 'classroom')$q$);

-- Library: only new items in review.
SELECT public.t_ok($q$INSERT INTO public.library_items (title, published_by, status) VALUES ('Šablonas', auth.uid(), 'pending_review')$q$);
SELECT public.t_denied($q$INSERT INTO public.library_items (title, published_by, status) VALUES ('Šablonas', auth.uid(), 'approved')$q$);
SELECT public.t_denied($q$INSERT INTO public.library_items (title, published_by, status, reviewed_by) VALUES ('Šablonas', auth.uid(), 'pending_review', auth.uid())$q$);

-- Stats and reflections: own activity yes, someone else's no.
SELECT public.t_ok($q$SELECT public.get_game_stats('10000000-0000-0000-0000-00000000000a')$q$);
SELECT public.t_ok($q$SELECT public.get_game_reflections('10000000-0000-0000-0000-00000000000a')$q$);
SELECT public.t_denied($q$SELECT public.get_game_stats('10000000-0000-0000-0000-00000000000b')$q$);
SELECT public.t_denied($q$SELECT public.get_game_reflections('10000000-0000-0000-0000-00000000000b')$q$);
SELECT public.t_denied($q$SELECT public.get_platform_stats()$q$);
SELECT public.t_denied($q$SELECT public.get_game_stats_unchecked('10000000-0000-0000-0000-00000000000b')$q$);
RESET ROLE;

-- Admin: platform stats and any activity.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
SELECT public.t_ok($q$SELECT public.get_platform_stats()$q$);
SELECT public.t_ok($q$SELECT public.get_game_stats('10000000-0000-0000-0000-00000000000b')$q$);
SELECT public.t_rows('SELECT id FROM public.challenges', 2);
SELECT public.t_denied('SELECT answer_hash FROM public.challenges');
-- Admins keep every activity's teams, results, announcements, achievements.
SELECT public.t_rows('SELECT id FROM public.games', 2);
SELECT public.t_rows('SELECT id FROM public.teams', 1);
SELECT public.t_rows('SELECT id FROM public.submissions', 1);
SELECT public.t_rows('SELECT id FROM public.announcements', 1);
SELECT public.t_rows('SELECT id FROM public.achievements', 1);
SELECT public.t_denied('SELECT answer FROM public.submissions');
RESET ROLE;

-- The facilitator keeps their own activity's teams, results, announcements
-- and achievements (live view and its realtime use these policies).
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
SELECT public.t_rows('SELECT id FROM public.games', 1);
SELECT public.t_rows('SELECT id FROM public.teams', 1);
SELECT public.t_rows('SELECT id FROM public.submissions', 1);
SELECT public.t_rows('SELECT id FROM public.announcements', 1);
SELECT public.t_rows('SELECT id FROM public.achievements', 1);
SELECT public.t_denied('SELECT session_token FROM public.teams');
RESET ROLE;

-- Anonymous participant.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT public.t_denied('SELECT answer_hash FROM public.challenges');
SELECT public.t_denied('SELECT answer FROM public.submissions');
-- No listing of running activities or anything that leads to their code
-- (20261107120000): participants read through the server with the code.
SELECT public.t_denied('SELECT game_code, title FROM public.games');
SELECT public.t_denied('SELECT id FROM public.games');
SELECT public.t_denied('SELECT id, title, options FROM public.challenges');
SELECT public.t_denied('SELECT id, game_id, name, total_points FROM public.teams');
SELECT public.t_denied('SELECT id, team_id, is_correct FROM public.submissions');
SELECT public.t_denied('SELECT id, game_id, message FROM public.announcements');
SELECT public.t_denied('SELECT id, game_id, team_id FROM public.achievements');
-- Hints and DI notes reach participants only through the server (20261106170000).
SELECT public.t_denied('SELECT hints FROM public.challenges');
SELECT public.t_denied('SELECT accepted_answer_hashes FROM public.challenges');
SELECT public.t_denied('SELECT accepted_answer_count FROM public.challenges');
SELECT public.t_denied('SELECT verification_issues FROM public.challenges');
SELECT public.t_denied('SELECT verification_verdict FROM public.challenges');
SELECT public.t_denied($q$SELECT public.get_player_game_state('AAAAAA', 'x')$q$);
SELECT public.t_denied('SELECT explanation FROM public.challenges');
SELECT public.t_denied($q$SELECT public.get_game_stats('10000000-0000-0000-0000-00000000000b')$q$);
SELECT public.t_denied($q$SELECT public.get_game_reflections('10000000-0000-0000-0000-00000000000b')$q$);
SELECT public.t_denied($q$SELECT public.get_platform_stats()$q$);
SELECT public.t_denied($q$UPDATE public.profiles SET role = 'super_admin'$q$);
SELECT public.t_denied('SELECT * FROM public.access_requests');
SELECT public.t_denied('SELECT * FROM public.ai_usage');
SELECT public.t_denied('SELECT * FROM public.team_members');
SELECT public.t_denied('SELECT * FROM public.team_activity_grants');
SELECT public.t_denied('SELECT * FROM public.team_tokens');
RESET ROLE;

-- New accounts wait for approval; the service role activates them.
DO $$
BEGIN
  IF (SELECT status FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000ee') <> 'pending' THEN
    RAISE EXCEPTION 'a new profile must start as pending';
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public) VALUES ('challenge-images', 'challenge-images', true)
  ON CONFLICT DO NOTHING;

-- A pending account cannot write facilitator data through the REST API;
-- an active one can.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ee', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT public.t_denied($q$INSERT INTO public.games (teacher_id, title, game_code) VALUES (auth.uid(), 'Laukia', 'PPPPPP')$q$);
SELECT public.t_denied($q$INSERT INTO public.library_items (title, published_by, status) VALUES ('Šablonas', auth.uid(), 'pending_review')$q$);
SELECT public.t_denied($q$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('challenge-images', '00000000-0000-0000-0000-0000000000ee/x.png', auth.uid())$q$);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
SELECT public.t_ok($q$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('challenge-images', '00000000-0000-0000-0000-00000000000a/x.png', auth.uid())$q$);
SELECT public.t_ok($q$INSERT INTO public.games (teacher_id, title, game_code) VALUES (auth.uid(), 'Aktyvus', 'QQQQQQ')$q$);
SELECT public.t_ok($q$UPDATE public.games SET title = 'A2' WHERE id = '10000000-0000-0000-0000-00000000000a'$q$);
RESET ROLE;
-- Blocking an account stops its writes at once.
UPDATE public.profiles SET status = 'blocked' WHERE id = '00000000-0000-0000-0000-00000000000a';
SET ROLE authenticated;
SELECT public.t_denied($q$INSERT INTO public.games (teacher_id, title, game_code) VALUES (auth.uid(), 'Blokuotas', 'RRRRRR')$q$);
UPDATE public.games SET title = 'pakeista' WHERE id = '10000000-0000-0000-0000-00000000000a';
RESET ROLE;
DO $$
BEGIN
  IF (SELECT title FROM public.games WHERE id = '10000000-0000-0000-0000-00000000000a') <> 'A2' THEN
    RAISE EXCEPTION 'a blocked account must not update its activities';
  END IF;
END $$;
UPDATE public.profiles SET status = 'active' WHERE id = '00000000-0000-0000-0000-00000000000a';

-- A blocked admin keeps a session but loses admin powers and profile edits.
UPDATE public.profiles SET status = 'blocked' WHERE id = '00000000-0000-0000-0000-0000000000ad';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
SELECT public.t_denied($q$SELECT public.get_platform_stats()$q$);
SELECT public.t_denied($q$SELECT public.get_game_stats('10000000-0000-0000-0000-00000000000b')$q$);
SELECT public.t_rows('SELECT id FROM public.profiles', 1);
UPDATE public.profiles SET full_name = 'Pakeista' WHERE id = auth.uid();
RESET ROLE;
DO $$
BEGIN
  IF (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000ad') IS NOT DISTINCT FROM 'Pakeista' THEN
    RAISE EXCEPTION 'a blocked account must not update its profile';
  END IF;
END $$;
UPDATE public.profiles SET status = 'active' WHERE id = '00000000-0000-0000-0000-0000000000ad';
SET ROLE authenticated;
SELECT public.t_ok($q$SELECT public.get_platform_stats()$q$);
RESET ROLE;

-- finished_at follows the status and cannot be moved by hand.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
UPDATE public.games SET status = 'finished' WHERE id = '10000000-0000-0000-0000-00000000000a';
UPDATE public.games SET finished_at = now() + interval '30 days', title = 'A3' WHERE id = '10000000-0000-0000-0000-00000000000a';
RESET ROLE;
DO $$
DECLARE f timestamptz;
BEGIN
  SELECT finished_at INTO f FROM public.games WHERE id = '10000000-0000-0000-0000-00000000000a';
  IF f IS NULL OR f > now() + interval '1 minute' THEN
    RAISE EXCEPTION 'finished_at must be set by the trigger, got %', f;
  END IF;
  -- A finished activity stays finished (20261106150000), for every writer.
  BEGIN
    UPDATE public.games SET status = 'active' WHERE id = '10000000-0000-0000-0000-00000000000a';
    RAISE EXCEPTION 'a finished activity must not be reopened';
  EXCEPTION WHEN SQLSTATE 'KS409' THEN
    NULL;
  END;
END $$;

-- A request link stops at its limit.
DO $$
DECLARE link uuid;
BEGIN
  INSERT INTO public.request_links (token, label, max_uses) VALUES ('test-token-aaaaaaaaaaaaaa', 'Seminaras', 1) RETURNING id INTO link;
  INSERT INTO public.access_requests (email, first_name, last_name, school_name, source, source_link_id)
    VALUES ('l1@example.lt', 'A', 'B', 'Mokykla', 'link', link);
  BEGIN
    INSERT INTO public.access_requests (email, first_name, last_name, school_name, source, source_link_id)
      VALUES ('l2@example.lt', 'A', 'B', 'Mokykla', 'link', link);
    RAISE EXCEPTION 'a second request over the limit must fail';
  EXCEPTION WHEN SQLSTATE 'KS410' THEN
    NULL;
  END;
  UPDATE public.request_links SET max_uses = NULL, revoked_at = now() WHERE id = link;
  BEGIN
    INSERT INTO public.access_requests (email, first_name, last_name, school_name, source, source_link_id)
      VALUES ('l3@example.lt', 'A', 'B', 'Mokykla', 'link', link);
    RAISE EXCEPTION 'a revoked link must not take requests';
  EXCEPTION WHEN SQLSTATE 'KS410' THEN
    NULL;
  END;
END $$;

-- Service role (server API): everything it uses today.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.t_ok('SELECT answer_hash FROM public.challenges');
SELECT public.t_ok('SELECT answer FROM public.submissions');
SELECT public.t_ok($q$SELECT public.get_game_stats('10000000-0000-0000-0000-00000000000b')$q$);
SELECT public.t_ok($q$UPDATE public.profiles SET role = 'teacher', status = 'active' WHERE id = '00000000-0000-0000-0000-00000000000a'$q$);
SELECT public.t_ok($q$INSERT INTO public.access_requests (email, first_name, last_name, school_name, source) VALUES ('x@example.lt', 'A', 'B', 'Mokykla', 'qr')$q$);
SELECT public.t_ok($q$INSERT INTO public.ai_usage (user_id, request_id, endpoint, model, input_tokens, output_tokens, cost_usd) VALUES ('00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 'di/generate', 'claude', 1000, 500, 0.01)$q$);
SELECT public.t_rows('SELECT * FROM public.platform_settings', 1);
SELECT public.t_ok('SELECT * FROM public.team_members');
SELECT public.t_ok('SELECT * FROM public.team_tokens');
RESET ROLE;


-- DI reservations and budget alert claims (20261106145000).
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT public.t_denied($q$SELECT public.reserve_ai_action('00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 'di/generate', 99, 900)$q$);
RESET ROLE;

SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$
DECLARE
  u constant uuid := '00000000-0000-0000-0000-00000000000b';
  last_month_req constant uuid := gen_random_uuid();
  r1 integer;
  r2 integer;
  r3 integer;
BEGIN
  -- A reservation that never got a model call and is past the window: free.
  INSERT INTO public.ai_usage (user_id, request_id, endpoint, model, created_at)
    VALUES (u, gen_random_uuid(), 'di/generate', 'reservation', now() - interval '20 minutes');
  -- A finished action from just before this month began: not counted.
  INSERT INTO public.ai_usage (user_id, request_id, endpoint, model, created_at)
    VALUES (u, last_month_req, 'di/generate', 'reservation', date_trunc('month', now(), 'UTC') - interval '1 second'),
           (u, last_month_req, 'di/generate', 'claude-test', date_trunc('month', now(), 'UTC') - interval '1 second');
  r1 := public.reserve_ai_action(u, gen_random_uuid(), 'di/generate', 2, 900);
  r2 := public.reserve_ai_action(u, gen_random_uuid(), 'di/generate', 2, 900);
  r3 := public.reserve_ai_action(u, gen_random_uuid(), 'di/generate', 2, 900);
  IF r1 <> 0 OR r2 <> 1 OR r3 <> -1 THEN
    RAISE EXCEPTION 'reservations at limit 2 must give 0, 1, -1; got %, %, %', r1, r2, r3;
  END IF;
  IF (SELECT count(*) FROM public.ai_usage WHERE user_id = u AND model = 'reservation') <> 4 THEN
    RAISE EXCEPTION 'a refused reservation must not leave a row';
  END IF;

  INSERT INTO public.admin_audit_log (action, target_type, target_id) VALUES ('ai_budget.alert', 'platform', '2026-11:alert');
  BEGIN
    INSERT INTO public.admin_audit_log (action, target_type, target_id) VALUES ('ai_budget.alert', 'platform', '2026-11:alert');
    RAISE EXCEPTION 'a second claim for the same alert must fail';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  -- Other actions may repeat a target.
  INSERT INTO public.admin_audit_log (action, target_type, target_id) VALUES ('profile.block', 'profile', 'x');
  INSERT INTO public.admin_audit_log (action, target_type, target_id) VALUES ('profile.block', 'profile', 'x');
END $$;
RESET ROLE;

-- Pause clock, status rules and time extensions (20261106150000).
INSERT INTO public.games (id, teacher_id, title, game_code, status, settings) VALUES
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'Laikas', 'CLOCK1', 'draft', '{"time_limit_minutes": 30}'),
  ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000a', 'Be laiko', 'CLOCK2', 'active', '{}');

-- An activity without tasks does not start.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
DO $$
BEGIN
  PERFORM public.set_game_status('10000000-0000-0000-0000-0000000000c1', 'active');
  RAISE EXCEPTION 'an activity without tasks must not start';
EXCEPTION WHEN SQLSTATE 'KS427' THEN
  NULL;
END $$;
RESET ROLE;
INSERT INTO public.challenges (id, game_id, title, answer_hash) VALUES
  ('20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1', 'Laiko užduotis', '$2a$10$real');

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.t_denied($q$SELECT public.set_game_status('10000000-0000-0000-0000-0000000000c1', 'active')$q$);
SELECT public.t_denied($q$SELECT public.extend_game_time('10000000-0000-0000-0000-0000000000c1', 5)$q$);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
DO $$
BEGIN
  PERFORM public.set_game_status('10000000-0000-0000-0000-0000000000c1', 'active');
  RAISE EXCEPTION 'another teacher must not change this activity';
EXCEPTION WHEN SQLSTATE 'P0002' THEN
  NULL;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
DO $$
DECLARE g public.games;
BEGIN
  g := public.set_game_status('10000000-0000-0000-0000-0000000000c1', 'active');
  IF g.status <> 'active' OR g.starts_at IS NULL THEN
    RAISE EXCEPTION 'starting must set the status and starts_at, got % %', g.status, g.starts_at;
  END IF;
  g := public.set_game_status('10000000-0000-0000-0000-0000000000c1', 'paused');
  IF g.paused_at IS NULL OR g.paused_ms <> 0 THEN
    RAISE EXCEPTION 'pausing must mark paused_at, got % %', g.paused_at, g.paused_ms;
  END IF;
  -- The same status again changes nothing.
  g := public.set_game_status('10000000-0000-0000-0000-0000000000c1', 'paused');
  IF g.paused_at IS NULL THEN
    RAISE EXCEPTION 'a repeated pause must keep the pause running';
  END IF;
END $$;
RESET ROLE;

-- Two minutes of pause pass (the trigger keeps the clock, so step around it).
ALTER TABLE public.games DISABLE TRIGGER games_status_rules;
UPDATE public.games SET paused_at = now() - interval '2 minutes' WHERE id = '10000000-0000-0000-0000-0000000000c1';
ALTER TABLE public.games ENABLE TRIGGER games_status_rules;

SET ROLE authenticated;
DO $$
DECLARE g public.games;
BEGIN
  g := public.set_game_status('10000000-0000-0000-0000-0000000000c1', 'active');
  IF g.paused_at IS NOT NULL OR g.paused_ms NOT BETWEEN 119000 AND 125000 THEN
    RAISE EXCEPTION 'resuming must add the pause to paused_ms, got % %', g.paused_at, g.paused_ms;
  END IF;
  IF g.resumed_at IS NULL OR g.resumed_at < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'resuming must record resumed_at, got %', g.resumed_at;
  END IF;

  -- A client creates drafts only, so a paused activity cannot appear
  -- without a running pause clock.
  BEGIN
    INSERT INTO public.games (teacher_id, title, game_code, status)
      VALUES (auth.uid(), 'Iš karto pristabdyta', 'PAUSE1', 'paused');
    RAISE EXCEPTION 'a client must not insert a paused activity';
  EXCEPTION WHEN SQLSTATE 'KS409' THEN
    NULL;
  END;

  -- A client cannot set the clock fields directly.
  UPDATE public.games SET paused_ms = 0, paused_at = now() WHERE id = '10000000-0000-0000-0000-0000000000c1';
  IF (SELECT paused_ms FROM public.games WHERE id = '10000000-0000-0000-0000-0000000000c1') < 119000
     OR (SELECT paused_at FROM public.games WHERE id = '10000000-0000-0000-0000-0000000000c1') IS NOT NULL THEN
    RAISE EXCEPTION 'paused_ms and paused_at must ignore direct writes';
  END IF;

  -- A settings save while running keeps the limit and merges the rest.
  g := public.update_game_settings('10000000-0000-0000-0000-0000000000c1', '{"time_limit_minutes": 1, "show_leaderboard": false}');
  IF (g.settings ->> 'time_limit_minutes')::numeric <> 30 OR (g.settings ->> 'show_leaderboard')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'a running settings save must keep the limit and merge the rest, got %', g.settings;
  END IF;
  -- The title and description of the same save go in the same statement.
  g := public.update_game_settings('10000000-0000-0000-0000-0000000000c1', '{"show_leaderboard": true}',
    '{"title": "Pervadinta", "description": null}');
  IF g.title <> 'Pervadinta' OR g.description IS NOT NULL OR (g.settings ->> 'show_leaderboard')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'details must be saved with the settings, got % % %', g.title, g.description, g.settings;
  END IF;

  g := public.extend_game_time('10000000-0000-0000-0000-0000000000c1', 5);
  g := public.extend_game_time('10000000-0000-0000-0000-0000000000c1', 5);
  IF (g.settings ->> 'time_limit_minutes')::numeric <> 40 THEN
    RAISE EXCEPTION 'two extensions of 5 must give 40, got %', g.settings ->> 'time_limit_minutes';
  END IF;
  -- A direct write of the whole settings (an older client, the REST API)
  -- keeps the running limit, and cannot remove it either.
  UPDATE public.games SET settings = '{"time_limit_minutes": 5, "show_leaderboard": false}'
    WHERE id = '10000000-0000-0000-0000-0000000000c1';
  SELECT * INTO g FROM public.games WHERE id = '10000000-0000-0000-0000-0000000000c1';
  IF (g.settings ->> 'time_limit_minutes')::numeric <> 40 OR (g.settings ->> 'show_leaderboard')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'a direct settings write must keep the running limit, got %', g.settings;
  END IF;
  UPDATE public.games SET settings = '{"show_leaderboard": true}' WHERE id = '10000000-0000-0000-0000-0000000000c1';
  SELECT * INTO g FROM public.games WHERE id = '10000000-0000-0000-0000-0000000000c1';
  IF (g.settings ->> 'time_limit_minutes')::numeric <> 40 THEN
    RAISE EXCEPTION 'a direct settings write must not remove the running limit, got %', g.settings;
  END IF;
  -- An activity without a limit does not get one that way either.
  UPDATE public.games SET settings = '{"time_limit_minutes": 5}' WHERE id = '10000000-0000-0000-0000-0000000000c2';
  IF (SELECT settings ? 'time_limit_minutes' FROM public.games WHERE id = '10000000-0000-0000-0000-0000000000c2') THEN
    RAISE EXCEPTION 'a running activity without a limit must not get one by a direct write';
  END IF;

  BEGIN
    PERFORM public.extend_game_time('10000000-0000-0000-0000-0000000000c2', 5);
    RAISE EXCEPTION 'an activity without a limit must not get one by extending';
  EXCEPTION WHEN SQLSTATE 'KS422' THEN
    NULL;
  END;

  g := public.set_game_status('10000000-0000-0000-0000-0000000000c1', 'finished');
  IF g.status <> 'finished' OR g.finished_at IS NULL THEN
    RAISE EXCEPTION 'finishing must set finished_at';
  END IF;
  BEGIN
    PERFORM public.set_game_status('10000000-0000-0000-0000-0000000000c1', 'active');
    RAISE EXCEPTION 'a finished activity must not be reopened';
  EXCEPTION WHEN SQLSTATE 'KS409' THEN
    NULL;
  END;
  BEGIN
    UPDATE public.games SET status = 'paused' WHERE id = '10000000-0000-0000-0000-0000000000c1';
    RAISE EXCEPTION 'a direct update must not reopen a finished activity either';
  EXCEPTION WHEN SQLSTATE 'KS409' THEN
    NULL;
  END;
  BEGIN
    PERFORM public.extend_game_time('10000000-0000-0000-0000-0000000000c1', 5);
    RAISE EXCEPTION 'a finished activity must not get more time';
  EXCEPTION WHEN SQLSTATE 'KS409' THEN
    NULL;
  END;
END $$;
RESET ROLE;

-- A server-side insert of a running or paused activity gets a consistent clock.
INSERT INTO public.games (id, teacher_id, title, game_code, status, paused_ms, paused_at, resumed_at) VALUES
  ('10000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-00000000000a', 'Serverio', 'SRVPSE', 'paused', 999, NULL, now());
DO $$
DECLARE g public.games;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = '10000000-0000-0000-0000-0000000000c3';
  IF g.paused_at IS NULL OR g.paused_ms <> 0 OR g.resumed_at IS NOT NULL OR g.starts_at IS NULL THEN
    RAISE EXCEPTION 'an inserted paused activity must start its pause clock, got % % % %',
      g.paused_at, g.paused_ms, g.resumed_at, g.starts_at;
  END IF;
END $$;

-- A team that starts after a pause gets the pause offset from the database,
-- whatever the caller wrote.
INSERT INTO public.teams (id, game_id, name, session_token) VALUES
  ('30000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1', 'Vėlyva', 'token-late');
UPDATE public.teams SET started_at = now(), pause_offset_ms = 0 WHERE id = '30000000-0000-0000-0000-0000000000c1';
DO $$
DECLARE offset_ms bigint;
BEGIN
  SELECT pause_offset_ms INTO offset_ms FROM public.teams WHERE id = '30000000-0000-0000-0000-0000000000c1';
  IF offset_ms < 119000 THEN
    RAISE EXCEPTION 'a late team must start with the earlier pause as its offset, got %', offset_ms;
  END IF;
  UPDATE public.teams SET pause_offset_ms = 0, name = 'Vėlyva 2' WHERE id = '30000000-0000-0000-0000-0000000000c1';
  IF (SELECT pause_offset_ms FROM public.teams WHERE id = '30000000-0000-0000-0000-0000000000c1') <> offset_ms THEN
    RAISE EXCEPTION 'the pause offset must not change after the start';
  END IF;
END $$;

-- A task without an answer: the activity does not start with it, and a
-- running activity cannot get one.
INSERT INTO public.games (id, teacher_id, title, game_code, status) VALUES
  ('10000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-00000000000a', 'Be atsakymo', 'NOANSW', 'draft');
INSERT INTO public.challenges (id, game_id, title, answer_hash, needs_answer) VALUES
  ('20000000-0000-0000-0000-0000000000c4', '10000000-0000-0000-0000-0000000000c4', 'Kopija', '$2a$10$random', true);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.set_game_status('10000000-0000-0000-0000-0000000000c4', 'active');
    RAISE EXCEPTION 'an activity with a task without an answer must not start';
  EXCEPTION WHEN SQLSTATE 'KS428' THEN
    NULL;
  END;
END $$;
RESET ROLE;
UPDATE public.challenges SET needs_answer = false WHERE id = '20000000-0000-0000-0000-0000000000c4';
SET ROLE authenticated;
DO $$
DECLARE g public.games;
BEGIN
  g := public.set_game_status('10000000-0000-0000-0000-0000000000c4', 'active');
  IF g.status <> 'active' THEN
    RAISE EXCEPTION 'an activity whose tasks all have answers must start';
  END IF;
  BEGIN
    INSERT INTO public.challenges (game_id, title, answer_hash, needs_answer)
      VALUES ('10000000-0000-0000-0000-0000000000c4', 'Bibliotekos užduotis', '$2a$10$random', true);
    RAISE EXCEPTION 'a running activity must not get a task without an answer';
  EXCEPTION WHEN SQLSTATE 'KS409' THEN
    NULL;
  END;
  -- A task with an answer may still be added.
  INSERT INTO public.challenges (game_id, title, answer_hash, needs_answer)
    VALUES ('10000000-0000-0000-0000-0000000000c4', 'Nauja užduotis', '$2a$10$real', false);
END $$;
RESET ROLE;
-- Nor can a task without an answer be moved into it from a draft.
INSERT INTO public.games (id, teacher_id, title, game_code, status) VALUES
  ('10000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-00000000000a', 'Juodraštis', 'DRAFT5', 'draft');
INSERT INTO public.challenges (id, game_id, title, answer_hash, needs_answer) VALUES
  ('20000000-0000-0000-0000-0000000000c5', '10000000-0000-0000-0000-0000000000c5', 'Kopija 2', '$2a$10$random', true);
SET ROLE authenticated;
DO $$
BEGIN
  UPDATE public.challenges SET game_id = '10000000-0000-0000-0000-0000000000c4'
    WHERE id = '20000000-0000-0000-0000-0000000000c5';
  RAISE EXCEPTION 'a task without an answer must not move into a running activity';
EXCEPTION WHEN SQLSTATE 'KS409' THEN
  NULL;
END $$;
RESET ROLE;

-- A running activity keeps its tasks: neither deleted nor moved away.
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    DELETE FROM public.challenges WHERE id = '20000000-0000-0000-0000-0000000000c4';
    RAISE EXCEPTION 'a task must not be deleted from a running activity';
  EXCEPTION WHEN SQLSTATE 'KS409' THEN
    NULL;
  END;
  BEGIN
    UPDATE public.challenges SET game_id = '10000000-0000-0000-0000-0000000000c5'
      WHERE id = '20000000-0000-0000-0000-0000000000c4';
    RAISE EXCEPTION 'a task must not be moved out of a running activity';
  EXCEPTION WHEN SQLSTATE 'KS409' THEN
    NULL;
  END;
  -- A draft's tasks may still be deleted.
  DELETE FROM public.challenges WHERE id = '20000000-0000-0000-0000-0000000000c5';
  IF EXISTS (SELECT 1 FROM public.challenges WHERE id = '20000000-0000-0000-0000-0000000000c5') THEN
    RAISE EXCEPTION 'a task of a draft must be deletable';
  END IF;
END $$;
RESET ROLE;
-- Deleting the running activity itself removes its tasks.
INSERT INTO public.games (id, teacher_id, title, game_code, status) VALUES
  ('10000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-00000000000a', 'Trinama', 'DELET7', 'active');
INSERT INTO public.challenges (game_id, title, answer_hash) VALUES
  ('10000000-0000-0000-0000-0000000000c7', 'Trinamos veiklos užduotis', '$2a$10$real');
SET ROLE authenticated;
DELETE FROM public.games WHERE id = '10000000-0000-0000-0000-0000000000c7';
RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.challenges WHERE game_id = '10000000-0000-0000-0000-0000000000c7') THEN
    RAISE EXCEPTION 'deleting a running activity must remove its tasks';
  END IF;
END $$;

-- A blocked account cannot change its activity through the functions either.
INSERT INTO public.games (id, teacher_id, title, game_code, status, settings) VALUES
  ('10000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-00000000000a', 'Užblokuota', 'BLOCK6', 'active', '{"time_limit_minutes": 30}');
UPDATE public.profiles SET status = 'blocked' WHERE id = '00000000-0000-0000-0000-00000000000a';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
SET ROLE authenticated;
-- Each function must fail, not return an unchanged row as a success.
SELECT public.t_denied($q$SELECT public.set_game_status('10000000-0000-0000-0000-0000000000c6', 'paused')$q$);
SELECT public.t_denied($q$SELECT public.update_game_settings('10000000-0000-0000-0000-0000000000c6', '{"show_leaderboard": false}'::jsonb, '{"title": "Pakeista"}'::jsonb)$q$);
SELECT public.t_denied($q$SELECT public.extend_game_time('10000000-0000-0000-0000-0000000000c6', 5)$q$);
RESET ROLE;
DO $$
DECLARE
  g public.games;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = '10000000-0000-0000-0000-0000000000c6';
  IF g.status <> 'active' OR g.title <> 'Užblokuota' OR g.settings <> '{"time_limit_minutes": 30}'::jsonb THEN
    RAISE EXCEPTION 'a blocked account must not change its activity';
  END IF;
END $$;
UPDATE public.profiles SET status = 'active' WHERE id = '00000000-0000-0000-0000-00000000000a';

-- Team moderation (20261106160000): only the owner, only an active account,
-- only while the activity runs.
INSERT INTO public.games (id, teacher_id, title, game_code, status) VALUES
  ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'Moderavimas', 'MODER1', 'active'),
  ('10000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000a', 'Baigta veikla', 'MODER2', 'finished');
INSERT INTO public.teams (id, game_id, name, session_token) VALUES
  ('30000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000d1', 'Netinkamas', 'token-d1'),
  ('30000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000d1', 'Bandomoji', 'token-d2'),
  ('30000000-0000-0000-0000-0000000000d3', '10000000-0000-0000-0000-0000000000d2', 'Baigusi', 'token-d3');

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.t_denied($q$SELECT public.moderate_team('10000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000d1', 'X')$q$);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
DO $$
BEGIN
  PERFORM public.moderate_team('10000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000d1', 'Svetima');
  RAISE EXCEPTION 'another facilitator must not rename a team';
EXCEPTION WHEN SQLSTATE 'P0002' THEN
  NULL;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
DO $$
DECLARE
  r text;
BEGIN
  -- The result is checked in a later statement, which sees the change.
  r := public.moderate_team('10000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000d1', '  Delfinai  ');
  IF r <> 'renamed' OR (SELECT name FROM public.teams WHERE id = '30000000-0000-0000-0000-0000000000d1') <> 'Delfinai' THEN
    RAISE EXCEPTION 'the owner must rename a team of a running activity';
  END IF;
  BEGIN
    PERFORM public.moderate_team('10000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000d1', 'Bandomoji');
    RAISE EXCEPTION 'a name taken in the activity must be refused';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  BEGIN
    PERFORM public.moderate_team('10000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000d1', '   ');
    RAISE EXCEPTION 'an empty name must be refused';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
  -- A team of another activity is not found through this one.
  BEGIN
    PERFORM public.moderate_team('10000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000d3', NULL, true);
    RAISE EXCEPTION 'a team of another activity must not be removed';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    NULL;
  END;
  -- A finished activity keeps its teams.
  BEGIN
    PERFORM public.moderate_team('10000000-0000-0000-0000-0000000000d2', '30000000-0000-0000-0000-0000000000d3', NULL, true);
    RAISE EXCEPTION 'a team of a finished activity must not be removed';
  EXCEPTION WHEN SQLSTATE 'KS409' THEN
    NULL;
  END;
  r := public.moderate_team('10000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000d2', NULL, true);
  IF r <> 'removed' OR EXISTS (SELECT 1 FROM public.teams WHERE id = '30000000-0000-0000-0000-0000000000d2') THEN
    RAISE EXCEPTION 'the owner must remove a team of a running activity';
  END IF;
END $$;
RESET ROLE;

-- A blocked account cannot moderate, whatever the app's session cache says.
UPDATE public.profiles SET status = 'blocked' WHERE id = '00000000-0000-0000-0000-00000000000a';
SET ROLE authenticated;
SELECT public.t_denied($q$SELECT public.moderate_team('10000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000d1', 'Užblokuotas')$q$);
RESET ROLE;
UPDATE public.profiles SET status = 'active' WHERE id = '00000000-0000-0000-0000-00000000000a';
DO $$
BEGIN
  IF (SELECT name FROM public.teams WHERE id = '30000000-0000-0000-0000-0000000000d1') <> 'Delfinai'
     OR NOT EXISTS (SELECT 1 FROM public.teams WHERE id = '30000000-0000-0000-0000-0000000000d3') THEN
    RAISE EXCEPTION 'refused moderation must leave the teams as they were';
  END IF;
END $$;

-- At most five extra accepted answers, counted by the database (20261107100000).
DO $$
BEGIN
  UPDATE public.challenges SET accepted_answer_hashes = ARRAY['$2a$08$a', '$2a$08$b']
    WHERE id = '20000000-0000-0000-0000-00000000000a';
  IF (SELECT accepted_answer_count FROM public.challenges WHERE id = '20000000-0000-0000-0000-00000000000a') <> 2 THEN
    RAISE EXCEPTION 'accepted_answer_count must follow the list';
  END IF;
  BEGIN
    UPDATE public.challenges SET accepted_answer_hashes = ARRAY['1', '2', '3', '4', '5', '6']
      WHERE id = '20000000-0000-0000-0000-00000000000a';
    RAISE EXCEPTION 'six accepted answers must be refused';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

-- CLS-015: the approved library is for active, signed-in facilitators only
-- (20261108120000). Anon has no privilege; pending and blocked accounts see
-- nothing; an active teacher sees approved items and their own; admins and
-- super admins see everything. scripts/test-data-api.sh repeats this through
-- the Data API.
RESET ROLE;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000001a1', 'cls015-author@example.lt'),
  ('00000000-0000-0000-0000-0000000001a2', 'cls015-teacher@example.lt'),
  ('00000000-0000-0000-0000-0000000001a3', 'cls015-pending@example.lt'),
  ('00000000-0000-0000-0000-0000000001a4', 'cls015-blocked@example.lt'),
  ('00000000-0000-0000-0000-0000000001a5', 'cls015-admin@example.lt'),
  ('00000000-0000-0000-0000-0000000001a6', 'cls015-super@example.lt');
UPDATE public.profiles SET status = 'active', role = 'teacher'
  WHERE id IN ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001a2');
UPDATE public.profiles SET status = 'pending', role = 'teacher' WHERE id = '00000000-0000-0000-0000-0000000001a3';
UPDATE public.profiles SET status = 'blocked', role = 'teacher' WHERE id = '00000000-0000-0000-0000-0000000001a4';
UPDATE public.profiles SET status = 'active', role = 'admin' WHERE id = '00000000-0000-0000-0000-0000000001a5';
UPDATE public.profiles SET status = 'active', role = 'super_admin' WHERE id = '00000000-0000-0000-0000-0000000001a6';
INSERT INTO public.library_items (title, published_by, status) VALUES
  ('CLS015 approved', '00000000-0000-0000-0000-0000000001a1', 'approved'),
  ('CLS015 pending', '00000000-0000-0000-0000-0000000001a1', 'pending_review'),
  ('CLS015 rejected', '00000000-0000-0000-0000-0000000001a1', 'rejected');

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.library_items', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'anon must have no privilege on library_items';
  END IF;
END $$;

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT public.t_denied('SELECT 1 FROM public.library_items');
SELECT public.t_denied($q$SELECT 1 FROM public.library_items WHERE status = 'approved'$q$);
SELECT public.t_denied($q$INSERT INTO public.library_items (title, status) VALUES ('anon', 'pending_review')$q$);
SELECT public.t_denied('UPDATE public.library_items SET clone_count = clone_count + 1');
SELECT public.t_denied('DELETE FROM public.library_items');

RESET ROLE;
CREATE FUNCTION public.t_cls015(who uuid, expected int) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', who::text, false);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', false);
  PERFORM public.t_rows($q$SELECT 1 FROM public.library_items WHERE title LIKE 'CLS015 %'$q$, expected);
END $$;
GRANT EXECUTE ON FUNCTION public.t_cls015(uuid, int) TO authenticated;

SET ROLE authenticated;
-- Active teacher, not the author: approved only.
SELECT public.t_cls015('00000000-0000-0000-0000-0000000001a2', 1);
SELECT public.t_rows($q$SELECT 1 FROM public.library_items WHERE title = 'CLS015 approved'$q$, 1);
-- Author: approved and own pending and rejected.
SELECT public.t_cls015('00000000-0000-0000-0000-0000000001a1', 3);
-- Pending and blocked accounts: nothing, not even approved items.
SELECT public.t_cls015('00000000-0000-0000-0000-0000000001a3', 0);
SELECT public.t_cls015('00000000-0000-0000-0000-0000000001a4', 0);
-- Admin and super admin: everything.
SELECT public.t_cls015('00000000-0000-0000-0000-0000000001a5', 3);
SELECT public.t_cls015('00000000-0000-0000-0000-0000000001a6', 3);
-- A signed-in session without a profile row sees nothing.
SELECT public.t_cls015('00000000-0000-0000-0000-0000000001ff', 0);

-- A blocked author loses the own items too; unblocking restores them.
RESET ROLE;
UPDATE public.profiles SET status = 'blocked' WHERE id = '00000000-0000-0000-0000-0000000001a1';
SET ROLE authenticated;
SELECT public.t_cls015('00000000-0000-0000-0000-0000000001a1', 0);
RESET ROLE;
UPDATE public.profiles SET status = 'active' WHERE id = '00000000-0000-0000-0000-0000000001a1';
SET ROLE authenticated;
SELECT public.t_cls015('00000000-0000-0000-0000-0000000001a1', 3);
RESET ROLE;
