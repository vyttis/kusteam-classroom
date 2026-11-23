import { createAdminClient } from "@/lib/supabase/admin"
import { generateSessionToken } from "@/lib/game/code-generator"
import { checkAiRateLimitAsync } from "@/lib/ai/rate-limit"
import { NextResponse } from "next/server"
import { z } from "zod"
import { clientKey } from "@/lib/client-address"
import { retryLater } from "@/lib/api/retry-later"
import { clockFromRow, joiningTimeOver } from "@/lib/game/clock"

const createTeamSchema = z.object({
  game_code: z.string().length(6),
  team_name: z.string().min(1, "Komandos vardas privalomas").max(30),
})

// A whole class often joins from one school network (one public IP), and
// a retry after a taken name counts as another attempt. So the limit is per
// IP and activity code, generous enough for a workshop of 50 teams with
// retries, with a wider ceiling per IP across all codes.
const RATE_PER_GAME = 150
const RATE_PER_IP = 400
const RATE_WINDOW = 60_000

export async function POST(request: Request) {
  try {
    const client = clientKey(request)

    // The wide per-IP ceiling counts every request, also malformed ones,
    // so it runs before the body is read.
    if (!(await checkAiRateLimitAsync("teams-ip", client, RATE_PER_IP, RATE_WINDOW))) {
      return NextResponse.json(
        { error: "Per daug bandymų prisijungti. Palaukite minutę." },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Netinkamas užklausos formatas" }, { status: 400 })
    }

    const parsed = createTeamSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Neteisingi duomenys"
      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      )
    }

    const gameKey = `${client}:${parsed.data.game_code.toUpperCase()}`
    if (!(await checkAiRateLimitAsync("teams", gameKey, RATE_PER_GAME, RATE_WINDOW))) {
      return NextResponse.json(
        { error: "Per daug bandymų prisijungti. Palaukite minutę." },
        { status: 429 }
      )
    }

    const supabase = createAdminClient()

    // Find the active game
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, settings, starts_at, paused_ms, paused_at")
      .eq("game_code", parsed.data.game_code)
      .eq("status", "active")
      .maybeSingle()

    // Only a read that failed is an error (logged, 503, try again).
    if (gameError) return retryLater("teams game", gameError)

    // A mistyped code, or an activity that has not started, is paused or has
    // ended: an expected answer for a participant, so nothing is logged (a
    // class mistyping codes must not look like server errors).
    if (!game) {
      return NextResponse.json(
        { error: "Veikla nerasta arba dar neprasidėjo. Patikrinkite kodą." },
        { status: 404 }
      )
    }

    // Check max teams
    const { count: teamCount } = await supabase
      .from("teams")
      .select("*", { count: "exact", head: true })
      .eq("game_id", game.id)

    const settings = game.settings as Record<string, unknown> | null
    // The facilitator closed joining once the class was in.
    if (settings?.joining_closed === true) {
      return NextResponse.json(
        {
          error: "Vedėjas uždarė prisijungimą prie šios veiklos. Jei jūsų komanda dar neprisijungė, kreipkitės į vedėją.",
          code: "joining_closed",
        },
        { status: 403 }
      )
    }
    // A timed activity whose limit, counted from its own start (pauses
    // added back), has passed takes no new teams: without this a forgotten
    // activity kept accepting them until the nightly clean-up, each with a
    // fresh full limit (audit R-12). It is the moment the class screen's
    // countdown reaches zero. Teams already in keep their own time from
    // their "Pradėti", and the facilitator's "Pratęsti" opens joining again.
    if (joiningTimeOver(clockFromRow(game as Parameters<typeof clockFromRow>[0]), game.starts_at as string | null, Date.now())) {
      return NextResponse.json(
        {
          error:
            "Šios veiklos laikas baigėsi, todėl naujos komandos nebepriimamos. Jei veikla dar vyksta, kreipkitės į vedėją.",
          code: "time_over",
        },
        { status: 403 }
      )
    }
    const maxTeams = (settings?.max_teams as number) || 50
    if (teamCount && teamCount >= maxTeams) {
      return NextResponse.json(
        { error: "Veikloje jau visos vietos užimtos: pasiektas didžiausias komandų skaičius." },
        { status: 400 }
      )
    }

    // Check if team name is taken
    const { data: existingTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("game_id", game.id)
      .eq("name", parsed.data.team_name)
      .maybeSingle()

    if (existingTeam) {
      return NextResponse.json(
        { error: "Šis komandos vardas jau užimtas. Pasirinkite kitą." },
        { status: 400 }
      )
    }

    const sessionToken = generateSessionToken()

    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        game_id: game.id,
        name: parsed.data.team_name,
        session_token: sessionToken,
      })
      .select()
      .single()

    if (error) {
      // Two students can submit the same name at once — both pass the
      // pre-check above, the loser hits unique(game_id, name).
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Šis komandos vardas jau užimtas. Pasirinkite kitą." },
          { status: 400 }
        )
      }
      console.error("Team insert failed:", error.message)
      return NextResponse.json({ error: "Nepavyko sukurti komandos" }, { status: 500 })
    }

    // The count above is read before the insert, so teams joining at the
    // same moment can pass it together. Keep the first maxTeams teams in
    // joining order and take back a place this request was not entitled to.
    const { data: firstTeams, error: rankError } = await supabase
      .from("teams")
      .select("id")
      .eq("game_id", game.id)
      .order("joined_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(maxTeams)
    if (!rankError && firstTeams && !firstTeams.some((t) => t.id === team.id)) {
      await supabase.from("teams").delete().eq("id", team.id)
      return NextResponse.json(
        { error: "Veikloje jau visos vietos užimtos: pasiektas didžiausias komandų skaičius." },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        team_id: team.id,
        session_token: sessionToken,
        game_id: game.id,
        team_name: team.name,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("Teams API error:", err)
    return NextResponse.json(
      { error: "Serverio klaida. Bandykite dar kartą." },
      { status: 500 }
    )
  }
}
