import { createAdminClient } from "@/lib/supabase/admin"
import { calculatePoints } from "@/lib/game/scoring"
import { recordSubmission } from "@/lib/game/record-submission"
import { startTeamClock } from "@/lib/game/team-start"
import { MAX_ANSWER_LENGTH, verifyAcceptedAnswers, verifyAnswer } from "@/lib/game/answer-hasher"
import { evaluateAchievements, saveAchievements } from "@/lib/game/achievements"
import { pluralizeLt } from "@/lib/utils"
import { NextResponse } from "next/server"
import { clockFromRow, deadlineMs } from "@/lib/game/clock"
import { z } from "zod"
import { checkAiRateLimitAsync } from "@/lib/ai/rate-limit"
import { NO_ROW, retryLater } from "@/lib/api/retry-later"

// Answer checks per minute, right or wrong, counted before any bcrypt work:
// per team, above a fast streak of one-tap choices; per activity, above a
// full class answering at once. The activity ceiling bounds the work however
// many teams one caller creates.
const VERIFY_PER_TEAM_PER_MINUTE = 60
const VERIFY_PER_GAME_PER_MINUTE = 2000

const CHECK_COLUMNS = "id, type, options, points, game_id, explanation, hint_penalty, hints, answer_hash"

type ChallengeForCheck = {
  id: string
  type: string
  options: string[] | null
  points: number
  game_id: string
  explanation: string | null
  hint_penalty: number | null
  hints: unknown
  answer_hash: string
}

/**
 * The task with what checking needs, extra accepted answers included. A
 * database without 20261107100000 has no such column: the task is read
 * without it, so answers keep being checked during the rollout.
 */
async function readChallenge(supabase: ReturnType<typeof createAdminClient>, challengeId: string) {
  const withAccepted = await supabase
    .from("challenges")
    .select(`${CHECK_COLUMNS}, accepted_answer_hashes`)
    .eq("id", challengeId)
    .single()
  if (withAccepted.error?.code !== "42703") return withAccepted
  return supabase.from("challenges").select(CHECK_COLUMNS).eq("id", challengeId).single()
}

const submitAnswerSchema = z.object({
  session_token: z.string().min(1),
  challenge_id: z.string().uuid(),
  answer: z.string().min(1, "Atsakymas privalomas").max(MAX_ANSWER_LENGTH, "Atsakymas per ilgas"),
  hints_used: z.number().int().min(0).max(20).default(0),
})

