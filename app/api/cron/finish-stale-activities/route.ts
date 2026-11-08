import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { STALE_MIN_AGE_MS, isStaleActivity, latest } from "@/lib/game/stale"
import { retentionMode, runRetention, type RetentionSummary } from "@/lib/retention"

export const maxDuration = 60

const PAGE_SIZE = 200
/** Headroom under maxDuration. */
const TIME_BUDGET_MS = 45_000

type LiveGame = {
  id: string
  title: string
  status: string
  teacher_id: string
  starts_at: string | null
  created_at: string
  updated_at: string
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * GET (Vercel Cron, nightly): finishes activities left running after a
 * lesson, see lib/game/stale.ts for the rule. Same effect as the admin
 * "Baigti" (results stay, the database keeps the pause time), written to
 * the admin audit log as game_auto_finish without an actor.
 *
 * Then data retention (lib/retention.ts, CLS-017 and CLS-018) in the time
 * that is left: counts only, unless RETENTION_MODE=delete.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  // Without a secret nobody may run it (fail closed).
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 })
  if (!authorized(request, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const now = Date.now()
  const startedBefore = new Date(now - STALE_MIN_AGE_MS).toISOString()
  let checked = 0
  let finished = 0
  let failed = 0
  let cursor: string | null = null
  // Why the run stopped before seeing every candidate, if it did.
  let stopped: "time_budget" | "list_failed" | null = null
  const overBudget = () => Date.now() - now > TIME_BUDGET_MS

  // Candidates in id order, a page at a time, so every one is seen even
  // when there are many. The time budget is checked before each page and
  // each activity, so near the limit the rest waits a night instead of
  // being cut off.
  pages: for (;;) {
    if (cursor && overBudget()) {
      stopped = "time_budget"
      break
    }
    let query = admin
      .from("games")
      .select("id, title, status, teacher_id, starts_at, created_at, updated_at")
      .in("status", ["active", "paused"])
      .or(`starts_at.lt.${startedBefore},and(starts_at.is.null,created_at.lt.${startedBefore})`)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE)
    if (cursor) query = query.gt("id", cursor)
    const { data, error } = await query
    if (error) {
      console.error(JSON.stringify({ event: "auto_finish_list_failed", code: error.code }))
      stopped = "list_failed"
      break
    }
    const games = (data ?? []) as LiveGame[]
    for (const game of games) {
      if (overBudget()) {
        stopped = "time_budget"
        break pages
      }
      const result = await finishIfStale(admin, game, now)
      checked++
      if (result === "finished") finished++
      if (result === "failed") failed++
    }
    if (games.length < PAGE_SIZE) break
    cursor = games[games.length - 1].id
  }

  const summary = { checked, finished, failed, incomplete: stopped !== null, stopped }
  console.log(JSON.stringify({ event: "auto_finish_done", ...summary }))

  let retention: RetentionSummary | { failed: string[] }
  try {
    retention = await runRetention(admin, { now: new Date(now), mode: retentionMode(), overBudget })
  } catch (e) {
    console.error(JSON.stringify({ event: "retention_error", message: e instanceof Error ? e.message : "unknown" }))
    retention = { failed: ["error"] }
  }
  console.log(JSON.stringify({ event: "retention_done", ...retention }))

  // A read failure means activities were skipped: report it as a failed run.
  const runFailed = stopped === "list_failed" || retention.failed.length > 0
  return NextResponse.json({ ...summary, retention }, { status: runFailed ? 500 : 200 })
}

async function finishIfStale(
  admin: ReturnType<typeof createAdminClient>,
  game: LiveGame,
  now: number,
): Promise<"finished" | "kept" | "failed"> {
  const [teamRes, subRes] = await Promise.all([
    admin.from("teams").select("joined_at").eq("game_id", game.id).order("joined_at", { ascending: false }).limit(1),
    admin
      .from("submissions")
      .select("attempted_at, teams!inner(game_id)")
      .eq("teams.game_id", game.id)
      .order("attempted_at", { ascending: false })
      .limit(1),
  ])
  // A failed read is not proof of silence: leave this activity alone.
  if (teamRes.error || subRes.error) return "failed"

  const startedAt = game.starts_at ?? game.created_at
  const lastActivityAt =
    latest(game.updated_at, teamRes.data?.[0]?.joined_at, subRes.data?.[0]?.attempted_at) ?? startedAt
  if (!isStaleActivity({ startedAt, lastActivityAt }, now)) return "kept"

  // Only if the activity row is unchanged since it was read: a pause,
  // resume or extension in between keeps it running. A first answer or
  // join in the same few milliseconds is not covered (no lock across
  // tables); after two quiet hours at night that is accepted.
  const { data: updated, error: updateError } = await admin
    .from("games")
    .update({ status: "finished" })
    .eq("id", game.id)
    .in("status", ["active", "paused"])
    .eq("updated_at", game.updated_at)
    .select("id")
  if (updateError) {
    console.error(JSON.stringify({ event: "auto_finish_failed", game: game.id, code: updateError.code }))
    return "failed"
  }
  // Finished or changed meanwhile by the facilitator or an administrator.
  if (!updated || updated.length === 0) return "kept"

  const { error: auditError } = await admin.from("admin_audit_log").insert({
    actor_id: null,
    action: "game_auto_finish",
    target_type: "game",
    target_id: game.id,
    details: {
      title: game.title,
      previous_status: game.status,
      teacher_id: game.teacher_id,
      started_at: startedAt,
      last_activity_at: lastActivityAt,
    },
  })
  if (auditError) console.error(JSON.stringify({ event: "auto_finish_audit_failed", code: auditError.code }))
  return "finished"
}
