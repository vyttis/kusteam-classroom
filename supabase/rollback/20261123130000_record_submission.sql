-- Rollback for 20261123130000_record_submission.
--
-- Removes the function only; no row is touched. The application then gets
-- "function not found" (PGRST202) from the Data API and writes an answer
-- and its points with the two calls it used before (INSERT INTO submissions,
-- then increment_team_score()), so answers keep being counted.
--
-- WARNING: after this rollback the gap of audit finding R-13 is open again:
-- a failure between the two calls leaves a solved task without its points
-- in teams.total_points.
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP FUNCTION IF EXISTS public.record_submission(uuid, uuid, text, boolean, integer, integer);

COMMIT;
