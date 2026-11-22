"use client"

/**
 * Full-screen states and shared chrome of the participant task page
 * (app/play/[gameCode]/play). Presentation only: the page owns the state
 * and decides which one to show.
 */

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { AlertTriangle, BarChart3, Clock, Loader2, Play, Star, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AnnouncementBanner, type AnnouncementItem } from "@/components/player/announcement-banner"
import { ReflectionForm } from "@/components/player/reflection-form"
import { FinishRequestCard } from "@/components/access/finish-request-card"
import { TimerAnnouncer } from "@/components/player/timer-announcer"
import { LeaveTeamButton } from "@/components/player/leave-team-button"
import { formatTime } from "@/lib/game/play-format"

/**
 * Network failure or the activity is not available. Nothing here drops the
 * team's session: without it the team cannot come back (its name is then
 * taken), so the only action is to try again, and the way out is the
 * facilitator's "Grąžinti į komandą" link.
 */
export function PlayLoadError({
  onRetry,
  retrying,
}: {
  onRetry: () => void
  /** The page is still retrying by itself. */
  retrying: boolean
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-accent-ink" />
        </div>
        <h1 className="text-xl font-bold text-steam-dark mb-2">
          Nepavyko įkelti veiklos
        </h1>
        <p className="text-sm text-muted-foreground mb-2">
          Patikrinkite interneto ryšį arba paklauskite vedėjo, ar veikla
          vis dar vyksta.
        </p>
        <p className="text-sm text-muted-foreground mb-6 min-h-5" role="status" aria-live="polite">
          {retrying ? "Bandome prisijungti iš naujo..." : ""}
        </p>
        <Button
          onClick={onRetry}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Bandyti dar kartą
        </Button>
        <p className="text-sm text-muted-foreground mt-4">
          Jei nepavyksta, paprašykite vedėjo nuorodos arba QR kodo
          „Grąžinti į komandą“.
        </p>
      </div>
    </div>
  )
}

export function PlayLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary-ink" />
    </div>
  )
}

/** "Pradėti" pressed, the tasks are on their way. */
export function PlayPreparing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-primary-ink" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Ruošiamos užduotys...</p>
    </div>
  )
}

/**
 * The activity was reverted to draft, or has no tasks (e.g. the facilitator
 * deleted them during the activity): a message instead of a spinner.
 */
