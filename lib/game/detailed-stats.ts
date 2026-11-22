import type { SupabaseClient } from "@supabase/supabase-js"
import { allRowsById } from "@/lib/supabase/all-pages"
import { interpretTask, type TaskInsight } from "@/lib/game/formative-insights"
import {
  choiceDistribution,
  groupWrongAnswers,
  type ChoiceStat,
  type WrongAnswer,
} from "@/lib/game/wrong-answers"

// Detailed post-game statistics shared by the analytics API route, the
// finished game detail page, and the printable report (server components
// must call this directly instead of fetching their own API route).

export interface DetailedChallengeStat {
  challenge_id: string
  title: string
  order_index: number
  points: number
  type: string
  difficulty: string | null
  total_attempts: number
  solves: number
  accuracy: number
  completion_rate: number
  avg_attempts_to_solve: number
  auto_difficulty: "easy" | "medium" | "hard" | "unknown"
  /** Answers that were right (a team has at most one per task). */
  correct_attempts: number
  /** Teams that answered the task at least once. */
  attempted_teams: number
  /** Teams whose first answer was right. */
  first_try_solves: number
  /** first_try_solves of attempted_teams in percent; null when nobody tried. */
  first_try_rate: number | null
  /** Teams that had a hint open when answering. */
  hint_teams: number
  /** Top wrong answers of a text or number task; empty without the answers. */
  wrong_answers: WrongAnswer[]
  /** Teams per option of a multiple-choice task; null for other types or without the answers. */
  choice_stats: ChoiceStat[] | null
  /** What the numbers suggest for the next lesson. */
  insight: TaskInsight
}

export interface TeamResultStat {
  team_id: string
  name: string
  total_points: number
  solved: number
  attempts: number
  hints_used: number
  joined_at: string
  last_activity: string | null
}

export interface DetailedStats {
  challenge_stats: DetailedChallengeStat[]
  team_stats: TeamResultStat[]
  total_teams: number
  /** The answer texts were read, so wrong_answers and choice_stats are filled. */
  answers_included: boolean
}

export interface DetailedStatsOptions {
  /**
   * A service-role client to read submissions.answer with (no browser role
   * may read that column). Pass it ONLY after checking that the signed-in
   * user owns the activity. The tasks and teams are still read through
   * `supabase` under the caller's RLS, and the answers only for those tasks:
   * a caller who cannot read the activity gets no answers either.
   */
  answerReader?: SupabaseClient
}

interface SubmissionRow {
  id: string
  challenge_id: string
  is_correct: boolean
  points_awarded: number
  team_id: string
  hints_used: number
  attempted_at: string
  answer?: string | null
}

const SUBMISSION_FIELDS = "id, challenge_id, is_correct, points_awarded, team_id, hints_used, attempted_at"

