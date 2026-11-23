import { createAdminClient } from "@/lib/supabase/admin"
import { tasksVersion } from "@/lib/game/tasks-version"
import { NextResponse } from "next/server"
import { retryLater } from "@/lib/api/retry-later"

// A participant gets the latest announcement this long after it was sent: a
// phone that was locked, or a team that reloads or joins later, still sees
// it. The banner stays until closed and shows when it was sent.
const ANNOUNCEMENT_WINDOW_MS = 15 * 60 * 1000

// Every phone of a class asks every 5 s (30 phones: 6 requests a second).
// The answer is the same for all of them (the cache key is the URL, so the
// activity code), so the CDN keeps it for 2 s, like the leaderboard: the
// database is asked at most once every 2 s per activity (PERF-02, N-2).
// - A pause or the end reaches a phone at most 2 s later than without it.
// - No stale-while-revalidate on purpose: with one phone asking every 5 s it
//   would always be served the previous answer, a whole poll late.
// - "now" in a cached answer is up to 2 s old; the CDN's Age header says by
//   how much and the page adds it back (lib/game/clock.ts, serverNowMs).
// - Browsers do not keep it. Only the 200 answer of an existing activity is
//   shared; errors and "no such activity" are no-store.
const STATUS_CDN_SECONDS = 2
const STATUS_CACHE_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": `public, s-maxage=${STATUS_CDN_SECONDS}`,
  "Vercel-CDN-Cache-Control": `public, s-maxage=${STATUS_CDN_SECONDS}`,
}

// GET /api/play/status?game_code=XXXXXX — lightweight game-status poll for
// the player page. Participants cannot read activities with the anon key
// (20261107120000), so this is how the play page learns about a pause, more
// time, changed tasks and the facilitator's latest announcement.
//
// The answer depends on the activity code only: this route never reads the
// team's token (x-session-token), cookies or anything else about the caller,
// and it holds no answers, hashes or hints. That is what lets the CDN share
// one answer between all phones of a class (see the headers below, N-2).
// Anything per team belongs in /api/play/state, which is never shared.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameCode = searchParams.get("game_code")?.toUpperCase()

  if (!gameCode || gameCode.length < 6) {
    return NextResponse.json({ error: "game_code privalomas" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { data: game, error } = await supabase
      .from("games")
      .select(
        "status, settings, paused_ms, paused_at, resumed_at, challenges(id, updated_at), announcements(id, message, created_at)"
      )
      .eq("game_code", gameCode)
      .order("created_at", { referencedTable: "announcements", ascending: false })
      .limit(1, { referencedTable: "announcements" })
      .maybeSingle()

    // A failed read is not "the activity was deleted": 503 (never cached)
    // counts as a failed poll on the phone, and the next one asks again.
    if (error) return retryLater("play/status game", error)

    if (!game) {
      return NextResponse.json(
        { status: null },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    const settings =
      (game.settings as { time_limit_minutes?: number | null; allow_access_requests?: boolean }) || {}
    const now = new Date()
    const latest = (game.announcements as { id: string; message: string; created_at: string }[] | null)?.[0]
    const announcement =
      latest &&
      (game.status === "active" || game.status === "paused") &&
      now.getTime() - Date.parse(latest.created_at) < ANNOUNCEMENT_WINDOW_MS
        ? { id: latest.id, message: latest.message, created_at: latest.created_at }
        : null

    return NextResponse.json(
      {
        status: game.status,
        time_limit_minutes: settings.time_limit_minutes ?? null,
        allow_access_requests: settings.allow_access_requests === true,
        // Clock: pauses stop the countdown (lib/game/clock.ts). now lets
        // the phone correct for its own clock being off.
        paused_ms: Number(game.paused_ms ?? 0),
        paused_at: game.paused_at ?? null,
        // When the last pause ended: the facilitator's page counts the
        // "stuck" time from it.
        resumed_at: game.resumed_at ?? null,
        now: now.toISOString(),
        // Changes when a task is added, removed or saved: the phone then
        // reloads the tasks. Hidden before the start, like the tasks.
        tasks_version: game.status === "draft" ? null : tasksVersion(game.challenges),
        // The latest announcement of the last 15 minutes (the banner shows it
        // until the participant closes it, once).
        announcement,
      },
      {
        headers: STATUS_CACHE_HEADERS,
      }
    )
  } catch (e) {
    console.error("play/status exception:", e instanceof Error ? e.message : e)
    return NextResponse.json(
      { error: "Serverio klaida" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
