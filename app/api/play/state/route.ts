import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { tasksVersion } from "@/lib/game/tasks-version"
import { forParticipant, type HintReveal, type TeamStart } from "@/lib/game/player-hints"
import { retryLater } from "@/lib/api/retry-later"

// GET /api/play/state?game_code=ABC123 with x-session-token header
// Single round-trip player state lookup — replaces 3 sequential anon queries.
// Backwards compatible: if the get_player_game_state RPC isn't deployed yet
// (function_does_not_exist 42883), falls back to parallel raw queries that
// produce the same shape.
// The session token is accepted via the x-session-token header (preferred —
// query strings end up in proxy/access logs, and the token is the team's only
// credential) with the legacy ?session_token= query param as fallback.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameCode = searchParams.get("game_code")?.toUpperCase()
  const sessionToken =
    request.headers.get("x-session-token") || searchParams.get("session_token")

  if (!gameCode || gameCode.length < 6) {
    return NextResponse.json({ error: "Netinkamas veiklos kodas" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // The play page (it sends a session) reads the task marker and the hints
  // this team opened before the tasks: an edit saved in between is then
  // already in this answer and costs one extra reload, never a miss. The join
  // page does not need either.
  let tasks_version: string | null = null
  let reveals: HintReveal[] = []
  let start: TeamStart | null = null
  if (sessionToken) {
    const [stampsRes, revealsRes, startRes] = await Promise.all([
      supabase.from("games").select("status, challenges(id, updated_at)").eq("game_code", gameCode).maybeSingle(),
      supabase
        .from("hint_reveals")
        .select("challenge_id, hint_index, teams!inner(session_token)")
        .eq("teams.session_token", sessionToken),
      // When the team pressed "Pradėti": a timed activity sends its tasks
      // only after that, and another device of the team resumes its clock.
      supabase.from("teams").select("started_at, pause_offset_ms").eq("session_token", sessionToken).maybeSingle(),
    ])
    if (startRes.data) {
      start = {
        startedAt: (startRes.data.started_at as string | null) ?? null,
        pauseOffsetMs: Number(startRes.data.pause_offset_ms ?? 0) || 0,
      }
    } else if (startRes.error) {
      // Unknown start: a timed activity holds its tasks back (fail closed);
      // the page keeps asking.
      console.error("team start read failed:", startRes.error.message)
      start = { startedAt: null, pauseOffsetMs: 0 }
    }
    const stamps = stampsRes.data
    if (stamps && stamps.status !== "draft") tasks_version = tasksVersion(stamps.challenges)
    if (revealsRes.error) console.error("hint reveals read failed:", revealsRes.error.message)
    reveals = (revealsRes.data ?? []).map((r) => ({ challenge_id: r.challenge_id, hint_index: r.hint_index }))
  }

  // Fast path: RPC
  const { data, error } = await supabase.rpc("get_player_game_state", {
    p_game_code: gameCode,
    p_session_token: sessionToken || null,
  })

  if (!error) {
    return NextResponse.json(forParticipant(data, reveals, tasks_version, start), {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    })
  }

  const code = (error as { code?: string }).code
  if (code !== "42883" && code !== "PGRST202") {
    // Real error, not just "function not deployed": the read failed, which
    // says nothing about the activity or the team. 503 asks the page to try
    // again; it never answers "team: null" (that would end the session).
    return retryLater("play/state rpc", error)
  }

  // Fallback: raw queries (parallel)
  console.warn("get_player_game_state RPC unavailable — falling back to raw queries. Apply migration 00018.")
  const fallback = await fetchPlayerStateRaw(supabase, gameCode, sessionToken)
  if ("failed" in fallback) return retryLater(`play/state ${fallback.where}`, fallback.failed)
  return NextResponse.json(forParticipant(fallback, reveals, tasks_version, start), {
    headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
  })
}

async function fetchPlayerStateRaw(
  supabase: SupabaseClient,
  gameCode: string,
  sessionToken: string | null,
) {
  // Status list must mirror the RPC (00022): draft games are visible so the
  // join page can show "not started yet"; paused so a mid-pause refresh
  // doesn't degrade to "game not found".
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, title, description, status, settings")
    .eq("game_code", gameCode)
    .in("status", ["draft", "active", "paused", "finished"])
    .maybeSingle()

  // A failed read is not "no such activity" or "no such team": the page
  // would show "not found" or drop the team's session.
  if (gameError) return { failed: gameError, where: "game" }

  if (!game) {
    return { game: null }
  }

  // Draft games expose only title + status — no challenges or settings before
  // the teacher starts the game.
  if (game.status === "draft") {
    return {
      game: {
        id: game.id,
        title: game.title,
        description: null,
        status: game.status,
        settings: {},
      },
      challenges: [],
      team: null,
      solved: [],
    }
  }

  // Parallel: challenges + (if session_token) team
  const [challengesRes, teamRes] = await Promise.all([
    supabase
      .from("challenges")
      .select(
        "id, title, description, type, points, hints, options, order_index, image_url, maps_url, hint_penalty, prerequisites",
      )
      .eq("game_id", game.id)
      .order("order_index", { ascending: true }),
    sessionToken
      ? supabase
          .from("teams")
          .select("id, name, total_points, current_challenge_index")
          .eq("session_token", sessionToken)
          .eq("game_id", game.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (teamRes.error) return { failed: teamRes.error, where: "team" }
  if (challengesRes.error) return { failed: challengesRes.error, where: "challenges" }

  const team = (teamRes as { data: { id: string; name: string; total_points: number; current_challenge_index: number } | null }).data
  let solved: { challenge_id: string; points_awarded: number }[] = []

  if (team) {
    const { data, error: solvedError } = await supabase
      .from("submissions")
      .select("challenge_id, points_awarded")
      .eq("team_id", team.id)
      .eq("is_correct", true)
    if (solvedError) return { failed: solvedError, where: "solved" }
    solved = data ?? []
  }

  return {
    game: {
      id: game.id,
      title: game.title,
      description: game.description,
      status: game.status,
      settings: game.settings,
    },
    challenges: challengesRes.data ?? [],
    team,
    solved,
  }
}
