-- 20261123130000_record_submission
--
-- Audit finding R-13 (docs/audits/CLASSROOM-TEACHER-READINESS-2026-11-22.md):
-- an answer and the team's points were written by two separate calls from
-- /api/submissions: INSERT INTO submissions, then increment_team_score().
-- A failure between them (a timeout, a restart of the server function) left
-- a solved task without its points in teams.total_points, which is what the
-- leaderboard and the facilitator's screens show.
--
-- record_submission() does both in one transaction:
--   * locks the team's row, so two answers of one team are handled one
--     after the other;
--   * inserts the submission; a second correct answer for the same task
--     hits idx_submissions_unique_solve (00018) exactly as before and is
--     answered as "already solved" with nothing written;
--   * for a correct answer adds the points to teams.total_points and, in
--     linear mode, moves current_challenge_index on by one: the same rule
--     as increment_team_score() (00013, 00018), in the same transaction;
--   * returns the team's total after the write.
-- The scoring rules stay in the application (lib/game/scoring.ts): the
-- points and the hint count are parameters, computed by /api/submissions
-- after it has checked the answer. Nothing about answers or hashes moves
-- into SQL; check_answer() is still not used.
--
-- No row and no existing object is changed. increment_team_score() stays:
-- the application calls record_submission() and, where this migration is
-- not applied yet (PGRST202 / 42883), falls back to the two calls it made
-- before. So the application works with and without this migration, and
-- the rollback only brings the two-step write back.
--
-- Runs as the caller (not SECURITY DEFINER): only the service role may
-- execute it, and the service role already writes both tables.
--
-- Locks: none on existing objects (CREATE FUNCTION only). Can be applied
-- while activities run. Apply after 20261123120000. Rollback:
-- supabase/rollback/20261123130000_record_submission.sql
-- Procedure and checks: docs/migration-history.md.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.record_submission(
  p_team_id uuid,
  p_challenge_id uuid,
  p_answer text,
  p_is_correct boolean,
  p_points_awarded integer,
  p_hints_used integer
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_game_id uuid;
  v_total integer;
  v_mode text;
BEGIN
  IF p_is_correct IS NULL OR p_points_awarded IS NULL OR p_points_awarded < 0
     OR (NOT p_is_correct AND p_points_awarded <> 0)
     OR p_hints_used IS NULL OR p_hints_used < 0 THEN
    RAISE EXCEPTION 'invalid submission values' USING ERRCODE = '22023';
  END IF;

  -- The team's row is held until the end: its answers are written one at a
  -- time, and the total returned below is the one this call left.
  SELECT t.game_id, t.total_points INTO v_game_id, v_total
  FROM public.teams t
  WHERE t.id = p_team_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;

  -- A task of another activity is never counted for this team.
  IF NOT EXISTS (
    SELECT 1 FROM public.challenges c WHERE c.id = p_challenge_id AND c.game_id = v_game_id
  ) THEN
    RAISE EXCEPTION 'task not found in the team''s activity' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    INSERT INTO public.submissions (team_id, challenge_id, answer, is_correct, points_awarded, hints_used)
    VALUES (p_team_id, p_challenge_id, p_answer, p_is_correct, p_points_awarded, p_hints_used);
  EXCEPTION WHEN unique_violation THEN
    -- idx_submissions_unique_solve: the task is already solved by this
    -- team. Nothing is written and no points are added a second time.
    RETURN jsonb_build_object('already_solved', true, 'total_points', v_total);
  END;

  IF p_is_correct THEN
    SELECT coalesce(g.settings ->> 'challenge_path_mode', 'linear') INTO v_mode
    FROM public.games g
    WHERE g.id = v_game_id;

    UPDATE public.teams
    SET total_points = total_points + p_points_awarded,
        current_challenge_index = current_challenge_index + CASE WHEN v_mode = 'linear' THEN 1 ELSE 0 END
    WHERE id = p_team_id
    RETURNING total_points INTO v_total;
  END IF;

  RETURN jsonb_build_object('already_solved', false, 'total_points', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.record_submission(uuid, uuid, text, boolean, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_submission(uuid, uuid, text, boolean, integer, integer)
  TO service_role;

COMMIT;
