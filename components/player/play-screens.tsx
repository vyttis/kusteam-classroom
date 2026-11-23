"use client"

/**
 * Full-screen states and shared chrome of the participant task page
 * (app/play/[gameCode]/play). Presentation only: the page owns the state
 * and decides which one to show.
 */

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, useAnimationControls, useReducedMotion } from "framer-motion"
import { BarChart3, Check, Clock, CloudOff, Hourglass, Loader2, Play, Smartphone, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SteamRays } from "@/components/brand/steam-rays"
import { AnnouncementBanner, type AnnouncementItem } from "@/components/player/announcement-banner"
import { ReflectionForm } from "@/components/player/reflection-form"
import { FinishRequestCard } from "@/components/access/finish-request-card"
import { TimerAnnouncer } from "@/components/player/timer-announcer"
import { LeaveTeamButton } from "@/components/player/leave-team-button"
import { taskSegments, teamPlace } from "@/components/player/play-progress"
import {
  CountUp,
  PRIMARY_BUTTON,
  SCREEN,
  SECONDARY_BUTTON,
  SegmentedProgress,
  StateScreen,
} from "@/components/player/play-ui"
import { formatTime } from "@/lib/game/play-format"
import type { LeaderboardResponse } from "@/lib/game/leaderboard"
import { readStored, writeStored } from "@/lib/game/session"

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
    <StateScreen
      icon={CloudOff}
      tone="wait"
      title="Nepavyko įkelti veiklos"
      actions={
        <Button onClick={onRetry} className={PRIMARY_BUTTON}>
          Bandyti dar kartą
        </Button>
      }
    >
      <p>Patikrinkite interneto ryšį arba paklauskite vedėjo, ar veikla vis dar vyksta.</p>
      <p className="min-h-6" role="status" aria-live="polite">
        {retrying ? "Bandome prisijungti iš naujo..." : ""}
      </p>
      <p className="text-sm">
        Jei nepavyksta, paprašykite vedėjo nuorodos arba QR kodo „Grąžinti į komandą“. Jūsų taškai išsaugoti.
      </p>
    </StateScreen>
  )
}

export function PlayLoading() {
  return (
    <div className={`${SCREEN} flex items-center justify-center`} role="status">
      <Loader2 className="h-8 w-8 text-foreground motion-safe:animate-spin" aria-hidden="true" />
      <span className="sr-only">Kraunama...</span>
    </div>
  )
}

/**
 * The facilitator's "Grąžinti į komandą" link was used on another device:
 * the team's session moved there and this device no longer has it. Not an
 * error and nothing to retry, so the screen only says what happened and how
 * to come back.
 */
export function PlaySessionMoved({ teamName, gameCode }: { teamName: string; gameCode: string }) {
  return (
    <StateScreen
      icon={Smartphone}
      tone="info"
      role="status"
      title="Komanda tęsia kitame įrenginyje"
      actions={
        <Button asChild variant="outline" className={SECONDARY_BUTTON}>
          <Link href={`/play/${gameCode}`}>Į prisijungimo puslapį</Link>
        </Button>
      }
    >
      <p>
        {teamName ? `Komanda „${teamName}“` : "Jūsų komanda"} perkelta į kitą įrenginį su vedėjo nuoroda „Grąžinti į
        komandą“. Šiame įrenginyje atsakymų pateikti nebegalima, o komandos taškai ir išspręstos užduotys išliko.
      </p>
      <p>Jei norite tęsti šiame įrenginyje, paprašykite vedėjo naujos nuorodos arba QR kodo.</p>
    </StateScreen>
  )
}

/** "Pradėti" pressed, the tasks are on their way. */
export function PlayPreparing() {
  return (
    <div className={`${SCREEN} flex flex-col items-center justify-center gap-3 p-4`} role="status">
      <Loader2 className="h-8 w-8 text-foreground motion-safe:animate-spin" aria-hidden="true" />
      <p className="text-base text-muted-foreground">Ruošiamos užduotys...</p>
    </div>
  )
}

/**
 * The activity was reverted to draft, or has no tasks (e.g. the facilitator
 * deleted them during the activity): a message instead of a spinner.
 */
