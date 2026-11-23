"use client"

import { useEffect, useState } from "react"
import type { GameClock } from "@/lib/game/clock"
import type { TeamClock } from "@/lib/game/team-time"

/** How often the team starts are read again while a timed activity runs. */
export const TEAM_CLOCKS_POLL_MS = 15_000

export interface TeamClocks {
  /** The activity's clock as the server has it; null until the first answer. */
  clock: GameClock | null
  /** Start of the activity (games.starts_at). */
  startsAt: string | null
  /** Every team's own start, by team id. */
  teams: Map<string, TeamClock>
  /** Server time minus this device's time, in ms. */
  skewMs: number
}

const EMPTY: TeamClocks = { clock: null, startsAt: null, teams: new Map(), skewMs: 0 }

/**
 * Each team's own start for the facilitator's screens (the time limit runs
 * per team, audit R-12), from /api/games/[gameId]/team-clocks. Read when
 * enabled, when the number of teams changes and every 15 s: a team's start
 * is set once, when it presses "Pradėti". A failed read keeps what was
 * known. `refreshKey` is any value that changes when a new read is due.
 */
export function useTeamClocks(gameId: string, enabled: boolean, refreshKey: string | number = 0): TeamClocks {
  const [state, setState] = useState<TeamClocks>(EMPTY)

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let inFlight = false
    const read = async () => {
      if (inFlight) return
      inFlight = true
      const sentAt = Date.now()
      try {
        const res = await fetch(`/api/games/${gameId}/team-clocks`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as {
          time_limit_minutes?: number | null
          starts_at?: string | null
          paused_ms?: number
          paused_at?: string | null
          now?: string
          teams?: { id: string; started_at: string | null; pause_offset_ms: number }[]
        }
        if (disposed) return
        const receivedAt = Date.now()
        const serverNow = data.now ? Date.parse(data.now) : NaN
        setState((prev) => ({
          clock: {
            limitMinutes: typeof data.time_limit_minutes === "number" && data.time_limit_minutes > 0 ? data.time_limit_minutes : null,
            pausedMs: Number(data.paused_ms ?? 0) || 0,
            pausedAt: data.paused_at ?? null,
          },
          startsAt: data.starts_at ?? null,
          teams: new Map(
            (data.teams ?? []).map((t) => [t.id, { startedAt: t.started_at, pauseOffsetMs: Number(t.pause_offset_ms) || 0 }])
          ),
          // Only a quick round trip says something about this device's clock.
          skewMs: Number.isFinite(serverNow) && receivedAt - sentAt < 2000 ? serverNow - (sentAt + receivedAt) / 2 : prev.skewMs,
        }))
      } catch {
        // The next round retries.
      } finally {
        inFlight = false
      }
    }
    void read()
    const interval = setInterval(read, TEAM_CLOCKS_POLL_MS)
    return () => {
      disposed = true
      clearInterval(interval)
    }
  }, [gameId, enabled, refreshKey])

  return enabled ? state : EMPTY
}
