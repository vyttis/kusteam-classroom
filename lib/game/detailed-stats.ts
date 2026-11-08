import type { SupabaseClient } from "@supabase/supabase-js"
import { allRowsById } from "@/lib/supabase/all-pages"

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
}

export async function computeDetailedStats(
  supabase: SupabaseClient,
  gameId: string
): Promise<DetailedStats> {
  const [{ data: challenges }, { data: teams }] = await Promise.all([
    supabase
      .from("challenges")
      .select("id, title, points, order_index, difficulty, type")
      .eq("game_id", gameId)
      .order("order_index", { ascending: true }),
    supabase
      .from("teams")
      .select("id, name, total_points, joined_at")
      .eq("game_id", gameId)
      .order("total_points", { ascending: false }),
  ])

  if (!challenges || challenges.length === 0) {
    return { challenge_stats: [], team_stats: [], total_teams: teams?.length || 0 }
  }

  const challengeIds = challenges.map((c) => c.id)
  // All answers, past the 1000-row page limit. A failed read throws: the
  // report must not show part of the answers as if they were all.
  const { data: submissions, error: submissionsError } = await allRowsById<{
    id: string
    challenge_id: string
    is_correct: boolean
    points_awarded: number
    team_id: string
    hints_used: number
    attempted_at: string
  }>(() =>
    supabase
      .from("submissions")
      .select("id, challenge_id, is_correct, points_awarded, team_id, hints_used, attempted_at")
      .in("challenge_id", challengeIds)
  )
  if (!submissions) throw submissionsError

  // In the order they were given (ties by id), which the per-team counts below rely on.
  const subs = [...submissions].sort(
    (a, b) => Date.parse(a.attempted_at) - Date.parse(b.attempted_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  const teamCount = teams?.length || 0

  const challengeStats: DetailedChallengeStat[] = challenges.map((challenge) => {
    const challengeSubs = subs.filter((s) => s.challenge_id === challenge.id)
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

    return {
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
  }
}