export function PlayNotReady({ draft, onRefresh }: { draft: boolean; onRefresh: () => void }) {
  return (
    <StateScreen
      icon={Hourglass}
      tone="wait"
      title={draft ? "Veikla dar neprasidėjo" : "Veikloje dar nėra užduočių"}
      actions={
        <Button onClick={onRefresh} className={PRIMARY_BUTTON}>
          Atnaujinti
        </Button>
      }
    >
      <p>
        {draft
          ? "Palaukite, kol vedėjas pradės veiklą, ir bandykite dar kartą."
          : "Paklauskite vedėjo, ar veikla paruošta, ir bandykite dar kartą."}
      </p>
    </StateScreen>
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
    <div className={`${SCREEN} flex items-center justify-center bg-foreground p-4`}>
      <div className="w-full max-w-sm text-center text-white" role="status" aria-live="polite">
        {/* An announcement sent during the pause reaches the team here too. */}
        {gameId && <AnnouncementBanner gameId={gameId} latest={announcement} />}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <Hourglass className="h-8 w-8 text-highlight" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Veikla pristabdyta</h1>
        <p className="mb-6 text-base text-white">Palaukite, kol vedėjas tęs veiklą. Jūsų taškai išsaugoti.</p>
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-2xl font-bold tabular-nums">{totalPoints} tšk.</p>
          <p className="text-sm text-white">Komanda: {teamName}</p>
        </div>
        <p className="mt-4 text-sm text-white">Šis langas atsinaujins pats.</p>
      </div>
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
    <div className={`${SCREEN} flex items-center justify-center p-4`}>
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-3xl font-bold text-foreground">Pasiruošę?</h1>
        <p className="mb-5 text-center text-base text-muted-foreground">Ši veikla turi laiko limitą.</p>

        {/* Neutral information: white, with the clock, not a warning colour. */}
        <div className="mb-5 rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary/15">
              <Clock className="h-7 w-7 text-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-3xl font-bold leading-tight text-foreground tabular-nums">{minutes} min.</p>
              <p className="text-sm text-muted-foreground">Laikas skaičiuojamas nuo tada, kai paspausite „Pradėti“.</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 border-t border-border pt-4 text-base text-foreground">
            <li>
              <span>
                Užduočių skaičius: <strong className="font-bold">{taskCount}</strong>
              </span>
            </li>
            <li>Pasibaigus laikui, atsakymai nebebus priimami.</li>
            <li>Jūsų rezultatai bus išsaugoti.</li>
          </ul>
        </div>

        <Button onClick={onStart} className={`${PRIMARY_BUTTON} min-h-14 text-lg`}>
          <Play aria-hidden="true" />
          Pradėti
        </Button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Komanda: <span className="font-bold text-foreground">{teamName}</span>
        </p>
      </div>
    </div>
  )
}

// A small burst of paper pieces in the ray colours, once, behind the rays
// of the end screen. Fixed offsets: nothing random at render time.
const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + 0.3
  const distance = 52 + (i % 3) * 16
  return {
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance * 0.7) - 18,
    rotate: (i % 2 === 0 ? 1 : -1) * (120 + i * 17),
    color: ["bg-primary", "bg-accent", "bg-highlight", "bg-secondary", "bg-foreground"][i % 5],
  }
})

function Confetti() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2">
      {CONFETTI.map((piece, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.6 }}
          animate={{ x: piece.x, y: [0, piece.y, piece.y + 14], opacity: [0, 1, 1, 0], rotate: piece.rotate, scale: 1 }}
          transition={{ duration: 1.3, delay: 0.35, ease: "easeOut" }}
          className={`absolute h-2.5 w-1.5 rounded-sm ${piece.color}`}
        />
      ))}
    </span>
  )
}

/**
 * The end of the activity for this team: time is up, every task is solved,
 * or the facilitator finished it. First what the team achieved (place,
 * points, tasks), then the reflection, then the way to the board. One main
 * action at a time: saving the reflection while it is open, the board
 * after it.
 */