export async function computeDetailedStats(
  supabase: SupabaseClient,
  gameId: string,
  options: DetailedStatsOptions = {}
): Promise<DetailedStats> {
  const answersIncluded = !!options.answerReader
  const [{ data: challenges }, { data: teams }] = await Promise.all([
    supabase
      .from("challenges")
      .select("id, title, points, order_index, difficulty, type, options")
      .eq("game_id", gameId)
      .order("order_index", { ascending: true }),
    supabase
      .from("teams")
      .select("id, name, total_points, joined_at")
      .eq("game_id", gameId)
      .order("total_points", { ascending: false }),
  ])

  if (!challenges || challenges.length === 0) {
    return { challenge_stats: [], team_stats: [], total_teams: teams?.length || 0, answers_included: answersIncluded }
  }

  const challengeIds = challenges.map((c) => c.id)
  // All answers, past the 1000-row page limit. A failed read throws: the
  // report must not show part of the answers as if they were all.
  const reader = options.answerReader ?? supabase
  const fields = answersIncluded ? `${SUBMISSION_FIELDS}, answer` : SUBMISSION_FIELDS
  const { data: submissions, error: submissionsError } = await allRowsById<SubmissionRow>(() =>
    reader.from("submissions").select(fields).in("challenge_id", challengeIds)
  )
  if (!submissions) throw submissionsError

  // In the order they were given (ties by id), which the per-team counts below rely on.
  const subs = [...submissions].sort(
    (a, b) => Date.parse(a.attempted_at) - Date.parse(b.attempted_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  const teamCount = teams?.length || 0
  // Answers of teams that are no longer in the activity (removed by the
  // facilitator) would otherwise count toward tasks but not toward teams.
  const teamIds = new Set((teams || []).map((t) => t.id))

  const challengeStats: DetailedChallengeStat[] = challenges.map((challenge) => {
    const challengeSubs = subs.filter((s) => s.challenge_id === challenge.id && teamIds.has(s.team_id))
    const totalAttempts = challengeSubs.length
    const correctSubs = challengeSubs.filter((s) => s.is_correct)

    const solvedTeams = new Set(correctSubs.map((s) => s.team_id))
    const uniqueSolves = solvedTeams.size

    const accuracy = totalAttempts > 0 ? correctSubs.length / totalAttempts : 0

    let autoDifficulty: DetailedChallengeStat["auto_difficulty"]
    if (totalAttempts < 3) {
      autoDifficulty = "unknown"
    } else if (accuracy < 0.3) {
      autoDifficulty = "hard"
    } else if (accuracy < 0.7) {
      autoDifficulty = "medium"
    } else {
      autoDifficulty = "easy"
    }

    const completionRate = teamCount > 0 ? uniqueSolves / teamCount : 0

    // Attempts up to and including each team's own first correct submission
    // (challengeSubs are ordered by attempted_at)
    let avgAttemptsToSolve = 0
    if (uniqueSolves > 0) {
      const attemptsPerTeam = new Map<string, number>()
      const solvedSoFar = new Set<string>()
      for (const sub of challengeSubs) {
        if (solvedSoFar.has(sub.team_id)) continue
        attemptsPerTeam.set(sub.team_id, (attemptsPerTeam.get(sub.team_id) || 0) + 1)
        if (sub.is_correct) solvedSoFar.add(sub.team_id)
      }
      const totalAttemptsForSolvers = Array.from(solvedTeams).reduce(
        (sum, teamId) => sum + (attemptsPerTeam.get(teamId) || 0),
        0
      )
      avgAttemptsToSolve = totalAttemptsForSolvers / uniqueSolves
    }

    // First answer and most hints per team (challengeSubs are in time order).
    const firstCorrect = new Map<string, boolean>()
    const hintsByTeam = new Map<string, number>()
    for (const sub of challengeSubs) {
      if (!firstCorrect.has(sub.team_id)) firstCorrect.set(sub.team_id, sub.is_correct)
      hintsByTeam.set(sub.team_id, Math.max(hintsByTeam.get(sub.team_id) ?? 0, sub.hints_used || 0))
    }
    const attemptedTeams = firstCorrect.size
    const firstTrySolves = [...firstCorrect.values()].filter(Boolean).length
    const hintTeams = [...hintsByTeam.values()].filter((n) => n > 0).length

    const answerRows = answersIncluded
      ? challengeSubs.map((s) => ({ team_id: s.team_id, answer: s.answer ?? null, is_correct: s.is_correct }))
      : []
    const choiceOptions = Array.isArray(challenge.options) ? (challenge.options as string[]) : null

    return {
      correct_attempts: correctSubs.length,
      attempted_teams: attemptedTeams,
      first_try_solves: firstTrySolves,
      first_try_rate: attemptedTeams > 0 ? Math.round((firstTrySolves / attemptedTeams) * 100) : null,
      hint_teams: hintTeams,
      wrong_answers: groupWrongAnswers(answerRows, challenge.type),
      choice_stats:
        answersIncluded && challenge.type === "multiple_choice" ? choiceDistribution(answerRows, choiceOptions) : null,
      insight: interpretTask({
        total_teams: teamCount,
        attempted_teams: attemptedTeams,
        solved_teams: uniqueSolves,
        first_try_solves: firstTrySolves,
        hint_teams: hintTeams,
        avg_attempts_to_solve: avgAttemptsToSolve,
      }),
      challenge_id: challenge.id,
      title: challenge.title,
      order_index: challenge.order_index,
      points: challenge.points,
      type: challenge.type,
      difficulty: challenge.difficulty,
      total_attempts: totalAttempts,
      solves: uniqueSolves,
      accuracy: Math.round(accuracy * 100),
      completion_rate: Math.round(completionRate * 100),
      avg_attempts_to_solve: Math.round(avgAttemptsToSolve * 10) / 10,
      auto_difficulty: autoDifficulty,
    }
  })

  const teamStats: TeamResultStat[] = (teams || []).map((team) => {
    const teamSubs = subs.filter((s) => s.team_id === team.id)
    const solved = new Set(
      teamSubs.filter((s) => s.is_correct).map((s) => s.challenge_id)
    ).size
    // Each answer records the hints opened on that task so far, so the same
    // hint shows up again on every retry: count the most per task, not the sum.
    const hintsByTask = new Map<string, number>()
    for (const s of teamSubs) {
      hintsByTask.set(s.challenge_id, Math.max(hintsByTask.get(s.challenge_id) ?? 0, s.hints_used || 0))
    }
    const hintsUsed = [...hintsByTask.values()].reduce((sum, n) => sum + n, 0)
    const lastActivity =
      teamSubs.length > 0 ? teamSubs[teamSubs.length - 1].attempted_at : null

    return {
      team_id: team.id,
      name: team.name,
      total_points: team.total_points,
      solved,
      attempts: teamSubs.length,
      hints_used: hintsUsed,
      joined_at: team.joined_at,
      last_activity: lastActivity,
    }
  })

  return {
    challenge_stats: challengeStats,
    team_stats: teamStats,
    total_teams: teamCount,
    answers_included: answersIncluded,
  }
}
