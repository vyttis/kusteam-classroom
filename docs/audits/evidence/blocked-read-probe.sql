-- Audit probe (2026-11-22): what can a blocked or pending account still READ
-- through RLS with its own JWT? Read-only against a throwaway database that
-- has bootstrap.sql, every migration and the TEAM-006 up.sql applied (the
-- production state). Never run against production: it inserts synthetic rows.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'probe-blocked@example.lt'),
  ('00000000-0000-0000-0000-0000000000f2', 'probe-pending@example.lt'),
  ('00000000-0000-0000-0000-0000000000f3', 'probe-other@example.lt');
UPDATE public.profiles SET status = 'active'
  WHERE id IN ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f3');
INSERT INTO public.games (id, teacher_id, title, game_code, status) VALUES
  ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1', 'Probe own', 'PROBE1', 'draft'),
  ('10000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f3', 'Probe other', 'PROBE3', 'draft');
INSERT INTO public.challenges (id, game_id, title, answer_hash) VALUES
  ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f1', 'T', '$2a$10$x');
INSERT INTO public.teams (id, game_id, name, session_token) VALUES
  ('30000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f1', 'Komanda', 'probe-token');
INSERT INTO public.submissions (team_id, challenge_id, answer, is_correct, points_awarded) VALUES
  ('30000000-0000-0000-0000-0000000000f1', '20000000-0000-0000-0000-0000000000f1', 'atsakymas', true, 100);
UPDATE public.profiles SET status = 'blocked' WHERE id = '00000000-0000-0000-0000-0000000000f1';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
SELECT 'blocked' AS account,
  (SELECT count(*) FROM public.games) AS games_visible,
  (SELECT count(*) FROM public.teams) AS teams_visible,
  (SELECT count(*) FROM public.profiles) AS profiles_visible,
  (SELECT count(id) FROM public.submissions) AS submissions_visible,
  (SELECT count(id) FROM public.challenges) AS challenges_visible;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
SELECT 'pending' AS account,
  (SELECT count(*) FROM public.games) AS games_visible,
  (SELECT count(*) FROM public.teams) AS teams_visible,
  (SELECT count(*) FROM public.profiles) AS profiles_visible,
  (SELECT count(id) FROM public.submissions) AS submissions_visible,
  (SELECT count(id) FROM public.challenges) AS challenges_visible;
RESET ROLE;