export function PlayEnd({
  reason,
  solved,
  total,
  totalPoints,
  teamName,
  teamId,
  gameCode,
  sessionToken,
  challenges,
  solvedIds,
  final,
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
  teamId: string
  gameCode: string
  sessionToken: string
  challenges: { id: string; title: string }[]
  solvedIds: ReadonlySet<string>
  /** The facilitator ended the activity: places no longer change. */
  final: boolean
  showLeaderboard: boolean
  showReflection: boolean
  onReflectionDone: () => void
  allowAccessRequests: boolean
}) {
  const reduce = useReducedMotion()
  const [reflectionOpen, setReflectionOpen] = useState(true)
  const reflectionPending = showReflection && reflectionOpen

  // The team's place, from the board everyone with the code may read.
  // While other teams still play it is asked again now and then.
  const [place, setPlace] = useState<{ rank: number | null; of: number } | null>(null)
  useEffect(() => {
    if (!showLeaderboard) return
    let disposed = false
    const load = async () => {
      if (document.visibilityState !== "visible") return
      try {
        const res = await fetch(`/api/play/leaderboard?game_code=${encodeURIComponent(gameCode)}`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as LeaderboardResponse
        if (!disposed && data.state === "ok") setPlace(teamPlace(data.teams, teamId))
      } catch {
        // No place shown; the points below are the team's own.
      }
    }
    void load()
    if (final) return () => void (disposed = true)
    const interval = setInterval(load, 15_000)
    return () => {
      disposed = true
      clearInterval(interval)
    }
  }, [showLeaderboard, gameCode, teamId, final, totalPoints])

  // Confetti: only for a team that solved everything, and once per
  // activity on this device (not again after a reload or an added task).
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (reason !== "all_solved" || reduce) return
    const key = `ctf_celebrated_${gameCode}`
    if (readStored(key)) return
    writeStored(key, "1")
    setCelebrate(true)
  }, [reason, reduce, gameCode])

  const heading =
    reason === "time_up" ? "Laikas baigėsi!" : reason === "ended_by_facilitator" ? "Veikla baigta!" : "Sveikiname!"
  const summary =
    reason === "time_up"
      ? "Veiklai skirtas laikas baigėsi. Jūsų rezultatai buvo išsaugoti."
      : reason === "ended_by_facilitator"
        ? `Vedėjas užbaigė veiklą. Išsprendėte ${solved} iš ${total} užduočių.`
        : "Jūs išsprendėte visas užduotis!"

  const boardLink = showLeaderboard && (
    <Button
      asChild
      variant={reflectionPending ? "outline" : "default"}
      className={reflectionPending ? `${SECONDARY_BUTTON} w-full` : PRIMARY_BUTTON}
    >
      <Link href={`/play/${gameCode}/leaderboard`}>
        <BarChart3 aria-hidden="true" />
        Rezultatų lentelė
      </Link>
    </Button>
  )

  return (
    <div className={`${SCREEN} flex justify-center px-4 pb-24 pt-8`}>
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="relative mx-auto mb-3 w-fit">
            {celebrate && <Confetti />}
            <SteamRays draw className="relative h-24 w-auto" />
          </div>
          <h1 className="mb-1 text-3xl font-bold text-foreground">{heading}</h1>
          <p className="mb-5 text-base text-muted-foreground">{summary}</p>
        </div>

        <div className="mb-4 rounded-2xl border border-border bg-white p-5">
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Komanda: <span className="font-bold text-foreground">{teamName}</span>
          </p>
          <div className={`grid gap-3 text-center ${place?.rank ? "grid-cols-2" : "grid-cols-1"}`}>
            {place?.rank ? (
              <div className="rounded-xl bg-highlight/30 p-4">
                <p className="text-4xl font-bold leading-none text-foreground tabular-nums">{place.rank}</p>
                <p className="mt-1 text-sm text-foreground">vieta iš {place.of}</p>
              </div>
            ) : null}
            <div className="rounded-xl bg-primary/15 p-4">
              <p className="text-4xl font-bold leading-none text-foreground tabular-nums">
                <CountUp value={totalPoints} from={0} />
              </p>
              <p className="mt-1 text-sm text-foreground">surinktų taškų</p>
            </div>
          </div>
        </div>

        {place?.rank && !final ? (
          <p className="-mt-2 mb-4 text-center text-sm text-muted-foreground">
            Vieta dar gali keistis, kol kitos komandos sprendžia.
          </p>
        ) : null}

        {total > 0 && (
          <section aria-labelledby="end-tasks" className="mb-4 rounded-2xl border border-border bg-white p-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id="end-tasks" className="text-base font-bold text-foreground">
                Jūsų užduotys
              </h2>
              <p className="text-sm text-muted-foreground">
                Išspręsta {solved} iš {total}
              </p>
            </div>
            <SegmentedProgress
              segments={taskSegments(challenges.map((c) => c.id), solvedIds).map((state, i) => ({
                id: challenges[i].id,
                state,
              }))}
            />
            <ul className="mt-3 space-y-1.5 text-left">
              {challenges.map((c) => {
                const done = solvedIds.has(c.id)
                return (
                  <li key={c.id} className="flex items-start gap-2.5 text-base">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        done ? "bg-primary" : "border-2 border-foreground/25"
                      }`}
                    >
                      {done && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
                    </span>
                    <span className={`min-w-0 break-words ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {c.title}
                      <span className="sr-only">{done ? " (išspręsta)" : " (neišspręsta)"}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {showReflection && (
          <ReflectionForm
            challenges={challenges}
            sessionToken={sessionToken}
            gameCode={gameCode}
            onDone={() => {
              setReflectionOpen(false)
              onReflectionDone()
            }}
          />
        )}

        {boardLink && <div className="mt-4">{boardLink}</div>}

        {allowAccessRequests && <FinishRequestCard gameCode={gameCode} sessionToken={sessionToken} />}
      </div>
    </div>
  )
}

/**
 * Points, countdown and the way to the board above the tasks. The points
 * count up and the pill pops when the team scores. The countdown is plain
 * above 5 min, yellow from 5 min and dark in the last minute: time running
 * out is not an error, so it is never red.
 */
export function PlayHeader({
  totalPoints,
  timeLimitMinutes,
  remainingSeconds,
  showLeaderboard,
  gameCode,
}: {
  gameCode: string
  totalPoints: number
  timeLimitMinutes: number | null
  remainingSeconds: number
  showLeaderboard: boolean
}) {
  const reduce = useReducedMotion()
  const pop = useAnimationControls()
  const lastPoints = useRef(totalPoints)
  useEffect(() => {
    const gained = totalPoints > lastPoints.current
    lastPoints.current = totalPoints
    if (gained && !reduce) {
      void pop.start({ scale: [1, 1.14, 1], transition: { duration: 0.45, ease: "easeOut" } })
    }
  }, [totalPoints, reduce, pop])

  const critical = remainingSeconds <= 60
  const warning = remainingSeconds <= 300
  return (
    <div className="flex min-h-11 items-center justify-between gap-2">
      <motion.div
        animate={pop}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-base font-bold text-background tabular-nums"
      >
        <Star className="h-4 w-4 fill-highlight text-highlight" aria-hidden="true" />
        <CountUp value={totalPoints} suffix=" tšk." />
      </motion.div>
      <div className="flex items-center gap-1">
        {timeLimitMinutes && remainingSeconds > 0 && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 font-mono text-base font-bold tabular-nums ${
              critical
                ? "border-foreground bg-foreground text-background"
                : warning
                  ? "border-highlight bg-highlight text-highlight-foreground"
                  : "border-foreground/25 bg-white text-foreground"
            }`}
            aria-label={`Liko laiko ${formatTime(remainingSeconds)}`}
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            {formatTime(remainingSeconds)}
          </span>
        )}
        {timeLimitMinutes && <TimerAnnouncer seconds={remainingSeconds} />}
        {showLeaderboard && (
          <Link
            href={`/play/${gameCode}/leaderboard`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-base font-bold text-foreground hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
            Lentelė
          </Link>
        )}
      </div>
    </div>
  )
}

/** Team name, activity code and "leave team" under the tasks. */
export function TeamFooter({
  teamName,
  gameCode,
  onLeave,
  className = "",
}: {
  teamName: string
  gameCode: string
  onLeave: () => void
  className?: string
}) {
  return (
    <div className={`text-center text-sm text-muted-foreground${className ? ` ${className}` : ""}`}>
      <p>
        <span>
          Komanda: <span className="font-bold text-foreground">{teamName}</span>
        </span>
        <span className="mx-2" aria-hidden="true">
          &middot;
        </span>
        <span>
          Kodas <span className="font-mono tracking-wider text-foreground">{gameCode}</span>
        </span>
      </p>
      <LeaveTeamButton onLeave={onLeave} />
    </div>
  )
}
