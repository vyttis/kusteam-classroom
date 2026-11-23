"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { MotionConfig } from "framer-motion"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useLiveGame } from "@/hooks/use-live-game"
import { LiveLeaderboardBoard } from "./live-leaderboard-board"
import { LiveActivityFeed } from "./live-activity-feed"
import { LiveJoinQr, LiveJoinScreen } from "./live-join-screen"
import { AnnouncementBanner } from "@/components/player/announcement-banner"
import { realtimeSignedIn } from "@/lib/supabase/realtime-auth"
import { LiveConnectionBanner } from "./live-connection-banner"
import { GameStatusActions } from "./game-status-actions"
import { TimeControls } from "./time-controls"
import { getPlayUrl, getPublicUrl } from "@/lib/game/play-url"
import { secondsLeft, secondsRunning, type GameClock } from "@/lib/game/clock"
import { formatClock, latestTeamSecondsLeft } from "@/lib/game/team-time"
import { boardPhase, countdownUrgency, shortAddress, COUNTDOWN_NOTE, type CountdownUrgency } from "@/lib/game/live-board"
import { cn } from "@/lib/utils"
import { useTeamClocks } from "@/hooks/use-team-clocks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import type { GameStatus } from "@/types/game"
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Clock,
  GraduationCap,
  Eye,
  EyeOff,
  Hourglass,
  Maximize2,
  Megaphone,
  Pause,
  Send,
  TimerOff,
} from "lucide-react"

// On the dark screen the default (dark) focus ring would not be seen.
const DARK_FOCUS = "focus-visible:ring-highlight focus-visible:ring-offset-0"
const QUIET_BUTTON = `h-11 text-white/80 hover:bg-white/10 hover:text-white ${DARK_FOCUS}`

// The countdown changes state when little time is left: a filled plate and
// a line of text with an icon, never colour alone.
const URGENCY_PLATE: Record<CountdownUrgency, string> = {
  calm: "bg-transparent text-white",
  soon: "bg-highlight text-highlight-foreground",
  last: "bg-accent text-white",
  over: "bg-accent text-white",
}
const URGENCY_ICON = { soon: Hourglass, last: AlertTriangle, over: TimerOff } as const

interface LiveViewProps {
  game: {
    id: string
    title: string
    game_code: string
    status: GameStatus
    starts_at: string | null
    time_limit_minutes: number | null
    paused_ms: number
    paused_at: string | null
    /** The activity's leaderboard setting: off hides places and points here too. */
    show_leaderboard: boolean
  }
  challengeCount: number
  /** Path of the teacher access request page, when the activity accepts requests. */
  accessRequestPath?: string | null
}