export function PlayNotReady({ draft, onRefresh }: { draft: boolean; onRefresh: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-highlight/10 flex items-center justify-center">
          <Clock className="h-8 w-8 text-highlight-ink" />
        </div>
        <h1 className="text-xl font-bold text-steam-dark mb-2">
          {draft
            ? "Veikla dar neprasidėjo"
            : "Veikloje dar nėra užduočių"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {draft
            ? "Palaukite, kol vedėjas pradės veiklą, ir bandykite dar kartą."
            : "Paklauskite vedėjo, ar veikla paruošta, ir bandykite dar kartą."}
        </p>
        <Button
          onClick={onRefresh}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Atnaujinti
        </Button>
      </div>
    </div>
  )
}

/** Paused by the facilitator: full screen until the activity resumes. */
export function PlayPaused({
  gameId,
  announcement,
  totalPoints,
  teamName,
}: {
  gameId: string | null
  /** From the play page's status poll. */
  announcement: AnnouncementItem | null
  totalPoints: number
  teamName: string
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-steam-dark">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center text-white"
        role="status"
        aria-live="polite"
      >
        {/* An announcement sent during the pause reaches the team here too. */}
        {gameId && <AnnouncementBanner gameId={gameId} latest={announcement} />}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
          <Clock className="h-10 w-10 text-highlight" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Veikla pristabdyta</h1>
        <p className="text-white/70 mb-6">
          Palaukite, kol vedėjas tęs veiklą. Jūsų taškai išsaugoti.
        </p>
        <div className="bg-white/5 rounded-2xl p-4 mb-2">
          <p className="text-2xl font-bold">{totalPoints} tšk.</p>
          <p className="text-sm text-white/60">
            Komanda: {teamName}
          </p>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-white/50">
          <div className="w-2 h-2 rounded-full bg-highlight animate-pulse" />
          Laukiama tęsimo...
        </div>
      </motion.div>
    </div>
  )
}

/** "Pasiruošę?" before a timed activity starts for this team. */
export function PlayReadyToStart({
  minutes,
  taskCount,
  teamName,
  onStart,
}: {
  minutes: number
  taskCount: number
  teamName: string
  onStart: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Clock className="h-10 w-10 text-primary-ink" />
        </div>

        <h1 className="text-2xl font-bold text-steam-dark mb-2">
          Pasiruošę?
        </h1>
        <p className="text-muted-foreground mb-2">
          Ši veikla turi laiko limitą.
        </p>

        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 mb-6">
          <p className="text-lg font-bold text-steam-dark">
            {minutes} min.
          </p>
          <p className="text-sm text-muted-foreground">
            Paspaudus „Pradėti“, laikas pradės skaičiuotis atgal.
          </p>
        </div>

        <div className="space-y-3 text-left mb-6 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-primary-ink font-bold mt-0.5">•</span>
            <span>Užduočių skaičius: <strong className="text-steam-dark">{taskCount}</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary-ink font-bold mt-0.5">•</span>
            <span>Pasibaigus laikui, atsakymai nebebus priimami</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary-ink font-bold mt-0.5">•</span>
            <span>Jūsų rezultatai bus išsaugoti</span>
          </div>
        </div>

        <Button
          size="lg"
          onClick={onStart}
          className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg shadow-lg shadow-primary/25 gap-3"
        >
          <Play className="h-6 w-6" />
          Pradėti
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Komanda: <span className="font-medium text-steam-dark">{teamName}</span>
        </p>
      </motion.div>
    </div>
  )
}

/**
 * The end of the activity for this team: time is up, every task is solved,
 * or the facilitator finished it. Results, leaderboard, reflection.
 */
export function PlayEnd({
  reason,
  solved,
  total,
  totalPoints,
  teamName,
  gameCode,
  sessionToken,
  challenges,
  showLeaderboard,
  showReflection,
  onReflectionDone,
  allowAccessRequests,
}: {
  reason: "time_up" | "all_solved" | "ended_by_facilitator"
  solved: number
  total: number
  totalPoints: number
  teamName: string
  gameCode: string
  sessionToken: string
  challenges: { id: string; title: string }[]
  showLeaderboard: boolean
  showReflection: boolean
  onReflectionDone: () => void
  allowAccessRequests: boolean
}) {
  const timeUp = reason === "time_up"
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center"
      >
        {timeUp ? (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent/10 flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-accent-ink" />
            </div>
            <h1 className="text-2xl font-bold text-steam-dark mb-2">
              Laikas baigėsi!
            </h1>
            <p className="text-muted-foreground mb-6">
              Veiklai skirtas laikas baigėsi. Jūsų rezultatai buvo išsaugoti.
            </p>
          </>
        ) : (
          <>
            <Image src="/illustrations/celebration.svg" alt="" width={192} height={192} className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-steam-dark mb-2">
              {reason === "ended_by_facilitator" ? "Veikla baigta!" : "Sveikiname! 🎉"}
            </h1>
            <p className="text-muted-foreground mb-4">
              {reason === "ended_by_facilitator"
                ? `Vedėjas užbaigė veiklą. Išsprendėte ${solved} iš ${total} užduočių.`
                : "Jūs išsprendėte visas užduotis!"}
            </p>
          </>
        )}

        <div className="bg-primary/5 rounded-2xl p-6 mb-6">
          <Trophy className="h-8 w-8 text-highlight-ink mx-auto mb-2" />
          <p className="text-3xl font-bold text-steam-dark">{totalPoints}</p>
          <p className="text-sm text-muted-foreground">surinktų taškų</p>
        </div>

        {timeUp && (
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mb-6">
            <span>{solved} iš {total} išspręsta</span>
          </div>
        )}

        <p className="text-sm font-medium text-steam-dark mb-1">
          Komanda: {teamName}
        </p>

        {showLeaderboard && (
          <Link href={`/play/${gameCode}/leaderboard`}>
            <Button className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              <BarChart3 className="h-4 w-4" />
              Rezultatų lentelė
            </Button>
          </Link>
        )}

        {showReflection && (
          <ReflectionForm
            challenges={challenges}
            sessionToken={sessionToken}
            gameCode={gameCode}
            onDone={onReflectionDone}
          />
        )}

        {allowAccessRequests && (
          <FinishRequestCard gameCode={gameCode} sessionToken={sessionToken} />
        )}
      </motion.div>
    </div>
  )
}

/**
 * Code, points, countdown and leaderboard link above the tasks. The
 * countdown is outline above 5 min, highlighted from 5 min and red and
 * pulsing in the last minute.
 */
export function PlayHeader({
  gameCode,
  totalPoints,
  timeLimitMinutes,
  remainingSeconds,
  showLeaderboard,
}: {
  gameCode: string
  totalPoints: number
  timeLimitMinutes: number | null
  remainingSeconds: number
  showLeaderboard: boolean
}) {
  const critical = remainingSeconds <= 60
  const warning = remainingSeconds <= 300
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs tracking-wider">
          {gameCode}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Star className="h-3 w-3 text-highlight-ink" />
          {totalPoints} tšk.
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        {timeLimitMinutes && remainingSeconds > 0 && (
          <Badge
            variant={critical ? "destructive" : warning ? "default" : "outline"}
            className={`gap-1 font-mono text-xs tabular-nums ${
              critical ? "animate-pulse" : ""
            } ${warning && !critical ? "bg-highlight text-highlight-foreground" : ""}`}
            aria-label={`Liko laiko ${formatTime(remainingSeconds)}`}
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatTime(remainingSeconds)}
          </Badge>
        )}
        {timeLimitMinutes && <TimerAnnouncer seconds={remainingSeconds} />}
        {showLeaderboard && (
          <Link href={`/play/${gameCode}/leaderboard`}>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Lentelė
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}

/** Team name and "leave team" under the tasks. */
export function TeamFooter({
  teamName,
  onLeave,
  className = "",
}: {
  teamName: string
  onLeave: () => void
  className?: string
}) {
  return (
    <div className={`text-center text-sm text-muted-foreground${className ? ` ${className}` : ""}`}>
      <span>Komanda: </span>
      <span className="font-medium text-steam-dark">{teamName}</span>
      <span className="mx-2">&middot;</span>
      <LeaveTeamButton onLeave={onLeave} />
    </div>
  )
}
