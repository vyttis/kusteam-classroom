"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import {
  Medal,
  Crown,
  ArrowLeft,
  Users,
  Star,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import type { LeaderboardResponse, LeaderboardTeam } from "@/lib/game/leaderboard"
import { getPlayerSession } from "@/lib/game/session"
import { pluralizeLt } from "@/lib/utils"
import { AchievementBadge } from "@/components/player/achievement-badge"
import { AnnouncementBanner, type AnnouncementItem } from "@/components/player/announcement-banner"
import { ConnectionBanner, useConnection } from "@/components/player/connection"

const podiumColors = [
  "from-highlight/30 to-highlight/5 border-highlight/40",
  "from-muted to-muted/30 border-border",
  "from-accent/20 to-accent/5 border-accent/30",
]

const podiumIcons = [
  <Crown key="1" className="h-5 w-5 text-highlight-ink" />,
  <Medal key="2" className="h-5 w-5 text-muted-foreground" />,
  <Medal key="3" className="h-5 w-5 text-accent-ink" />,
]

export default function LeaderboardPage() {
  const params = useParams()
  const gameCode = (params.gameCode as string).toUpperCase()

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-ink" />
      </div>
    )
  }

  if (notFound || leaderboardDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-steam-dark mb-2">
            {notFound ? "Veikla nerasta" : "Rezultatų lentelė išjungta"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {notFound
              ? `Kodas ${gameCode} neatitinka jokios veiklos.`
              : "Vedėjas išjungė rezultatų lentelę šioje veikloje."}
          </p>
          <Link href={notFound ? "/play" : `/play/${gameCode}/play`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {notFound ? "Įvesti kitą kodą" : "Grįžti į veiklą"}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 pb-8">
      <ConnectionBanner offline={offline} />
      <div className="max-w-lg mx-auto">
        <AnnouncementBanner latest={announcement} />
        <div className="flex items-center justify-between mb-6">
          <Link href={`/play/${gameCode}/play`}>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Veikla
            </Button>
          </Link>
          <Badge variant="outline" className="font-mono tracking-wider">{gameCode}</Badge>
        </div>

        <div className="text-center mb-8">
          <Image src="/illustrations/trophy.svg" alt="" width={128} height={128} className="mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-steam-dark">Rezultatų lentelė</h1>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{teams.length} {pluralizeLt(teams.length, "komanda", "komandos", "komandų")}</span>
          </div>
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground">Atnaujinama kas kelias sekundes</span>
          </div>
        </div>

        {teams.length > 0 ? (
          <div className="space-y-2">
            <AnimatePresence>
              {teams.map((team, index) => {
                const isMe = team.id === myTeamId
                const isTop3 = index < 3

                return (
                  <motion.div
                    key={team.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={`border transition-all overflow-hidden ${
                      isMe
                        ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/10"
                        : isTop3
                        ? `bg-gradient-to-r ${podiumColors[index]}`
                        : "border-border/50 bg-white"
                    }`}>
                      <CardContent className="p-3.5 flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          isTop3 ? "bg-white shadow-sm" : "bg-muted/50 text-muted-foreground"
                        }`}>
                          {isTop3 ? podiumIcons[index] : index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold truncate ${isMe ? "text-primary-ink" : "text-steam-dark"}`}>
                              {team.name}
                            </span>
                            {isMe && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 border-primary/30 text-primary-ink shrink-0">
                                Jūs
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {team.solved} užd. išspręsta
                          </p>
                          {(() => {
                            const achievements = team.achievements
                            const MAX_VISIBLE = 4
                            const visible = achievements.slice(0, MAX_VISIBLE)
                            const overflow = achievements.length - visible.length
                            if (achievements.length === 0) return null
                            return (
                              <div className="flex items-center flex-wrap gap-1 mt-1.5">
                                {visible.map((a) => (
                                  <AchievementBadge key={a.id} type={a.type} size="sm" />
                                ))}
                                {overflow > 0 && (
                                  <span className="text-xs font-bold text-muted-foreground bg-muted/60 rounded-full px-1.5 py-0.5">
                                    +{overflow}
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 justify-end">
                            <Star className="h-3.5 w-3.5 text-highlight-ink shrink-0" />
                            <span className="font-bold text-lg text-steam-dark tabular-nums">{team.total_points}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {pluralizeLt(team.total_points, "taškas", "taškai", "taškų")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Dar nėra prisijungusių komandų</p>
          </div>
        )}
      </div>
    </div>
  )
}
