"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { allRowsById } from "@/lib/supabase/all-pages"
import { useSubmissionFilter } from "@/hooks/use-submission-filter"
import {
  FALLBACK_POLL_MS,
  SAFETY_REFETCH_MS,
  channelStatusAction,
  isDatabaseStreamReady,
  mergeRowsAfterRead,
  type RecentRow,
  type LiveConnectionState,
} from "@/hooks/live-channel"

export interface LiveTeam {
  id: string
  name: string
  total_points: number
  current_challenge_index: number
  joined_at: string
}

export type { LiveConnectionState }

interface UseLiveGameResult {
  teams: LiveTeam[]
  // Unique correct solves per team (current_challenge_index only advances in
  // linear path mode, so free-mode counts must come from submissions)
  solvedCounts: Map<string, number>
  lastSubmissions: Map<string, string>
  /** The answer history of the current activity has been read. */
  historyLoaded: boolean
  connectionState: LiveConnectionState
  retry: () => void
}

// Shared realtime data layer for the teacher live views (dashboard control
// center and projector board): teams + solved counts + last activity, with
// realtime subscriptions and a polling fallback when the channel degrades.
// `running` is false once the activity is finished: nothing changes any
// more, so the slow safety read stops.
export function useLiveGame(gameId: string, running = true): UseLiveGameResult {
  const [teams, setTeams] = useState<LiveTeam[]>([])
  // Mirror of the known team ids for cheap membership checks inside realtime
  // callbacks (avoids a DB round-trip per submission event)
  const teamIdsRef = useRef<Set<string>>(new Set())
  teamIdsRef.current = new Set(teams.map((t) => t.id))
  const [solvedSets, setSolvedSets] = useState<Map<string, Set<string>>>(new Map())
  const [lastSubmissions, setLastSubmissions] = useState<Map<string, string>>(new Map())
  const [connectionState, setConnectionState] = useState<LiveConnectionState>("connecting")
  // The activity whose answer history has been read: until then nobody can
  // be told apart from a team that never answered.
  const [historyGameId, setHistoryGameId] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)
  // The activity whose answers the state above holds.
  const stateGameRef = useRef<string | null>(null)

  const retry = useCallback(() => setRetryNonce((n) => n + 1), [])

  // Teams that came over realtime lately: a full read that was already on
  // its way when they arrived must not drop them (mergeRowsAfterRead).
  const recentTeamsRef = useRef<Map<string, RecentRow<LiveTeam>>>(new Map())

  const fetchInitialData = useCallback(async () => {
    const supabase = createClient()
    const readStartedAt = Date.now()

    const { data: teamsData, error } = await supabase
      .from("teams")
      .select("id, name, total_points, current_challenge_index, joined_at")
      .eq("game_id", gameId)
      .order("total_points", { ascending: false })

    if (error) throw error
    if (!teamsData) return

    const recent = recentTeamsRef.current
    for (const [id, r] of recent) {
      if (r.at < readStartedAt - 120_000) recent.delete(id)
    }
    const merged = mergeRowsAfterRead<LiveTeam>(teamsData, recent.values(), readStartedAt)
    setTeams(merged === teamsData ? teamsData : [...merged].sort((a, b) => b.total_points - a.total_points))

    const teamIds = teamsData.map((t) => t.id)
    if (teamIds.length === 0) {
      setHistoryGameId(gameId)
      return
    }

    // All answers, past the 1000-row page limit, read in id order so new
    // answers arriving meanwhile cannot shift a page. A failed read throws,
    // so the caller keeps the last good state and retries.
    const { data: subs, error: subsError } = await allRowsById<{
      id: string
      team_id: string
      challenge_id: string
      is_correct: boolean
      attempted_at: string
    }>(() =>
      supabase
        .from("submissions")
        .select("id, team_id, challenge_id, is_correct, attempted_at")
        .in("team_id", teamIds)
    )
    if (!subs) throw subsError

    const latestMap = new Map<string, string>()
    const solvedMap = new Map<string, Set<string>>()
    for (const sub of subs) {
      const latest = latestMap.get(sub.team_id)
      if (!latest || Date.parse(sub.attempted_at) > Date.parse(latest)) {
        latestMap.set(sub.team_id, sub.attempted_at)
      }
      if (sub.is_correct) {
        if (!solvedMap.has(sub.team_id)) solvedMap.set(sub.team_id, new Set())
        solvedMap.get(sub.team_id)!.add(sub.challenge_id)
      }
    }
    // Merge with what realtime delivered meanwhile instead of replacing it:
    // an answer can arrive after the id-ordered read has passed its place.
    // Both only grow (a solve is never taken back), so the union and the
    // later time are always right. State held for another activity is
    // replaced.
    const sameGame = stateGameRef.current === gameId
    stateGameRef.current = gameId
    setLastSubmissions((prev) => {
      if (!sameGame) return latestMap
      const next = new Map(latestMap)
      for (const [teamId, at] of prev) {
        const snap = next.get(teamId)
        if (!snap || Date.parse(at) > Date.parse(snap)) next.set(teamId, at)
      }
      return next
    })
    setSolvedSets((prev) => {
      if (!sameGame) return solvedMap
      const next = new Map(solvedMap)
      for (const [teamId, solved] of prev) {
        next.set(teamId, new Set([...(next.get(teamId) ?? []), ...solved]))
      }
      return next
    })
    setHistoryGameId(gameId)
  }, [gameId])

  // Only this activity's answers come over realtime (FAC-10). Wait for the
  // task list before subscribing; a new task subscribes again.
  const { filter: submissionFilter } = useSubmissionFilter(gameId)

  useEffect(() => {
    if (submissionFilter === undefined) return
    const supabase = createClient()
    let pollInterval: NodeJS.Timeout | null = null
    let cancelled = false

    function startPolling() {
      if (pollInterval) return
      pollInterval = setInterval(() => {
        fetchInitialData().catch(() => {})
      }, FALLBACK_POLL_MS)
    }

    function stopPolling() {
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    }

    fetchInitialData()
      .then(() => {
        if (!cancelled) setConnectionState((s) => (s === "connecting" ? "live" : s))
      })
      .catch(() => {
        if (!cancelled) {
          setConnectionState("degraded")
          startPolling()
        }
      })

    // One channel carries team and answer changes (PERF-03): it is either
    // subscribed or not, so the board is never "live" over half its data.
    // A full read that failed means the board may be behind: say so and
    // keep reading until one succeeds.
    const refetchOrDegrade = () => {
      fetchInitialData().catch(() => {
        if (cancelled) return
        setConnectionState("degraded")
        startPolling()
      })
    }

    let subscribedBefore = false
    const handleStatus = (status: string) => {
      if (cancelled) return
      const action = channelStatusAction(status, subscribedBefore)
      if (status === "SUBSCRIBED") subscribedBefore = true
      if (action.state) setConnectionState(action.state)
      if (action.polling === "start") startPolling()
      if (action.polling === "stop") stopPolling()
      // Subscribed again after an error, a timeout or a close: answers given
      // during the gap never come over the channel, so read everything.
      if (action.refetch) refetchOrDegrade()
    }

    // The channel can lose events without reporting anything (a proxy that
    // drops the socket silently). A slow full read bounds how long the
    // board can stay behind while the activity runs.
    const safetyInterval = running
      ? setInterval(() => {
          if (cancelled || document.visibilityState !== "visible") return
          fetchInitialData().catch(() => {})
        }, SAFETY_REFETCH_MS)
      : null

    const channel = supabase
      .channel(`live_game_${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newTeam = payload.new as LiveTeam
            recentTeamsRef.current.set(newTeam.id, { row: newTeam, at: Date.now() })
            setTeams((prev) =>
              [...prev.filter((t) => t.id !== newTeam.id), newTeam].sort(
                (a, b) => b.total_points - a.total_points
              )
            )
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as LiveTeam
            setTeams((prev) =>
              prev
                .map((t) => (t.id === updated.id ? updated : t))
                .sort((a, b) => b.total_points - a.total_points)
            )
          }
        }
      )
      // DELETE events cannot be filtered by game (they carry only the id), so
      // a filtered subscription never sees them. Listen to all and drop the
      // team if it is one of ours; every screen using this hook follows.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "teams" },
        (payload) => {
          const removedId = (payload.old as { id?: string }).id
          if (removedId) recentTeamsRef.current.delete(removedId)
          if (removedId) setTeams((prev) => prev.filter((t) => t.id !== removedId))
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "submissions",
          ...(submissionFilter ? { filter: submissionFilter } : {}),
        },
        async (payload) => {
          const sub = payload.new as {
            team_id: string
            challenge_id: string
            is_correct: boolean
            attempted_at: string
          }

          // The submissions table has no game_id: verify membership (the
          // filter may be off, see useSubmissionFilter).
          // Check the already-loaded teams first; only unknown team ids
          // (e.g. a team that joined after initial load) cost a query.
          if (!teamIdsRef.current.has(sub.team_id)) {
            const { data: team } = await supabase
              .from("teams")
              .select("game_id")
              .eq("id", sub.team_id)
              .single()
            if (team?.game_id !== gameId) return
          }

          setLastSubmissions((prev) => {
            const next = new Map(prev)
            next.set(sub.team_id, sub.attempted_at)
            return next
          })

          if (sub.is_correct) {
            setSolvedSets((prev) => {
              const next = new Map(prev)
              const solved = new Set(next.get(sub.team_id) ?? [])
              solved.add(sub.challenge_id)
              next.set(sub.team_id, solved)
              return next
            })
          }
        }
      )
      // SUBSCRIBED comes when the channel is joined; the database stream is
      // ready a moment later. Read again then: a team that joined in between
      // is in neither the earlier read nor the stream.
      .on("system", {}, (payload) => {
        if (!cancelled && isDatabaseStreamReady(payload)) refetchOrDegrade()
      })
      .subscribe(handleStatus)

    // After the laptop sleeps or the network drops, realtime events from that
    // time are lost and the board would stay stale until the next change.
    // Read everything again when the page is shown or the network is back;
    // the merge in fetchInitialData keeps what realtime delivered meanwhile.
    const refresh = () => {
      if (cancelled || document.visibilityState !== "visible") return
      fetchInitialData().catch(() => {})
    }
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener("online", refresh)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener("online", refresh)
      supabase.removeChannel(channel)
      stopPolling()
      if (safetyInterval) clearInterval(safetyInterval)
    }
  }, [gameId, fetchInitialData, retryNonce, submissionFilter, running])

  const solvedCounts = new Map<string, number>()
  solvedSets.forEach((set, teamId) => solvedCounts.set(teamId, set.size))

  return { teams, solvedCounts, lastSubmissions, historyLoaded: historyGameId === gameId, connectionState, retry }
}
