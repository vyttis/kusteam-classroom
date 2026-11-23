"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { isDatabaseStreamReady } from "@/hooks/live-channel"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { pluralizeLt } from "@/lib/utils"
import { LiveConnectionBanner } from "./live-connection-banner"
import { useSubmissionFilter } from "@/hooks/use-submission-filter"
import { motion, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import {
  Activity,
  CheckCircle2,
  XCircle,
  UserPlus,
  Zap,
} from "lucide-react"

interface ActivityEvent {
  id: string
  type: "submission_correct" | "submission_wrong" | "team_joined"
  team_id: string
  team_name: string
  challenge_title?: string
  points?: number
  timestamp: string
}

interface LiveActivityFeedProps {
  gameId: string
  // "projector" renders a translucent dark card with larger text for the
  // class-screen live view
  variant?: "default" | "projector"
  /** The activity shows no leaderboard: the class screen then shows no points. */
  hidePoints?: boolean
}

export function LiveActivityFeed({ gameId, variant = "default", hidePoints = false }: LiveActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [teamCount, setTeamCount] = useState(0)
  const [degraded, setDegraded] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const isProjector = variant === "projector"
  const prefersReduced = useReducedMotion()
  // A new line slides in under the previous ones; with reduced motion it is simply there.
  const rowMotion = prefersReduced
    ? { initial: false as const, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, height: 0, y: -10 },
        animate: { opacity: 1, height: "auto", y: 0 },
        exit: { opacity: 0, height: 0 },
        transition: { duration: 0.2 },
      }
  const maxEvents = isProjector ? 8 : 50
  const initialLoadDone = useRef(false)

  const retry = useCallback(() => setRetryNonce((n) => n + 1), [])

  // Only this activity's answers come over realtime (FAC-10); the task
  // titles come with it, so an answer needs no title lookup.
  const { filter: submissionFilter, titles } = useSubmissionFilter(gameId)
  const titlesRef = useRef(titles)
  useEffect(() => {
    titlesRef.current = titles
  }, [titles])

  useEffect(() => {
    if (submissionFilter === undefined) return
    const supabase = createClient()
    let pollInterval: NodeJS.Timeout | null = null
    let cancelled = false

    // Load recent activity on mount. Two reads: the teams (their number is
    // the team count) and their latest answers; task titles come from the
    // task list read for the realtime filter (PERF-03).
    async function loadRecent() {
      // Named columns, not "*": client roles have column-level SELECT grants
      // on teams (session_token is revoked), "*" would be denied.
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .eq("game_id", gameId)

      if (teamsError) throw teamsError
      if (cancelled) return

      setTeamCount(teams?.length ?? 0)

      if (!teams || teams.length === 0) {
        initialLoadDone.current = true
        return
      }

      const teamMap = new Map(teams.map(t => [t.id, t.name]))
      const teamIds = teams.map(t => t.id)

      const { data: subs } = await supabase
        .from("submissions")
        .select("id, team_id, challenge_id, is_correct, points_awarded, attempted_at")
        .in("team_id", teamIds)
        .order("attempted_at", { ascending: false })
        .limit(15)

      // A task added a moment ago may not be in the list yet: read titles
      // only then.
      let challengeMap = titlesRef.current
      if (subs?.some((sub) => !challengeMap.has(sub.challenge_id))) {
        const { data: challenges } = await supabase
          .from("challenges")
          .select("id, title")
          .eq("game_id", gameId)
        challengeMap = new Map((challenges || []).map((c) => [c.id, c.title as string]))
      }
      if (cancelled) return

      if (subs) {
        const recentEvents: ActivityEvent[] = subs.map(s => ({
          id: s.id,
          type: s.is_correct ? "submission_correct" : "submission_wrong",
          team_id: s.team_id,
          team_name: teamMap.get(s.team_id) || "-",
          challenge_title: challengeMap.get(s.challenge_id) || "-",
          points: s.points_awarded,
          timestamp: s.attempted_at,
        }))
        // Keep "joined" lines already shown (they are not re-read); answers
        // come from this read. Newest first, each event once.
        setEvents((prev) => {
          const teamIds = new Set(teamMap.keys())
          const joins = prev.filter((e) => e.type === "team_joined" && teamIds.has(e.team_id))
          const seen = new Set<string>()
          return [...recentEvents, ...joins]
            .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
            .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
            .slice(0, maxEvents)
        })
      }

      initialLoadDone.current = true
    }

    function startPolling() {
      if (pollInterval) return
      pollInterval = setInterval(() => {
        loadRecent().catch(() => {})
      }, 30000)
    }

    function stopPolling() {
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    }

    // One channel carries answers and team changes (PERF-03).
    const handleStatus = (status: string) => {
      if (cancelled) return
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setDegraded(true)
        startPolling()
      } else if (status === "SUBSCRIBED") {
        setDegraded(false)
        stopPolling()
        // Teams that joined while the channel was still joining (or during a
        // gap) are in neither the first read nor the channel: read again.
        loadRecent().catch(() => {})
      }
    }

    loadRecent().catch(() => {
      if (!cancelled) {
        setDegraded(true)
        startPolling()
      }
    })

    // New answers, and teams joining, renamed or removed.
    const channel = supabase
      .channel(`activity_${gameId}`)
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
            id: string
            team_id: string
            challenge_id: string
            is_correct: boolean
            points_awarded: number
            attempted_at: string
          }

          // Fetch team name
          const { data: team } = await supabase
            .from("teams")
            .select("name, game_id")
            .eq("id", sub.team_id)
            .single()

          if (!team || team.game_id !== gameId) return

          // Task title: known from the task list; a task added a moment ago
          // may not be in it yet.
          let challengeTitle = titlesRef.current.get(sub.challenge_id)
          if (!challengeTitle) {
            const { data: challenge } = await supabase
              .from("challenges")
              .select("title")
              .eq("id", sub.challenge_id)
              .single()
            challengeTitle = challenge?.title
          }

          const event: ActivityEvent = {
            id: sub.id,
            type: sub.is_correct ? "submission_correct" : "submission_wrong",
            team_id: sub.team_id,
            team_name: team.name,
            challenge_title: challengeTitle || "-",
            points: sub.points_awarded,
            timestamp: sub.attempted_at,
          }

          setEvents(prev => [event, ...prev].slice(0, maxEvents))
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "teams", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const team = payload.new as { id: string; name: string; joined_at: string }

          const event: ActivityEvent = {
            id: `join_${team.id}`,
            type: "team_joined",
            team_id: team.id,
            team_name: team.name,
            timestamp: team.joined_at,
          }

          setEvents(prev => [event, ...prev].slice(0, maxEvents))
          setTeamCount(prev => prev + 1)
        }
      )
      // A renamed team: its earlier rows show the new name too, so a name
      // the facilitator replaced does not stay on the class screen.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "teams", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const team = payload.new as { id: string; name: string }
          setEvents((prev) =>
            prev.some((e) => e.team_id === team.id && e.team_name !== team.name)
              ? prev.map((e) => (e.team_id === team.id ? { ...e, team_name: team.name } : e))
              : prev
          )
        }
      )
      // A removed team: DELETE events carry only the id and cannot be
      // filtered by game, so drop its rows and count this game's teams again.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "teams" },
        async (payload) => {
          const removedId = (payload.old as { id?: string }).id
          if (removedId) setEvents((prev) => prev.filter((e) => e.team_id !== removedId))
          const { count } = await supabase
            .from("teams")
            .select("id", { count: "exact", head: true })
            .eq("game_id", gameId)
          if (!cancelled && typeof count === "number") setTeamCount(count)
        }
      )
      // The database stream is ready a moment after SUBSCRIBED: read again.
      .on("system", {}, (payload) => {
        if (!cancelled && isDatabaseStreamReady(payload)) loadRecent().catch(() => {})
      })
      .subscribe(handleStatus)

    // Events missed while the laptop slept or the network was down: read the
    // recent ones again when the page is shown or the network is back.
    const refresh = () => {
      if (cancelled || document.visibilityState !== "visible") return
      loadRecent().catch(() => {})
    }
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener("online", refresh)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener("online", refresh)
      supabase.removeChannel(channel)
      stopPolling()
    }
  }, [gameId, maxEvents, retryNonce, submissionFilter])

  function formatTimestamp(ts: string) {
    const date = new Date(ts)
    return date.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Vilnius" })
  }

  function getIcon(type: ActivityEvent["type"]) {
    switch (type) {
      case "submission_correct":
        return <CheckCircle2 className="h-4 w-4 text-primary" />
      case "submission_wrong":
        return <XCircle className="h-4 w-4 text-accent" />
      case "team_joined":
        return <UserPlus className="h-4 w-4 text-secondary" />
    }
  }

  function getMessage(event: ActivityEvent) {
    switch (event.type) {
      case "submission_correct":
        return (
          <>
            <span className="font-medium text-steam-dark">{event.team_name}</span>
            {" "}išsprendė{" "}
            <span className="font-medium">{event.challenge_title}</span>
            {event.points && !hidePoints ? (
              <Badge variant="outline" className="ml-1.5 text-xs py-0 px-1.5 text-primary-ink border-primary/30">
                +{event.points} tšk.
              </Badge>
            ) : null}
          </>
        )
      case "submission_wrong":
        return (
          <>
            <span className="font-medium text-steam-dark">{event.team_name}</span>
            {" "}neteisingai atsakė į{" "}
            <span className="font-medium">{event.challenge_title}</span>
          </>
        )
      case "team_joined":
        return (
          <>
            <span className="font-medium text-steam-dark">{event.team_name}</span>
            {" "}prisijungė prie veiklos
          </>
        )
    }
  }

  if (isProjector) {
    // The whole class sees this screen: who answered wrong is not shown, and
    // who joined is on the join screen. What is left is the latest solves.
    // Until there is one the panel stays out of the way.
    const shown = events.filter((event) => event.type === "submission_correct").slice(0, 5)
    if (shown.length === 0) return null
    return (
      <section aria-label="Naujausi sprendimai" className="rounded-2xl border border-white/15 bg-white/[0.05] p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/80">
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
          Naujausi sprendimai
        </h2>
        <ul className="space-y-1">
          <AnimatePresence initial={false}>
            {shown.map((event) => (
              <motion.li key={event.id} {...rowMotion} className="overflow-hidden text-lg leading-snug text-white">
                <span className="block py-1">
                  <span className="font-bold">{event.team_name}</span>{" "}
                  <span className="text-white/80">išsprendė „{event.challenge_title}“</span>
                  {event.points && !hidePoints ? (
                    <span className="ml-1.5 whitespace-nowrap font-bold tabular-nums text-white">
                      +{event.points}
                    </span>
                  ) : null}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>
    )
  }

  return (
    <div className="space-y-3">
      {degraded && <LiveConnectionBanner onRetry={retry} />}
      <Card className="border-border/50 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Gyva veikla
            </span>
            <Badge variant="secondary" className="gap-1 text-xs font-normal">
              <Zap className="h-3 w-3" />
              {teamCount} {pluralizeLt(teamCount, "komanda", "komandos", "komandų")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Laukiama veiklos...</p>
              <p className="text-xs mt-1">Čia matysite komandų veiksmus realiu laiku</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              <AnimatePresence initial={false}>
                {events.map((event) => (
                  <motion.div
                    key={event.id}
                    {...rowMotion}
                    className="flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="mt-0.5 shrink-0">{getIcon(event.type)}</div>
                    <div className="flex-1 min-w-0 text-sm text-muted-foreground leading-snug">
                      {getMessage(event)}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums mt-0.5">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
