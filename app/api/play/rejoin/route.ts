import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkAiRateLimitAsync } from "@/lib/ai/rate-limit"
import { rejoinTokenUnused, verifyRejoinToken } from "@/lib/game/rejoin-token"
import { generateSessionToken } from "@/lib/game/code-generator"
import { clientKey } from "@/lib/client-address"
import { retryLater } from "@/lib/api/retry-later"

const rejoinSchema = z.object({
  game_code: z.string().length(6),
  token: z.string().min(1).max(200),
})

// A response body is read once, so every request gets its own.
const used = () =>
  NextResponse.json(
    { error: "Ši nuoroda jau panaudota. Paprašykite vedėjo naujos.", code: "used" },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  )

/**
 * POST — exchange a rejoin link from the facilitator for the team's session
 * on this device. The link is signed, expires after ten minutes and works
 * once; the team must still exist and its activity must still run.
 *
 * The team gets a new session token here, so its session moves: the device
 * that had it before is signed out (its next request finds no team, and
 * /api/play/state tells it the team continues elsewhere), and the link,
 * which is tied to the old token, cannot be used again. The swap is one
 * conditional update, so of two devices opening the same link at once only
 * one gets the session.
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

  // The team's session changed since the link was made: it was used.
  const current = team.session_token as string
  if (!rejoinTokenUnused(check.binding, current)) return used()

  // Only while the team still has the token the link was made for: of two
  // requests with the same link, one changes the row and the other finds
  // nothing to change.
  const sessionToken = generateSessionToken()
  const { data: moved, error: moveError } = await supabase
    .from("teams")
    .update({ session_token: sessionToken })
    .eq("id", team.id)
    .eq("session_token", current)
    .select("id")
  // Nothing was changed: the link still works, the page may try again.
  if (moveError) return retryLater("play/rejoin move", moveError)
  if (!moved || moved.length === 0) return used()

  return NextResponse.json(
    { team_id: team.id, team_name: team.name, session_token: sessionToken },
    { headers: { "Cache-Control": "no-store" } }
  )
}
