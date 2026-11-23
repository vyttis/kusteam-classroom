import type { SupabaseClient } from "@supabase/supabase-js"

export type SubmissionToRecord = {
  teamId: string
  challengeId: string
  answer: string
  isCorrect: boolean
  pointsAwarded: number
  hintsUsed: number
}

export type RecordedSubmission =
  | {
      ok: true
      /** The team had already solved this task: nothing was written. */
      alreadySolved: boolean
      /** The team's total after the write, when the database returned it. */
      totalPoints: number | null
      /** Which path wrote it: the single function, or the two calls of before. */
      path: "atomic" | "two-step"
    }
  | { ok: false; code?: string; message?: string }

type DbError = { code?: string; message?: string }

/** PostgREST (PGRST202) or Postgres (42883): the function is not there. */
function functionMissing(error: DbError): boolean {
  return error.code === "PGRST202" || error.code === "42883"
}

/**
 * Stores an answer and, when it is correct, the team's points.
 *
 * With migration 20261123130000 both happen in one transaction
 * (record_submission): a solved task can no longer be left without its
 * points. A database without the function answers "function not found", and
 * only then the two calls used before run (insert, then
 * increment_team_score), so answers are counted during the rollout. Any
 * other failure of the function is returned as it is: it is never followed
 * by the two-step write, which could store the answer a second time.
 *
 * Server only (service role). The points are computed by the caller
 * (lib/game/scoring.ts); nothing here looks at answers or hashes.
 */
export async function recordSubmission(supabase: SupabaseClient, s: SubmissionToRecord): Promise<RecordedSubmission> {
  const { data, error } = await supabase.rpc("record_submission", {
    p_team_id: s.teamId,
    p_challenge_id: s.challengeId,
    p_answer: s.answer,
    p_is_correct: s.isCorrect,
    p_points_awarded: s.pointsAwarded,
    p_hints_used: s.hintsUsed,
  })

  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as { already_solved?: unknown; total_points?: unknown } | null
    return {
      ok: true,
      alreadySolved: row?.already_solved === true,
      totalPoints: typeof row?.total_points === "number" ? row.total_points : null,
      path: "atomic",
    }
  }
  if (!functionMissing(error)) return { ok: false, code: error.code, message: error.message }

  return recordInTwoSteps(supabase, s)
}

/** The write as it was before 20261123130000: two separate calls. */
async function recordInTwoSteps(supabase: SupabaseClient, s: SubmissionToRecord): Promise<RecordedSubmission> {
  // The insert result MUST be checked: two concurrent submits can both pass
  // the route's "already solved" read, and the loser hits
  // idx_submissions_unique_solve (23505). Skipping the check would
  // double-award points via increment_team_score below.
  const { error: insertError } = await supabase.from("submissions").insert({
    team_id: s.teamId,
    challenge_id: s.challengeId,
    answer: s.answer,
    is_correct: s.isCorrect,
    points_awarded: s.pointsAwarded,
    hints_used: s.hintsUsed,
  })
  if (insertError) {
    if (insertError.code === "23505") return { ok: true, alreadySolved: true, totalPoints: null, path: "two-step" }
    return { ok: false, code: insertError.code, message: insertError.message }
  }

  if (s.isCorrect) {
    const { error: scoreError } = await supabase.rpc("increment_team_score", {
      p_team_id: s.teamId,
      p_points: s.pointsAwarded,
    })
    if (scoreError) {
      // The submission is already stored; without this log a failed score
      // update stays invisible (as it did for two teams in March 2026).
      console.error(
        JSON.stringify({
          event: "team_score_update_failed",
          team_id: s.teamId,
          code: (scoreError as DbError).code,
          message: (scoreError as DbError).message,
        })
      )
    }
  }
  return { ok: true, alreadySolved: false, totalPoints: null, path: "two-step" }
}
