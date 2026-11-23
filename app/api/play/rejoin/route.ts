import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkAiRateLimitAsync } from "@/lib/ai/rate-limit"
import { verifyRejoinToken } from "@/lib/game/rejoin-token"
import { clientKey } from "@/lib/client-address"
import { retryLater } from "@/lib/api/retry-later"

const rejoinSchema = z.object({
  game_code: z.string().length(6),
  token: z.string().min(1).max(200),
})

/**
 * POST — exchange a rejoin link from the facilitator for the team's session
 * on this device. The link is signed and expires after ten minutes; the team
 * must still exist and its activity must still run.
 */
export async function POST(request: Request) {
  const client = clientKey(request)
  if (!(await checkAiRateLimitAsync("rejoin-ip", client, 60, 60_000))) {
    return NextResponse.json({ error: "Per daug bandymų. Palaukite minutę." }, { status: 429 })
  }

  const parsed = rejoinSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Neteisinga nuoroda." }, { status: 400 })

  const check = verifyRejoinToken(parsed.data.token)
  if (!check.ok) {
    return NextResponse.json(
      check.reason === "expired"
        ? { error: "Nuoroda nebegalioja. Paprašykite vedėjo naujos.", code: "expired" }
        : { error: "Neteisinga nuoroda.", code: "invalid" },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, session_token, games!inner(game_code, status)")
    .eq("id", check.teamId)
    .maybeSingle()
  // A failed read is not "the team was removed": the link still works.
  if (teamError) return retryLater("play/rejoin team", teamError)
  const game = (team?.games ?? null) as unknown as { game_code: string; status: string } | null
  if (!team || !game || game.game_code !== parsed.data.game_code.toUpperCase()) {
    return NextResponse.json({ error: "Komanda nerasta. Gal ji buvo pašalinta?", code: "not_found" }, { status: 404 })
  }
  if (game.status !== "active" && game.status !== "paused") {
    return NextResponse.json({ error: "Veikla jau baigta.", code: "not_live" }, { status: 409 })
  }

  return NextResponse.json(
    { team_id: team.id, team_name: team.name, session_token: team.session_token },
    { headers: { "Cache-Control": "no-store" } }
  )
}
