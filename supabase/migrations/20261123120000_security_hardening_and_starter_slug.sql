-- 20261123120000_security_hardening_and_starter_slug
--
-- Four changes from the 2026-11-22 audit (docs/audits/, evidence in
-- docs/audits/evidence/blocked-read-probe.sql and
-- library-and-admin-probe.sql). No row is changed. The application works
-- with and without this migration: it does not write games.starter_slug yet
-- and uses none of the removed policies.
--
-- 1. Blocked and pending accounts read no facilitator data.
--    Before: the restrictive "Only active accounts ..." policies covered
--    INSERT, UPDATE and DELETE (20261106130000) and, for library_items only,
--    SELECT (20261108120000). A blocked or pending account with a live
--    session still read, with its own token through the Data API, its own
--    activities, tasks, teams, results, announcements, achievements, lesson
--    plans, reflections and its files in storage (the probe: 1 row each).
--    After: a restrictive SELECT policy with is_active_account() on games,
--    challenges, teams, submissions, announcements, achievements,
--    lesson_plans, reflections and storage.objects. An inactive account
--    reads only its own profiles row, which the "waiting / blocked" page
--    needs. Restrictive policies are ANDed with the permissive ones, so an
--    active teacher, admin or super admin reads exactly what they read
--    before. is_active_account() itself is not touched: where TEAM-006 is
--    applied (production) it already includes team_staff_access_ok(), so a
--    staff member with a valid TEAM session is active and one without was
--    already refused by the TEAM-006 policy; the result is the same with
--    and without TEAM-006.
--    The same rule for the two SECURITY DEFINER functions that return
--    facilitator data and skip RLS: get_game_stats() and
--    get_game_reflections() answered a blocked or pending owner through
--    can_read_game(). They now also ask is_active_account() (the service
--    role excepted, as before). can_read_game() is not changed here,
--    because TEAM-006 owns its definition.
--    Not covered on purpose: profiles (own row stays readable),
--    team_members and team_activity_grants (TEAM staff have no CLASSROOM
--    profile and must keep reading their own row), library_items (already
--    has the policy), and the tables no client role can read at all
--    (access_requests, admin_audit_log, ai_usage, hint_reveals,
--    platform_settings, request_links, team_tokens). Participants are not
--    affected: they have no session and are served by the service role.
--
-- 2. An admin can no longer take over activities or lesson plans.
--    Before: "admins_update_all_games" (00002) let an admin or super admin
--    UPDATE any column of any activity through the Data API, teacher_id
--    included, and "Admins update lesson plans" / "Admins delete lesson
--    plans" (00017, 20261106140000) let them rewrite or delete anyone's
--    lesson plan, teacher_id included.
--    After: the three policies are gone. Admins keep reading everything
--    (the admins_read_all_* and "Admins see all lesson plans" policies
--    stay). The application never used the removed ones: every activity and
--    lesson plan write under a user session filters on teacher_id =
--    auth.uid(), set_game_status(), update_game_settings() and
--    extend_game_time() accept the owner only, and the admin "finish
--    activity" action writes with the service role
--    (app/api/admin/games/[gameId]/finish/route.ts).
--    Kept: "admin_update_library", which library moderation uses under the
--    admin's session (PATCH /api/library/[itemId]), and
--    "super_admin_delete_library" (DELETE of the same route). The trigger
--    of point 3 stops them from changing who published an item or which
--    activity it comes from.
--
-- 3. A library item points only at its publisher's own activity.
--    Before: "teacher_insert_library" and "publisher_update_own_library"
--    did not look at source_game_id, so a facilitator could publish an item
--    whose source was someone else's activity, and an admin could repoint
--    any item or change its published_by. The server already copies answers
--    only from the publisher's own activity; this is the same rule in the
--    database.
--    After: trigger library_items_source_rules, for the client roles only
--    (service role and SQL are trusted, as in games_status_rules):
--      * published_by cannot be changed;
--      * a source_game_id that is set on INSERT, or changed on UPDATE, must
--        be an activity of the publisher, set by the publisher. NULL is
--        always accepted.
--    A trigger and not WITH CHECK, because the rule is about the change: an
--    update that leaves source_game_id alone (admin moderation of someone
--    else's item, an item whose source activity later got another owner,
--    any older row) is not refused, and the ON DELETE SET NULL of the
--    foreign key keeps working when the source activity is deleted.
--
-- 4. games.starter_slug: which ready-made activity a draft was created
--    from, so the activity can link back to its methodical notes.
--    Before: no such column. After: a nullable text column without a
--    foreign key (the catalogue lives in the code), with the same format
--    the create route accepts (lowercase words joined by hyphens, at most
--    60 characters). Grants: authenticated has table-level privileges on
--    games (unlike challenges, teams and submissions, which use column
--    grants), so the new column needs no GRANT: the owner reads it and may
--    set it on INSERT through "Teachers can manage own games". UPDATE is
--    left as it is for every other games column: taking it away for one
--    column would mean replacing the table-level UPDATE grant with a list
--    of columns, and the value only chooses which public notes the owner
--    sees for their own activity. anon cannot read games at all.
--
-- Locks: ALTER TABLE games (ACCESS EXCLUSIVE, no rewrite; the CHECK scans
-- the table once), CREATE/DROP POLICY and CREATE TRIGGER on the tables
-- above (short ACCESS EXCLUSIVE / SHARE ROW EXCLUSIVE). Apply when no
-- activity runs. Rollback:
-- supabase/rollback/20261123120000_security_hardening_and_starter_slug.sql
-- Procedure and checks: docs/migration-history.md.

