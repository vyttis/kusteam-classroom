"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useLiveGame } from "@/hooks/use-live-game"
import { LiveLeaderboardBoard } from "./live-leaderboard-board"
import { LiveActivityFeed } from "./live-activity-feed"
import { AnnouncementBanner } from "@/components/player/announcement-banner"
import { realtimeSignedIn } from "@/lib/supabase/realtime-auth"
import { LiveConnectionBanner } from "./live-connection-banner"
import { GameStatusActions } from "./game-status-actions"
import { TimeControls } from "./time-controls"
import { getPlayUrl, getPublicUrl } from "@/lib/game/play-url"
import { secondsLeft, secondsRunning, type GameClock } from "@/lib/game/clock"
import { formatClock, latestTeamSecondsLeft } from "@/lib/game/team-time"
import { useTeamClocks } from "@/hooks/use-team-clocks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import type { GameStatus } from "@/types/game"
import {
  ArrowLeft,
  Clock,
  GraduationCap,
  Eye,
  EyeOff,
  Maximize2,
  Megaphone,
  Pause,
  Send,
  Square,
} from "lucide-react"

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-white/20 rounded" style={{ width: 180, height: 180 }} />
    ),
  }
)

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
    <div className="min-h-screen flex flex-col text-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          {!presentationMode && (
            <Link href={`/games/${game.id}`}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-white/60 hover:text-white hover:bg-white/10"
                aria-label="Grįžti į veiklą"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          )}
          <h1 className="text-xl sm:text-2xl font-bold truncate">{game.title}</h1>
          {status === "paused" && (
            <span className="flex items-center gap-1.5 rounded-full bg-highlight/20 text-highlight px-3 py-1 text-sm font-medium shrink-0">
              <Pause className="h-3.5 w-3.5" />
              Pristabdyta
            </span>
          )}
          {status === "finished" && (
            <span className="flex items-center gap-1.5 rounded-full bg-accent/20 text-accent px-3 py-1 text-sm font-medium shrink-0">
              <Square className="h-3.5 w-3.5" />
              Baigta
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {clock && status !== "finished" && (
            <div className="text-right">
              <p
                className={`font-mono text-3xl font-bold tabular-nums ${
                  clock.countdown && clock.value <= 60
                    ? "text-accent animate-pulse"
                    : "text-white"
                }`}
              >
                {formatClock(clock.value)}
              </p>
              <p className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3" />
                {clock.label}
              </p>
              {clock.countdown && (
                <p className="text-xs text-white/60">
                  {clock.lastTeam !== null ? (
                    <>
                      Vėliausiai pradėjusiai komandai liko{" "}
                      <span className="font-mono font-semibold tabular-nums text-white">{formatClock(clock.lastTeam)}</span>
                    </>
                  ) : (
                    "Komandos laikas skaičiuojamas nuo jos pradžios"
                  )}
                  {clock.joiningOver && ". Naujos komandos nebepriimamos"}
                </p>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFullscreen}
            className="text-white/60 hover:text-white hover:bg-white/10"
            title="Visas ekranas"
            aria-label="Visas ekranas"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPresentationMode((p) => !p)}
            className="gap-2 text-white/60 hover:text-white hover:bg-white/10"
            title={presentationMode ? "Rodyti valdiklius (Esc)" : "Pateikties režimas"}
            aria-label={presentationMode ? "Rodyti valdiklius" : "Pateikties režimas"}
          >
            {presentationMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {presentationMode ? "Valdikliai" : "Pateiktis"}
            </span>
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 px-6 py-6">
        {connectionState === "degraded" && (
          <div className="mb-4">
            <LiveConnectionBanner onRetry={retry} tone="dark" />
          </div>
        )}

        {/* The facilitator's announcements, for the whole class */}
        <AnnouncementBanner gameId={game.id} variant="projector" />

        {status === "finished" && (
          <div className="mb-6 rounded-2xl border border-accent/40 bg-accent/10 px-6 py-4 text-center">
            <p className="text-2xl font-bold">Veikla baigta!</p>
            <p className="text-white/60 mt-1">Galutiniai rezultatai žemiau 🏆</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* Leaderboard */}
          <LiveLeaderboardBoard
            teams={teams}
            solvedCounts={solvedCounts}
            totalChallenges={challengeCount}
            ranked={game.show_leaderboard}
          />

          {/* Side panel: QR + activity */}
          <div className="space-y-4">
            {sideQr?.kind === "join" && (
              <div className="rounded-xl border border-white/10 bg-white p-4 text-center">
                <QRCodeSVG
                  value={playUrl}
                  size={180}
                  level="H"
                  includeMargin={false}
                  fgColor="#00323C"
                  className="mx-auto"
                />
                <p className="mt-3 font-mono text-3xl font-bold tracking-[0.25em] text-steam-dark">
                  {game.game_code}
                </p>
                {/* Read from the back of the room: large, without the scheme,
                    breaking only after a slash. */}
                <p className="mt-2 text-lg font-semibold leading-snug text-steam-dark">
                  {playUrl
                    .replace(/^https?:\/\//, "")
                    .split("/")
                    .map((part, i, parts) => (
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
              <div className="rounded-xl border border-white/10 bg-white p-4 text-center">
                <p className="mb-3 flex items-center justify-center gap-2 text-base font-semibold text-steam-dark">
                  <GraduationCap className="h-5 w-5 text-secondary" aria-hidden="true" />
                  Vedėjo paskyros prašymas
                </p>
                <QRCodeSVG
                  value={sideQr.url}
                  size={180}
                  level="M"
                  includeMargin={false}
                  fgColor="#00323C"
                  className="mx-auto"
                />
                <p className="mt-3 text-sm text-muted-foreground">
                  Mokytojai: nuskaitykite ir pateikite prašymą. Patvirtinus gausite laišką.
                </p>
              </div>
            )}
            <LiveActivityFeed gameId={game.id} variant="projector" hidePoints={!game.show_leaderboard} />
          </div>
        </div>
      </div>

      {/* Control bar */}
      {!presentationMode && (
        <footer className="sticky bottom-0 border-t border-white/10 bg-steam-dark/95 backdrop-blur px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <GameStatusActions
              gameId={game.id}
              status={status}
              challengeCount={challengeCount}
            />
            {requestUrl && status !== "finished" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRequestQr((v) => !v)}
                aria-pressed={showRequestQr}
                className="gap-1.5 border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                {showRequestQr ? "Rodyti prisijungimo QR" : "Rodyti prašymo QR"}
              </Button>
            )}
            {(status === "active" || status === "paused") && (
              <>
                <TimeControls gameId={game.id} currentTimeLimit={timeLimit} variant="bar" onExtended={setTimeLimit} />
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <Megaphone className="h-4 w-4 text-white/40 shrink-0" />
                  <Input
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value.slice(0, 500))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAnnounce()
                    }}
                    placeholder="Pranešimas komandoms..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-9"
                  />
                  <Button
                    size="sm"
                    onClick={handleAnnounce}
                    disabled={!announcement.trim() || sendingAnnouncement}
                    className="bg-secondary-ink hover:bg-secondary-ink/90 text-white gap-1.5 shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Siųsti
                  </Button>
                </div>
              </>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
