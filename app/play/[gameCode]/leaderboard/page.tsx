"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowLeft, BarChart3, Crown, Loader2, SearchX, Star, Users } from "lucide-react"
import Link from "next/link"
import type { LeaderboardResponse, LeaderboardTeam } from "@/lib/game/leaderboard"
import { getPlayerSession } from "@/lib/game/session"
import { pluralizeLt } from "@/lib/utils"
import { SteamRays } from "@/components/brand/steam-rays"
import { AchievementBadge } from "@/components/player/achievement-badge"
import { AnnouncementBanner, type AnnouncementItem } from "@/components/player/announcement-banner"
import { ConnectionBanner, useConnection } from "@/components/player/connection"
import { sharedRanks } from "@/components/player/play-progress"
import { SCREEN, SECONDARY_BUTTON, StateScreen } from "@/components/player/play-ui"

const MAX_BADGES = 4

export default function LeaderboardPage() {
  const params = useParams()
  const gameCode = (params.gameCode as string).toUpperCase()
  const reduce = useReducedMotion()

  const [teams, setTeams] = useState<LeaderboardTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [leaderboardDisabled, setLeaderboardDisabled] = useState(false)
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const inFlight = useRef(false)
  // "No connection" notice: two failed polls in a row, or the browser says
  // it is offline; the first poll that gets through removes it.
  const { offline, report: reportPoll } = useConnection()
  // The facilitator's latest announcement, so it is not missed while the
  // team looks at the board.
  const [announcement, setAnnouncement] = useState<AnnouncementItem | null>(null)

  // The board comes from the server (participants cannot read teams with
  // the anon key since 20261107120000). One request at a time; a failed one
  // keeps the last board and the next poll retries.
  const fetchLeaderboard = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch(`/api/play/leaderboard?game_code=${encodeURIComponent(gameCode)}`, {
        cache: "no-store",
        signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(8000) : undefined,
      })
      if (res.status >= 500) {
        reportPoll(false)
        return
      }
      const data = (await res.json()) as LeaderboardResponse | { error: string }
      reportPoll(true)
      if ("error" in data || data.state === "not_found") {
        setNotFound(true)
      } else if (data.state === "disabled") {
        setLeaderboardDisabled(true)
      } else {
        setNotFound(false)
        setLeaderboardDisabled(false)
        setTeams(data.teams)
      }
    } catch {
      // Network hiccup or timeout: the next poll retries; two in a row show
      // the "no connection" notice.
      reportPoll(false)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [gameCode, reportPoll])

  useEffect(() => {
    const session = getPlayerSession(gameCode)
    if (session) {
      setMyTeamId(session.team_id)
    }
  }, [gameCode])

  // Every 4 s while the page is visible, and at once when it becomes
  // visible again (phones suspend timers in the background). Stops on an
  // unknown code or a board the facilitator turned off.
  const stopped = notFound || leaderboardDisabled
  useEffect(() => {
    if (stopped) return
    void fetchLeaderboard()
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void fetchLeaderboard()
    }, 4000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchLeaderboard()
    }
    // The network is back: ask at once, so the notice goes away.
    const onOnline = () => void fetchLeaderboard()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onOnline)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
    }
  }, [stopped, fetchLeaderboard])

  // The announcement comes with the same status read the task page uses
  // (answered from the CDN for all phones of the class), asked less often
  // here: every 10 s while the page is visible.
  useEffect(() => {
    if (stopped) return
    let disposed = false
    const check = async () => {
      if (document.visibilityState !== "visible") return
      try {
        const res = await fetch(`/api/play/status?game_code=${encodeURIComponent(gameCode)}`, {
          cache: "no-store",
          signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(8000) : undefined,
        })
        if (!res.ok) return
        const data = (await res.json()) as { announcement?: AnnouncementItem | null }
        if (!disposed && data.announcement !== undefined) setAnnouncement(data.announcement)
      } catch {
        // The next round retries; the board's own poll reports the connection.
      }
    }
    void check()
    const interval = setInterval(check, 10_000)
    return () => {
      disposed = true
      clearInterval(interval)
    }
  }, [stopped, gameCode])

  if (loading) {
    return (
      <div className={`${SCREEN} flex items-center justify-center`} role="status">
        <Loader2 className="h-8 w-8 text-foreground motion-safe:animate-spin" aria-hidden="true" />
        <span className="sr-only">Kraunama...</span>
      </div>
    )
  }

  if (notFound || leaderboardDisabled) {
    return (
      <StateScreen
        icon={notFound ? SearchX : BarChart3}
        tone="info"
        title={notFound ? "Veikla nerasta" : "Rezultatų lentelė išjungta"}
        actions={
          <Button asChild variant="outline" className={SECONDARY_BUTTON}>
            <Link href={notFound ? "/play" : `/play/${gameCode}/play`}>
              <ArrowLeft aria-hidden="true" />
              {notFound ? "Įvesti kitą kodą" : "Grįžti į veiklą"}
            </Link>
          </Button>
        }
      >
        <p>
          {notFound
            ? `Kodas ${gameCode} neatitinka jokios veiklos.`
            : "Vedėjas išjungė rezultatų lentelę šioje veikloje."}
        </p>
      </StateScreen>
    )
  }

  // Teams tied on points share a place; a team without points has none
  // yet, so nobody wears a crown before anyone has scored.
  const ranks = sharedRanks(teams)
  const myIndex = teams.findIndex((team) => team.id === myTeamId)
  const myRank = myIndex >= 0 ? ranks[myIndex] : null

  return (
    <div className={`${SCREEN} px-4 pb-24 pt-3`}>
      <ConnectionBanner offline={offline} />
      <div className="max-w-lg mx-auto">
        <AnnouncementBanner latest={announcement} />
        <div className="mb-4 flex min-h-11 items-center justify-between">
          <Link
            href={`/play/${gameCode}/play`}
            className="-ml-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-base font-bold text-foreground hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Veikla
          </Link>
          <span className="rounded-full border-2 border-foreground/25 bg-white px-3 py-0.5 font-mono text-sm font-bold tracking-wider text-foreground">
            {gameCode}
          </span>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <SteamRays className="h-12 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight text-foreground">Rezultatų lentelė</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden="true" />
                <span>
                  {teams.length} {pluralizeLt(teams.length, "komanda", "komandos", "komandų")}
                </span>
              </span>
              <span aria-hidden="true">&middot;</span>
              <span>atnaujinama pati</span>
            </p>
          </div>
        </div>

        {myIndex >= 0 && (
          <p className="mb-3 text-base font-bold text-foreground" role="status">
            {myRank
              ? `Jūsų vieta: ${myRank} iš ${teams.length}`
              : "Jūsų komanda dar be taškų. Vieta atsiras po pirmo teisingo atsakymo."}
          </p>
        )}

        {teams.length > 0 ? (
          <ol className="space-y-2">
            {teams.map((team, index) => {
              const isMe = team.id === myTeamId
              const rank = ranks[index]
              const visible = team.achievements.slice(0, MAX_BADGES)
              const overflow = team.achievements.length - visible.length

              return (
                // Rows glide to their new place when the order changes.
                <motion.li
                  key={team.id}
                  layout={reduce ? false : "position"}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
                  aria-current={isMe ? "true" : undefined}
                  className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-3.5 ${
                    isMe ? "border-foreground shadow-[4px_4px_0_0_hsl(var(--primary))]" : "border-transparent"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-lg font-bold text-foreground">{team.name}</span>
                      {isMe && (
                        <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-xs font-bold text-background">
                          Jūs
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{team.solved} užd. išspręsta</p>
                    {visible.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {visible.map((a) => (
                          <AchievementBadge key={a.id} type={a.type} size="sm" />
                        ))}
                        {overflow > 0 && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-bold text-foreground">
                            +{overflow}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* The place: shown first, read after the name (the order
                      a screen reader and the lesson test follow). */}
                  <div
                    className={`relative order-first flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold tabular-nums ${
                      rank === 1
                        ? "bg-highlight text-highlight-foreground"
                        : rank !== null && rank <= 3
                          ? "border-2 border-highlight bg-white text-foreground"
                          : "bg-muted text-foreground"
                    }`}
                  >
                    {rank === 1 && (
                      <Crown
                        className="absolute -top-2.5 left-1/2 h-4 w-4 -translate-x-1/2 fill-highlight text-foreground"
                        aria-hidden="true"
                      />
                    )}
                    {rank !== null ? (
                      <>
                        <span aria-hidden="true">{rank}</span>
                        <span className="sr-only">{rank} vieta</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-foreground/40" />
                        <span className="sr-only">dar be vietos</span>
                      </>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Star className="h-4 w-4 shrink-0 fill-highlight text-foreground" aria-hidden="true" />
                      <span className="text-xl font-bold text-foreground tabular-nums">{team.total_points}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pluralizeLt(team.total_points, "taškas", "taškai", "taškų")}
                    </p>
                  </div>
                </motion.li>
              )
            })}
          </ol>
        ) : (
          <div className="rounded-2xl border border-border bg-white px-4 py-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-foreground/30" aria-hidden="true" />
            <p className="text-base text-muted-foreground">Dar nėra prisijungusių komandų</p>
          </div>
        )}
      </div>
    </div>
  )
}
