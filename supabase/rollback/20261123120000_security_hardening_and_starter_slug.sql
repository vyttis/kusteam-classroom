-- Rollback for 20261123120000_security_hardening_and_starter_slug.
--
-- Brings back exactly the policies and schema from before the migration.
-- The values of games.starter_slug are lost with the column; nothing else
-- is deleted.
--
-- WARNING: after this rollback the three gaps are open again. A blocked or
-- pending account with a live session reads its own activities, tasks,
-- teams, results, announcements, achievements, lesson plans, reflections,
-- statistics and files; an admin can again update any activity (teacher_id
-- included) and update or delete any lesson plan through the Data API; a
-- library item can again point at someone else's activity. Use the whole
-- file only if the migration breaks something for active accounts. If only
-- one part is the problem, use the partial rollbacks in
-- docs/migration-history.md.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- 4.
ALTER TABLE public.games DROP COLUMN IF EXISTS starter_slug;

-- 3.
DROP TRIGGER IF EXISTS library_items_source_rules ON public.library_items;
DROP FUNCTION IF EXISTS public.library_items_source_rules();

-- 2. As 00002 and 20261106140000 left them.
DROP POLICY IF EXISTS "admins_update_all_games" ON public.games;
CREATE POLICY "admins_update_all_games" ON public.games
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Admins update lesson plans" ON public.lesson_plans;
CREATE POLICY "Admins update lesson plans" ON public.lesson_plans
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Admins delete lesson plans" ON public.lesson_plans;
CREATE POLICY "Admins delete lesson plans" ON public.lesson_plans
  FOR DELETE USING (public.get_my_role() IN ('admin', 'super_admin'));

-- 1.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'games', 'challenges', 'teams', 'submissions', 'announcements',
    'achievements', 'lesson_plans', 'reflections'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Only active accounts read" ON public.%I', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "Only active accounts read uploads" ON storage.objects;

-- As 20261106120000 left them; grants are kept.
CREATE OR REPLACE FUNCTION public.get_game_stats(game_uuid uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_read_game(game_uuid) THEN
    RAISE EXCEPTION 'Nėra teisės matyti šios veiklos statistikos' USING ERRCODE = '42501';
  END IF;
  RETURN public.get_game_stats_unchecked(game_uuid);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_game_reflections(game_uuid uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_read_game(game_uuid) THEN
    RAISE EXCEPTION 'Nėra teisės matyti šios veiklos refleksijų' USING ERRCODE = '42501';
  END IF;
  RETURN public.get_game_reflections_unchecked(game_uuid);
END;
$$;

COMMIT;
