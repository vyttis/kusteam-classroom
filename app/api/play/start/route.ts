import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"
import { retryLater } from "@/lib/api/retry-later"

// POST /api/play/start — stamp the team's timed-run start, once.
//
// The player time limit is enforced server-side against teams.started_at
// (/api/submissions). The client calls this when the team taps "Pradėti" (and
// on reload of an already-started timed game) so the deadline is anchored on a
// server timestamp the student can't tamper with. Idempotent: started_at is
// only set while NULL, so repeated calls never reset the clock. Returns the
// start and the pause offset the participant countdown needs.
const startSchema = z.object({
  session_token: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Netinkamas užklausos formatas" }, { status: 400 })
    }

    const parsed = startSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Neteisingi duomenys" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, game_id, started_at, pause_offset_ms")
      .eq("session_token", parsed.data.session_token)
      .maybeSingle()
    if (teamError) return retryLater("play/start team", teamError)
    if (!team) return NextResponse.json({ error: "Komanda nerasta" }, { status: 404 })

    if (team.started_at) {
      return NextResponse.json({ started_at: team.started_at, pause_offset_ms: Number(team.pause_offset_ms ?? 0) })
    }

    // Only stamp while NULL: a second device or a reload never resets the
    // clock. The database stamps the pause offset in the same update
    // (trigger teams_pause_offset), so a team only gets back pauses that
    // happen after it starts.
    const { data: updated, error } = await supabase
      .from("teams")
      .update({ started_at: new Date().toISOString() })
      .eq("id", team.id)
      .is("started_at", null)
      .select("started_at, pause_offset_ms")
      .maybeSingle()
    if (error) {
      console.error("play/start error:", error.message)
      return NextResponse.json({ error: "Serverio klaida" }, { status: 500 })
    }
    if (updated?.started_at) {
      return NextResponse.json({ started_at: updated.started_at, pause_offset_ms: Number(updated.pause_offset_ms ?? 0) })
    }

    // Another request stamped it first: return that start.
    const { data: existing } = await supabase
      .from("teams")
      .select("started_at, pause_offset_ms")
      .eq("id", team.id)
      .maybeSingle()
    return NextResponse.json({
      started_at: existing?.started_at ?? null,
      pause_offset_ms: Number(existing?.pause_offset_ms ?? 0),
    })
  } catch (err) {
    console.error("play/start exception:", err)
    return NextResponse.json({ error: "Serverio klaida" }, { status: 500 })
  }
}