// Projector "class screen": big leaderboard + QR + activity feed on a dark
// background, with a collapsible teacher control bar.
export function LiveView({ game, challengeCount, accessRequestPath = null }: LiveViewProps) {
  const { toast } = useToast()
  const { teams, solvedCounts, connectionState, retry } = useLiveGame(game.id, game.status !== "finished")

  const [status, setStatus] = useState<GameStatus>(game.status)
  const [startsAt, setStartsAt] = useState<string | null>(game.starts_at)
  const [timeLimit, setTimeLimit] = useState<number | null>(game.time_limit_minutes)
  const [pausedMs, setPausedMs] = useState<number>(game.paused_ms)
  const [pausedAt, setPausedAt] = useState<string | null>(game.paused_at)
  const [nowTick, setNowTick] = useState(() => Date.now())

  // Sync from props: GameStatusActions finishes with router.refresh(), which
  // updates props but not this local state. Without this, when the games
  // realtime channel is down, "Baigti veiklą" appears to do nothing.
  useEffect(() => {
    setStatus(game.status)
    setStartsAt(game.starts_at)
    setTimeLimit(game.time_limit_minutes)
    setPausedMs(game.paused_ms)
    setPausedAt(game.paused_at)
  }, [game.status, game.starts_at, game.time_limit_minutes, game.paused_ms, game.paused_at])

  // Presentation mode hides the control bar (projector shows only the board)
  const [presentationMode, setPresentationMode] = useState(false)

  // Announce input
  const [announcement, setAnnouncement] = useState("")
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false)

  // Live status/settings updates (teacher-owned row — RLS delivers these)
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    // Join only once realtime has the facilitator's token (realtimeSignedIn).
    realtimeSignedIn(supabase).then(() => {
      if (cancelled) return
      channel = supabase
      .channel(`live_view_game_${game.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${game.id}` },
        (payload) => {
          const updated = payload.new as {
            status?: GameStatus
            starts_at?: string | null
            settings?: { time_limit_minutes?: number | null }
            paused_ms?: number | string | null
            paused_at?: string | null
          }
          if (updated.status) setStatus(updated.status)
          if (updated.starts_at !== undefined) setStartsAt(updated.starts_at)
          if (updated.settings?.time_limit_minutes !== undefined) {
            setTimeLimit(updated.settings.time_limit_minutes)
          }
          if (updated.paused_ms !== undefined && updated.paused_ms !== null) setPausedMs(Number(updated.paused_ms) || 0)
          if (updated.paused_at !== undefined) setPausedAt(updated.paused_at)
        }
      )
      .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [game.id])

  // Polling safety net: another device (the facilitator's laptop) may pause,
  // resume, extend or finish while this screen's realtime channel is down.
  useEffect(() => {
    if (status === "finished") return
    let disposed = false
    const sync = async () => {
      try {
        const res = await fetch(`/api/play/status?game_code=${encodeURIComponent(game.game_code)}`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as {
          status: GameStatus | null
          time_limit_minutes?: number | null
          paused_ms?: number
          paused_at?: string | null
        }
        if (disposed || !data.status) return
        setStatus(data.status)
        if (data.time_limit_minutes !== undefined) setTimeLimit(data.time_limit_minutes)
        if (typeof data.paused_ms === "number") setPausedMs(data.paused_ms)
        if (data.paused_at !== undefined) setPausedAt(data.paused_at)
      } catch {
        // The next round retries.
      }
    }
    const interval = setInterval(sync, 10_000)
    return () => {
      disposed = true
      clearInterval(interval)
    }
  }, [game.game_code, status])

  // Clock tick
  useEffect(() => {
    if (status !== "active") return
    const interval = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [status])

  // Esc leaves presentation mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPresentationMode(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const playUrl = useMemo(() => getPlayUrl(game.game_code), [game.game_code])
  const requestUrl = useMemo(
    () => (accessRequestPath ? getPublicUrl(accessRequestPath) : null),
    [accessRequestPath]
  )
  // The side QR shows the join code while the activity runs; the facilitator
  // can switch it to the account request QR, and after the end it shows that.
  const [showRequestQr, setShowRequestQr] = useState(false)
  const joinAddress = useMemo(() => shortAddress(getPublicUrl("/prisijungti")), [])
  const sideQr =
    requestUrl && (showRequestQr || status === "finished")
      ? { kind: "request" as const, url: requestUrl }
      : status !== "finished"
        ? { kind: "join" as const, url: playUrl }
        : null

  // The time limit runs for each team from its own "Pradėti", so teams end
  // at different moments (audit R-12). Their starts come from the server.
  const timed = !!timeLimit && timeLimit > 0
  const teamClocks = useTeamClocks(
    game.id,
    timed && (status === "active" || status === "paused"),
    `${teams.length}:${status}:${timeLimit}`
  )

  // Class-wide clock anchored on starts_at, without the pauses. With a limit
  // it counts from the start of the activity: no team's time ends before it
  // reaches zero, and from then on no new team is accepted (/api/teams).
  // The label says so, and the line under it shows the last team's own
  // deadline, which is when the whole class is done.
  const clock = useMemo(() => {
    if (!startsAt) return null
    const startMs = new Date(startsAt).getTime()
    const state: GameClock = { limitMinutes: timed ? timeLimit : null, pausedMs, pausedAt }
    const left = secondsLeft(state, startMs, 0, nowTick)
    if (left !== null) {
      const lastTeam = latestTeamSecondsLeft(state, teamClocks.teams.values(), nowTick + teamClocks.skewMs)
      return {
        label: status === "paused" ? "Liko nuo veiklos pradžios (pauzė)" : "Liko nuo veiklos pradžios",
        value: left,
        countdown: true,
        // Only when it says more than the class clock already does.
        lastTeam: lastTeam !== null && lastTeam > left ? lastTeam : null,
        joiningOver: left === 0 && status === "active",
      }
    }
    return {
      label: "Bendras laikas",
      value: secondsRunning(state, startMs, nowTick),
      countdown: false,
      lastTeam: null,
      joiningOver: false,
    }
  }, [startsAt, timed, timeLimit, pausedMs, pausedAt, nowTick, status, teamClocks])

  // While the class joins, the screen is the QR code; from the first solved
  // task the board takes over. The account request QR is a side panel, so it
  // is shown with the board.
  const phase = showRequestQr ? "board" : boardPhase({ status, teams, solvedCounts })
  // The moment the lesson really ends is the last team's own deadline.
  const urgency = countdownUrgency(clock?.countdown ? (clock.lastTeam ?? clock.value) : null)
  const UrgencyIcon = urgency === "calm" ? null : URGENCY_ICON[urgency]

  const handleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }, [])

  async function handleAnnounce() {
    const trimmed = announcement.trim()
    if (!trimmed || sendingAnnouncement) return
    setSendingAnnouncement(true)
    try {
      const res = await fetch(`/api/games/${game.id}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAnnouncement("")
      toast({ title: "Pranešimas išsiųstas" })
    } catch {
      toast({
        title: "Nepavyko išsiųsti pranešimo",
        variant: "destructive",
      })
    } finally {
      setSendingAnnouncement(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col text-white">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 lg:flex-nowrap border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 basis-64 items-center gap-2 sm:gap-3">
            {!presentationMode && (
              <Button asChild variant="ghost" className={`w-11 shrink-0 p-0 ${QUIET_BUTTON}`}>
                <Link href={`/games/${game.id}`} aria-label="Grįžti į veiklą">
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
            )}
            <h1 className="line-clamp-2 min-w-0 text-xl font-bold leading-tight sm:text-2xl">{game.title}</h1>
            {status === "paused" && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-highlight px-3 py-1 text-base font-bold text-highlight-foreground">
                <Pause className="h-4 w-4" aria-hidden="true" />
                Pristabdyta
              </span>
            )}
            {status === "finished" && (
              <span className="shrink-0 rounded-full border border-white/40 px-3 py-1 text-base font-bold text-white">
                Baigta
              </span>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
            {clock && status !== "finished" && (
              <div
                className="flex flex-col-reverse items-end gap-x-4 gap-y-1 sm:flex-row sm:items-center"
                role="timer"
                aria-label={`${clock.label}: ${formatClock(clock.value)}`}
              >
                <div className="text-right">
                  {UrgencyIcon && (
                    <p className="flex items-center justify-end gap-1.5 text-base font-bold text-white">
                      <UrgencyIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {COUNTDOWN_NOTE[urgency]}
                    </p>
                  )}
                  <p className="flex items-center justify-end gap-1 text-xs uppercase tracking-wide text-white/70">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {clock.label}
                  </p>
                  {clock.countdown && (
                    <p className="max-w-[18rem] text-xs text-white/70 lg:max-w-none">
                      {clock.lastTeam !== null ? (
                        <>
                          Vėliausiai pradėjusiai komandai liko{" "}
                          <span className="font-mono font-bold tabular-nums text-white">{formatClock(clock.lastTeam)}</span>
                        </>
                      ) : (
                        "Komandos laikas skaičiuojamas nuo jos pradžios"
                      )}
                      {clock.joiningOver && ". Naujos komandos nebepriimamos"}
                    </p>
                  )}
                </div>
                <p
                  className={cn(
                    "rounded-xl px-3 py-1 font-mono text-4xl font-bold leading-none tabular-nums transition-colors duration-500 motion-reduce:transition-none sm:text-5xl",
                    URGENCY_PLATE[urgency],
                  )}
                >
                  {formatClock(clock.value)}
                </p>
              </div>
            )}
            {/* In presentation mode the two buttons stay reachable but step back. */}
            <div
              className={cn(
                "flex items-center gap-1 transition-opacity motion-reduce:transition-none",
                presentationMode && "opacity-40 focus-within:opacity-100 hover:opacity-100",
              )}
            >
              <Button
                variant="ghost"
                onClick={handleFullscreen}
                className={`w-11 p-0 ${QUIET_BUTTON}`}
                title="Visas ekranas"
                aria-label="Visas ekranas"
              >
                <Maximize2 className="h-5 w-5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPresentationMode((p) => !p)}
                className={`gap-2 px-3 ${QUIET_BUTTON}`}
                title={presentationMode ? "Rodyti valdiklius (Esc)" : "Pateikties režimas"}
                aria-label={presentationMode ? "Rodyti valdiklius" : "Pateikties režimas"}
                aria-pressed={presentationMode}
              >
                {presentationMode ? (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{presentationMode ? "Valdikliai" : "Pateiktis"}</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Body */}
        <main className="flex flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6">
          {connectionState === "degraded" && (
            <div className="mb-4">
              <LiveConnectionBanner onRetry={retry} tone="dark" />
            </div>
          )}

          {/* The facilitator's announcements, for the whole class */}
          <AnnouncementBanner gameId={game.id} variant="projector" />

          {status === "finished" && (
            <div className="mb-6 rounded-2xl border border-white/25 bg-white/[0.07] px-6 py-4 text-center">
              <p className="text-3xl font-bold">Veikla baigta!</p>
              <p className="mt-1 text-lg text-white/80">
                {game.show_leaderboard ? "Galutiniai rezultatai" : "Ačiū visoms komandoms"}
              </p>
            </div>
          )}

          <div
            className={cn(
              "flex-1",
              phase === "board" ? "grid grid-cols-1 content-start gap-6 lg:grid-cols-[1fr_300px]" : "flex flex-col",
            )}
          >
            {phase === "join" ? (
              <LiveJoinScreen gameCode={game.game_code} playUrl={playUrl} joinAddress={joinAddress} teams={teams} />
            ) : (
              <LiveLeaderboardBoard
                teams={teams}
                solvedCounts={solvedCounts}
                totalChallenges={challengeCount}
                ranked={game.show_leaderboard}
              />
            )}

            {/* Side panel: QR + latest solves. It stays mounted while the
                class joins (the feed keeps its channel), only out of sight. */}
            <aside className={cn("space-y-4", phase === "join" && "hidden")}>
              {phase === "board" && sideQr?.kind === "join" && (
                <div className="rounded-2xl bg-white p-4 text-center text-steam-dark">
                  <LiveJoinQr url={playUrl} className="mx-auto w-44 rounded-none p-0" />
                  <p className="mt-3 font-mono text-3xl font-bold tracking-[0.2em]">{game.game_code}</p>
                  {/* Read from the back of the room: large, without the scheme. */}
                  <p className="mt-1 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
                    {joinAddress.split("/").map((part, i, parts) => (
                      <Fragment key={i}>
                        {part}
                        {i < parts.length - 1 && (
                          <>
                            /<wbr />
                          </>
                        )}
                      </Fragment>
                    ))}
                  </p>
                </div>
              )}
              {sideQr?.kind === "request" && (
                <div className="rounded-2xl bg-white p-4 text-center text-steam-dark">
                  <p className="mb-3 flex items-center justify-center gap-2 text-base font-bold">
                    <GraduationCap className="h-5 w-5" aria-hidden="true" />
                    Vedėjo paskyros prašymas
                  </p>
                  <LiveJoinQr url={sideQr.url} level="M" className="mx-auto w-44 rounded-none p-0" />
                  <p className="mt-3 text-sm">
                    Mokytojai: nuskaitykite ir pateikite prašymą. Patvirtinus gausite laišką.
                  </p>
                </div>
              )}
              <LiveActivityFeed gameId={game.id} variant="projector" hidePoints={!game.show_leaderboard} />
            </aside>
          </div>
        </main>

        {/* Control bar */}
        {!presentationMode && (
          <footer className="bottom-0 border-t border-white/10 bg-steam-dark/95 px-4 py-3 backdrop-blur sm:sticky sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <GameStatusActions gameId={game.id} status={status} challengeCount={challengeCount} variant="bar" />
              {status === "finished" && (
                <Button
                  asChild
                  className={`h-11 gap-2 rounded-full bg-highlight px-5 text-base font-bold text-highlight-foreground hover:bg-highlight/90 ${DARK_FOCUS}`}
                >
                  <Link href={`/games/${game.id}/analytics`}>
                    <BarChart3 className="h-5 w-5" aria-hidden="true" />
                    Rezultatai ir analitika
                  </Link>
                </Button>
              )}
              {(status === "active" || status === "paused") && (
                <>
                  <TimeControls gameId={game.id} currentTimeLimit={timeLimit} variant="bar" onExtended={setTimeLimit} />
                  <div className="flex min-w-[240px] flex-1 items-center gap-2">
                    <Megaphone className="h-5 w-5 shrink-0 text-white/70" aria-hidden="true" />
                    <Input
                      value={announcement}
                      onChange={(e) => setAnnouncement(e.target.value.slice(0, 500))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAnnounce()
                      }}
                      placeholder="Pranešimas komandoms..."
                      aria-label="Pranešimas komandoms"
                      className="h-11 border-white/30 bg-white/10 text-base text-white placeholder:text-white/60 focus-visible:ring-highlight"
                    />
                    <Button
                      variant="outline"
                      onClick={handleAnnounce}
                      disabled={!announcement.trim() || sendingAnnouncement}
                      className={`shrink-0 gap-1.5 border-white/30 bg-transparent px-4 ${QUIET_BUTTON}`}
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Siųsti
                    </Button>
                  </div>
                </>
              )}
              {requestUrl && status !== "finished" && (
                <Button
                  variant="outline"
                  onClick={() => setShowRequestQr((v) => !v)}
                  aria-pressed={showRequestQr}
                  className={`gap-1.5 border-white/30 bg-transparent px-4 ${QUIET_BUTTON}`}
                >
                  <GraduationCap className="h-4 w-4" aria-hidden="true" />
                  {showRequestQr ? "Rodyti prisijungimo QR" : "Rodyti prašymo QR"}
                </Button>
              )}
            </div>
          </footer>
        )}
      </div>
    </MotionConfig>
  )
}