export async function POST(request: Request) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Netinkamas užklausos formatas" }, { status: 400 })
    }

    const parsed = submitAnswerSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Neteisingi duomenys"
      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Validate team via session_token first — every other query depends on team.id/game_id.
    // "*" (server only) so the clock columns are read when they exist:
    // started_at (00023) and pause_offset_ms (20261106150000) drive the
    // deadline check below, which is skipped on a database without them.
    const { data: team, error: teamError } = (await supabase
      .from("teams")
      .select("*")
      .eq("session_token", parsed.data.session_token)
      .maybeSingle()) as {
      error: { code?: string; message?: string } | null
      data: {
        id: string
        game_id: string
        total_points: number
        current_challenge_index: number
        started_at?: string | null
        pause_offset_ms?: number | string | null
      } | null
    }

    // The read failed: that is not "no such team". 401 below makes the page
    // check its session (and drop it if the team is gone); 503 only asks to
    // send the answer again.
    if (teamError) return retryLater("submissions team", teamError)

    if (!team) {
      return NextResponse.json(
        { error: "Sesija nerasta. Prisijunkite iš naujo." },
        { status: 401 }
      )
    }

    // Parallel fan-out: game status, existing solve, rate-limit count, challenge
    // details, and server-recorded hint reveals for this challenge.
    // Was sequential round-trips; now one ~50-100ms wait.
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
    const [gameRes, existingSolveRes, recentAttemptsRes, challengeRes, hintRevealsRes] = await Promise.all([
      supabase
        .from("games")
        .select("*")
        .eq("id", team.game_id)
        .single(),
      supabase
        .from("submissions")
        .select("id")
        .eq("team_id", team.id)
        .eq("challenge_id", parsed.data.challenge_id)
        .eq("is_correct", true)
        .maybeSingle(),
      // Count only WRONG submissions for rate-limit — don't penalize a team
      // that's correctly solving a fast streak of challenges.
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("team_id", team.id)
        .eq("is_correct", false)
        .gte("attempted_at", oneMinuteAgo),
      readChallenge(supabase, parsed.data.challenge_id),
      // Authoritative hint count (00024). If the table is missing the query
      // errors and we fall back to the client-declared count below.
      supabase
        .from("hint_reveals")
        .select("*", { count: "exact", head: true })
        .eq("team_id", team.id)
        .eq("challenge_id", parsed.data.challenge_id),
    ])

    // Failed reads are not "activity unavailable" or "task not found".
    if (gameRes.error && gameRes.error.code !== NO_ROW) return retryLater("submissions game", gameRes.error)
    if (challengeRes.error && challengeRes.error.code !== NO_ROW) {
      return retryLater("submissions challenge", challengeRes.error)
    }

    const game = gameRes.data
    const existingSolve = existingSolveRes.data
    const recentAttempts = recentAttemptsRes.count
    const challenge = challengeRes.data as (ChallengeForCheck & { accepted_answer_hashes?: string[] | null }) | null

    if (!game || game.status !== "active") {
      const statusMessages: Record<string, string> = {
        draft: "Veikla dar neprasidėjo.",
        paused: "Veikla pristabdyta. Palaukite, kol vedėjas tęs.",
        finished: "Veikla baigta.",
      }
      return NextResponse.json(
        { error: statusMessages[game?.status ?? ""] || "Veikla nepasiekiama." },
        { status: 403 }
      )
    }

    if (existingSolve) {
      return NextResponse.json({
        is_correct: true,
        points_awarded: 0,
        message: "Ši užduotis jau išspręsta!",
        already_solved: true,
      })
    }

    if (recentAttempts && recentAttempts >= 10) {
      return NextResponse.json(
        { error: "Per daug bandymų. Palaukite minutę." },
        { status: 429 }
      )
    }

    const gameSettings = (game.settings as Record<string, unknown>) || {}

    // Server-side time limit: reject submissions past the team's deadline.
    // Anchored on teams.started_at (stamped by /api/play/start), not a
    // client clock, so clearing localStorage / switching devices can't buy
    // extra time. Pauses that fell inside the team's run are added back
    // (lib/game/clock.ts). Skipped when there's no limit.
    const clock = clockFromRow(game as Parameters<typeof clockFromRow>[0])
    let startedAt = team.started_at ?? null
    let offsetMs = Number(team.pause_offset_ms ?? 0)
    if (clock.limitMinutes && !startedAt && "started_at" in team) {
      // A timed activity whose team has no start (a missed stamp, or a limit
      // set while the activity ran): the first answer starts its clock, so
      // no team answers without one.
      const started = await startTeamClock(supabase, team.id)
      startedAt = started.startedAt
      offsetMs = started.pauseOffsetMs
    }
    if (startedAt) {
      const now = Date.now()
      const deadline = deadlineMs(clock, new Date(startedAt).getTime(), offsetMs, now)
      if (deadline !== null && now > deadline) {
        return NextResponse.json(
          { error: "Laikas baigėsi. Rezultatai išsaugoti." },
          { status: 403 }
        )
      }
    }

    // In free mode, verify challenge is unlocked
    const pathMode = (gameSettings.challenge_path_mode as string) || "linear"

    if (pathMode === "free") {
      const { data: unlocked } = await supabase.rpc("is_challenge_unlocked", {
        p_team_id: team.id,
        p_challenge_id: parsed.data.challenge_id,
      })

      if (unlocked === false) {
        return NextResponse.json(
          { error: "Ši užduotis dar neprieinama. Pirmiausia išspręskite reikalingas užduotis." },
          { status: 403 }
        )
      }
    }

    if (!challenge || challenge.game_id !== team.game_id) {
      return NextResponse.json(
        { error: "Užduotis nerasta" },
        { status: 404 }
      )
    }

    // Every check costs one or more bcrypt comparisons (older number answers
    // try several spellings). The wrong-answer count above only sees rows
    // already written, so parallel requests could all pass it; this counter
    // is taken before the work starts.
    if (
      !(await checkAiRateLimitAsync("answer-checks", team.id, VERIFY_PER_TEAM_PER_MINUTE, 60_000)) ||
      !(await checkAiRateLimitAsync("answer-checks-game", team.game_id, VERIFY_PER_GAME_PER_MINUTE, 60_000))
    ) {
      return NextResponse.json(
        { error: "Per daug bandymų. Palaukite minutę." },
        { status: 429 }
      )
    }

    // Verify answer server-side with bcrypt (supports legacy plaintext hashes),
    // then the task's extra accepted answers (20261107100000), if any.
    const isCorrect =
      (await verifyAnswer(parsed.data.answer, challenge.answer_hash, {
        type: challenge.type,
        options: challenge.options,
      })) ||
      (await verifyAcceptedAnswers(parsed.data.answer, challenge.accepted_answer_hashes, challenge.type))

    // Hint penalty from server-recorded reveals (00024), not the client-declared
    // count — otherwise a student could reveal hints and submit hints_used: 0.
    // Falls back to the client count only when the table is missing (the count
    // query errors and hintRevealsRes.count is null on an unmigrated DB).
    const availableHints = Array.isArray(challenge.hints) ? challenge.hints.length : 0
    const serverHintCount =
      typeof hintRevealsRes.count === "number" ? hintRevealsRes.count : null
    const hintsUsed = Math.min(
      serverHintCount ?? parsed.data.hints_used,
      availableHints
    )
    // At most half of the task's points go for hints (lib/game/scoring.ts).
    const pointsAwarded = isCorrect ? calculatePoints(challenge.points, hintsUsed, challenge.hint_penalty || 0) : 0

    // Store the answer and, when it is correct, the team's points: one
    // transaction where migration 20261123130000 is applied, the two calls
    // of before where it is not (lib/game/record-submission.ts).
    const recorded = await recordSubmission(supabase, {
      teamId: team.id,
      challengeId: parsed.data.challenge_id,
      answer: parsed.data.answer,
      isCorrect,
      pointsAwarded,
      hintsUsed,
    })

    if (!recorded.ok) {
      console.error("Submission insert failed:", recorded.message)
      return NextResponse.json(
        { error: "Nepavyko išsaugoti atsakymo. Bandykite dar kartą." },
        { status: 500 }
      )
    }
    // Two concurrent submits can both pass the existingSolve guard above;
    // the later one finds the task solved (idx_submissions_unique_solve)
    // and gets no points a second time.
    if (recorded.alreadySolved) {
      return NextResponse.json({
        is_correct: true,
        points_awarded: 0,
        message: "Ši užduotis jau išspręsta!",
        already_solved: true,
      })
    }

    let earnedAchievements: { type: string; challengeId: string | null; metadata: Record<string, unknown> }[] = []

    if (isCorrect) {
      // Evaluate and save achievements
      try {
        const { count: totalChallenges } = await supabase
          .from("challenges")
          .select("id", { count: "exact", head: true })
          .eq("game_id", team.game_id)

        const achievements = await evaluateAchievements(supabase, {
          teamId: team.id,
          gameId: team.game_id,
          challengeId: parsed.data.challenge_id,
          hintsUsed: hintsUsed,
          totalChallengesInGame: totalChallenges || 0,
        })

        if (achievements.length > 0) {
          await saveAchievements(supabase, team.game_id, team.id, achievements)
          earnedAchievements = achievements
        }
      } catch (err) {
        // Don't fail the submission if achievements fail
        console.error("Achievement evaluation error:", err)
      }
    }

    // The total the database returned with the write; without it (the
    // two-step path) what the team had plus this answer.
    const newTotalPoints =
      recorded.totalPoints ?? (isCorrect ? team.total_points + pointsAwarded : team.total_points)

    return NextResponse.json({
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
      message: isCorrect
        ? `Teisingai! +${pointsAwarded} ${pluralizeLt(pointsAwarded, "taškas", "taškai", "taškų")}`
        : "Neteisingai. Bandykite dar kartą!",
      total_points: newTotalPoints,
      explanation: isCorrect ? (challenge.explanation || null) : null,
      achievements: earnedAchievements,
    })
  } catch (err) {
    console.error("Submissions API error:", err)
    return NextResponse.json(
      { error: "Serverio klaida. Bandykite dar kartą." },
      { status: 500 }
    )
  }
}
