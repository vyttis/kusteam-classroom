/**
 * One time rule for the server deadline, the participant countdown and the
 * class screen. Pauses stop the clock: games.paused_ms holds the finished
 * pauses, games.paused_at a pause in progress, and teams.pause_offset_ms
 * how much pause had already passed when the team started. A team gets back
 * only the pause time that fell inside its own run.
 */

export interface GameClock {
  /** Time limit in minutes; null or 0 means no limit. */
  limitMinutes: number | null
  /** Milliseconds of finished pauses. */
  pausedMs: number
  /** Start of the pause in progress (ISO), or null. */
  pausedAt: string | null
}

export function clockFromRow(row: {
  settings?: { time_limit_minutes?: number | null } | null
  paused_ms?: number | string | null
  paused_at?: string | null
}): GameClock {
  const limit = row.settings?.time_limit_minutes
  return {
    limitMinutes: typeof limit === "number" && limit > 0 ? limit : null,
    pausedMs: Number(row.paused_ms ?? 0) || 0,
    pausedAt: row.paused_at ?? null,
  }
}

/** Total pause time so far, including a pause in progress. */
export function totalPausedMs(clock: GameClock, nowMs: number): number {
  const running = clock.pausedAt ? Math.max(0, nowMs - Date.parse(clock.pausedAt)) : 0
  return clock.pausedMs + running
}

/** Pause time that counts for someone who started with this offset. */
export function pauseCreditMs(clock: GameClock, offsetMs: number, nowMs: number): number {
  return Math.max(0, totalPausedMs(clock, nowMs) - offsetMs)
}

/**
 * When the run that started at startedAtMs ends, or null without a limit.
 * While paused the deadline moves with the clock, so the time left stands
 * still.
 */
export function deadlineMs(clock: GameClock, startedAtMs: number, offsetMs: number, nowMs: number): number | null {
  if (!clock.limitMinutes) return null
  return startedAtMs + clock.limitMinutes * 60_000 + pauseCreditMs(clock, offsetMs, nowMs)
}

/** Whole seconds left (never negative), or null without a limit. */
export function secondsLeft(clock: GameClock, startedAtMs: number, offsetMs: number, nowMs: number): number | null {
  const end = deadlineMs(clock, startedAtMs, offsetMs, nowMs)
  if (end === null) return null
  return Math.max(0, Math.ceil((end - nowMs) / 1000))
}

/** Running time without pauses, in whole seconds (class screen without a limit). */
export function secondsRunning(clock: GameClock, startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs - totalPausedMs(clock, nowMs)) / 1000))
}

/** The pause offset to store when a team starts now. */
export function pauseOffsetAtStart(clock: GameClock, nowMs: number): number {
  return totalPausedMs(clock, nowMs)
}

/**
 * The server's time when a status answer reached the phone. The answer may
 * come from the CDN (/api/play/status is shared for a couple of seconds), so
 * its "now" is older by what the Age header says. Without the header, or
 * with a broken one, "now" is taken as it is. NaN when "now" is missing.
 */
export function serverNowMs(nowIso: string | null | undefined, ageHeader: string | null | undefined): number {
  const now = nowIso ? Date.parse(nowIso) : NaN
  if (!Number.isFinite(now)) return NaN
  const age = ageHeader ? Number(ageHeader) : 0
  // A cached answer lives a few seconds; anything else is not ours to trust.
  return now + (Number.isFinite(age) && age > 0 && age <= 60 ? age * 1000 : 0)
}