BEGIN;
-- If a table lock cannot be taken within 5 s the whole migration stops and
-- is undone (error 55P03), so requests wait on it at most that long.
SET LOCAL lock_timeout = '5s';

-- 1. Reads only for active accounts ---------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'games', 'challenges', 'teams', 'submissions', 'announcements',
    'achievements', 'lesson_plans', 'reflections'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Only active accounts read" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Only active accounts read" ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated '
      'USING ((SELECT public.is_active_account()))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Only active accounts read uploads" ON storage.objects;
CREATE POLICY "Only active accounts read uploads" ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT public.is_active_account()));

-- The statistics and reflections functions skip RLS: same rule. Bodies
-- otherwise as in 20261106120000; grants are kept.
CREATE OR REPLACE FUNCTION public.get_game_stats(game_uuid uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_read_game(game_uuid)
     OR (coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_active_account()) THEN
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
  IF NOT public.can_read_game(game_uuid)
     OR (coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_active_account()) THEN
    RAISE EXCEPTION 'Nėra teisės matyti šios veiklos refleksijų' USING ERRCODE = '42501';
  END IF;
  RETURN public.get_game_reflections_unchecked(game_uuid);
END;
$$;

-- 2. Admin writes the application does not use ----------------------------
DROP POLICY IF EXISTS "admins_update_all_games" ON public.games;
DROP POLICY IF EXISTS "Admins update lesson plans" ON public.lesson_plans;
DROP POLICY IF EXISTS "Admins delete lesson plans" ON public.lesson_plans;

-- 3. Library items and their source activity ------------------------------
CREATE OR REPLACE FUNCTION public.library_items_source_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Server-side writers (service role, SQL) are trusted. The foreign keys'
  -- ON DELETE SET NULL also runs as the table owner and passes here.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.published_by IS DISTINCT FROM OLD.published_by THEN
    RAISE EXCEPTION 'the publisher of a library item cannot be changed' USING ERRCODE = '42501';
  END IF;

  -- Only a source that is being set is checked: NULL is always fine, and an
  -- update that leaves the source alone (moderation) is not judged again.
  IF NEW.source_game_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.source_game_id IS DISTINCT FROM OLD.source_game_id) THEN
    IF NEW.published_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = NEW.source_game_id AND g.teacher_id = NEW.published_by
    ) THEN
      RAISE EXCEPTION 'a library item can only come from its publisher''s own activity' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.library_items_source_rules() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS library_items_source_rules ON public.library_items;
CREATE TRIGGER library_items_source_rules
  BEFORE INSERT OR UPDATE ON public.library_items
  FOR EACH ROW EXECUTE FUNCTION public.library_items_source_rules();

-- 4. The ready-made activity a draft came from ----------------------------
ALTER TABLE public.games
  ADD COLUMN starter_slug text
  CONSTRAINT starter_slug_format
    CHECK (starter_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(starter_slug) <= 60);

COMMIT;
