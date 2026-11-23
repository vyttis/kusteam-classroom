import { secondsLeft, type GameClock } from "@/lib/game/clock"

/**
 * What the facilitator's screens say about time. A time limit belongs to
 * each team: it runs from the team's own "Pradėti" (teams.started_at), not
 * from the start of the activity, so two teams of one class can have
 * different deadlines (audit R-12). These helpers turn the server's team
 * starts into what is shown; the rule itself is lib/game/clock.ts.
 */

export interface TeamClock {
  /** When the team pressed "Pradėti" (ISO), or null: not yet. */
  startedAt: string | null
  /** Pause time that had passed when it started (teams.pause_offset_ms). */
  pauseOffsetMs: number
}

export type TeamTime =
  /** Joined, but has not pressed "Pradėti": its clock is not running. */
  | { kind: "not-started" }
  | { kind: "running"; secondsLeft: number }
  /** Its time is up: the server refuses its answers. */
  | { kind: "over" }

/** A team's time, or null when the activity has no limit. */
export function teamTime(clock: GameClock, team: TeamClock, nowMs: number): TeamTime | null {
  if (!clock.limitMinutes) return null
  const startMs = team.startedAt ? Date.parse(team.startedAt) : NaN
  if (!Number.isFinite(startMs)) return { kind: "not-started" }
  const left = secondsLeft(clock, startMs, team.pauseOffsetMs, nowMs) ?? 0
  return left > 0 ? { kind: "running", secondsLeft: left } : { kind: "over" }
}

/**
 * Seconds until the last deadline among the teams that have started, or
 * null when none has (or there is no limit). 0 when all of them are over.
 */
export function latestTeamSecondsLeft(clock: GameClock, teams: Iterable<TeamClock>, nowMs: number): number | null {
  let latest: number | null = null
  for (const team of teams) {
    const time = teamTime(clock, team, nowMs)
    if (!time || time.kind === "not-started") continue
    const left = time.kind === "running" ? time.secondsLeft : 0
    if (latest === null || left > latest) latest = left
  }
  return latest
}

/** "07:05", or "1:02:03" from an hour up. */
export function formatClock(totalSeconds: number): string {
  const abs = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

/** The line on a team's card in the facilitator's control centre. */
export function teamTimeLabel(time: TeamTime): string {
  if (time.kind === "not-started") return "Laikas dar neskaičiuojamas: komanda nepradėjo"
  if (time.kind === "over") return "Komandos laikas baigėsi"
  return `Komandai liko ${formatClock(time.secondsLeft)}`
}
