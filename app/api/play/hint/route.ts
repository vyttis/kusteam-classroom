import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"
import { startTeamClock } from "@/lib/game/team-start"
import { retryLater } from "@/lib/api/retry-later"

// POST /api/play/hint — record that a team revealed a hint and return its
// text. The play state sends only hints the team already opened, so this is
// the one way to read a hint, and reading it always records the penalty.
//
// The hint penalty in /api/submissions is computed from these rows, not from a
// client-declared count, so a student can no longer reveal hints and then
// claim they used none. Idempotent per (team, challenge, hint_index) via the
// unique constraint (00024).
const hintSchema = z.object({
  session_token: z.string().min(1),
  challenge_id: z.string().uuid(),
  hint_index: z.number().int().min(0).max(20),
})

export async function POST(request: Request) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Netinkamas užklausos formatas" }, { status: 400 })
    }

    const parsed = hintSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Neteisingi duomenys" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: team, error: teamError } = (await supabase
      .from("teams")
      .select("*")
      .eq("session_token", parsed.data.session_token)
      .maybeSingle()) as {
      error: { code?: string; message?: string } | null
      data: { id: string; game_id: string; started_at?: string | null } | null
    }

    // A failed read is not "no such team" (see lib/api/retry-later.ts).
    if (teamError) return retryLater("play/hint team", teamError)

    if (!team) {
      return NextResponse.json(
        { error: "Sesija nerasta. Prisijunkite iš naujo." },
        { status: 401 }
      )
    }

    // The challenge must belong to the team's game, and the hint index must
    // exist — otherwise a client could inflate any team's penalty.
    const { data: challenge, error: challengeError } = await supabase
      .from("challenges")
      .select("id, game_id, hints")
      .eq("id", parsed.data.challenge_id)
      .maybeSingle()

    if (challengeError) return retryLater("play/hint challenge", challengeError)

    if (!challenge || challenge.game_id !== team.game_id) {
      return NextResponse.json({ error: "Užduotis nerasta" }, { status: 404 })
    }

    // In a timed activity a hint, like an answer, counts as working on the
    // tasks: a team without a start (it never pressed "Pradėti") gets its
    // clock started now, so hints cannot be read before the time runs.
    if ("started_at" in team && !team.started_at) {
      const { data: game } = await supabase.from("games").select("status, settings").eq("id", team.game_id).maybeSingle()
      const limit = (game?.settings as { time_limit_minutes?: unknown } | null)?.time_limit_minutes
      if (typeof limit === "number" && limit > 0 && (game?.status === "active" || game?.status === "paused")) {
        await startTeamClock(supabase, team.id)
      }
    }

    const hints: unknown[] = Array.isArray(challenge.hints) ? challenge.hints : []
    const hint = hints[parsed.data.hint_index]
    if (typeof hint !== "string") {
      return NextResponse.json({ error: "Tokios užuominos nėra" }, { status: 400 })
    }

    const { error: insertError } = await supabase.from("hint_reveals").insert({
      team_id: team.id,
      challenge_id: parsed.data.challenge_id,
      hint_index: parsed.data.hint_index,
    })

    // 23505 = already revealed (idempotent). 42P01 = table missing (migration
    // 00024 not applied) — degrade gracefully; the submission API then falls
    // back to the client-declared hint count.
    if (insertError && insertError.code !== "23505") {
      if (insertError.code === "42P01") {
        return NextResponse.json({ ok: false, tracked: false, hint })
      }
      console.error("hint reveal insert failed:", insertError.message)
      return NextResponse.json({ error: "Serverio klaida" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, tracked: true, hint })
  } catch (err) {
    console.error("play/hint exception:", err)
    return NextResponse.json({ error: "Serverio klaida" }, { status: 500 })
  }
}
