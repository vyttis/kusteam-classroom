import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const NO_STORE = { "Cache-Control": "no-store" }

/**
 * GET — when each team of the facilitator's own activity started its clock.
 *
 * A time limit runs from the team's own "Pradėti", so the facilitator's
 * screens need every team's start to say truthfully how long each has left
 * (audit R-12). Facilitators have no column grant on teams.started_at and
 * teams.pause_offset_ms, so once the signed-in account is known to own the
 * activity (read under its own session and RLS), the server reads the two
 * columns with the service role. Only ids and times are returned: no
 * session tokens, answers or hints.
 */
export async function GET(_request: Request, props: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizuota" }, { status: 401, headers: NO_STORE })

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, status, settings, starts_at, paused_ms, paused_at")
    .eq("id", gameId)
    .eq("teacher_id", user.id)
    .maybeSingle()
  if (gameError) return NextResponse.json({ error: "Nepavyko nuskaityti veiklos." }, { status: 503, headers: NO_STORE })
  if (!game) return NextResponse.json({ error: "Veikla nerasta" }, { status: 404, headers: NO_STORE })

  const limit = (game.settings as { time_limit_minutes?: unknown } | null)?.time_limit_minutes
  const timeLimit = typeof limit === "number" && limit > 0 ? limit : null

  // Without a limit no team has a deadline: nothing to read.
  let teams: { id: string; started_at: string | null; pause_offset_ms: number }[] = []
  if (timeLimit) {
    const { data, error } = await createAdminClient()
      .from("teams")
      .select("id, started_at, pause_offset_ms")
      .eq("game_id", game.id)
    if (error) {
      return NextResponse.json({ error: "Nepavyko nuskaityti komandų laiko." }, { status: 503, headers: NO_STORE })
    }
    teams = (data ?? []).map((t) => ({
      id: t.id as string,
      started_at: (t.started_at as string | null) ?? null,
      pause_offset_ms: Number(t.pause_offset_ms ?? 0) || 0,
    }))
  }

  return NextResponse.json(
    {
      status: game.status,
      time_limit_minutes: timeLimit,
      starts_at: game.starts_at ?? null,
      paused_ms: Number(game.paused_ms ?? 0) || 0,
      paused_at: game.paused_at ?? null,
      // Lets the page correct for its own clock being off.
      now: new Date().toISOString(),
      teams,
    },
    { headers: NO_STORE }
  )
}
