-- Audit probe (2026-11-22), throwaway database only (same setup as
-- blocked-read-probe.sql, run after it). Two questions:
-- 1. Can an active teacher insert a library item that points at ANOTHER
--    teacher's activity (source_game_id)? The clone route later copies answer
--    hashes and explanations from that activity with the service role.
-- 2. Can an `admin` (not super_admin) rewrite any activity's owner through the
--    Data API (policy admins_update_all_games)?
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000f4', 'probe-admin@example.lt');
UPDATE public.profiles SET status = 'active', role = 'admin' WHERE id = '00000000-0000-0000-0000-0000000000f4';
UPDATE public.profiles SET status = 'active' WHERE id = '00000000-0000-0000-0000-0000000000f1';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
-- 1. teacher f1 publishes an item whose source is teacher f3's activity
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
INSERT INTO public.library_items (source_game_id, title, challenge_data, published_by, status)
VALUES ('10000000-0000-0000-0000-0000000000f3', 'Probe item', '[]'::jsonb, auth.uid(), 'pending_review');
-- 2. admin f4 takes ownership of teacher f3's activity
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f4', false);
UPDATE public.games SET teacher_id = auth.uid() WHERE id = '10000000-0000-0000-0000-0000000000f3';
RESET ROLE;

SELECT
  (SELECT count(*) FROM public.library_items l JOIN public.games g ON g.id = l.source_game_id
    WHERE g.teacher_id <> l.published_by OR l.title = 'Probe item') AS foreign_source_items_inserted,
  (SELECT teacher_id = '00000000-0000-0000-0000-0000000000f4' FROM public.games
    WHERE id = '10000000-0000-0000-0000-0000000000f3') AS admin_became_owner;
