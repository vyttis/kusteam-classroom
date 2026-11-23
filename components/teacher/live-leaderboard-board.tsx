"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, animate } from "framer-motion"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import type { LiveTeam } from "@/hooks/use-live-game"
import { sharedRanks } from "@/lib/game/live-board"
import { Crown } from "lucide-react"
import { cn, pluralizeLt } from "@/lib/utils"

interface LiveLeaderboardBoardProps {
  teams: LiveTeam[]
  solvedCounts: Map<string, number>
  totalChallenges: number
  /**
   * false when the activity's leaderboard is off: the class screen then
   * lists the teams that joined, by name, without places, points or progress.
   */
  ranked?: boolean
}

// Place markers: a number read from the back of the room. Only a team with
// points has a place (lib/game/live-board.ts); teams level on points share it.
const RANK_STYLES: Record<number, string> = {
  1: "bg-highlight text-highlight-foreground",
  2: "bg-white text-steam-dark",
  3: "bg-white/25 text-white ring-2 ring-inset ring-accent",
}

const ROW_STYLES: Record<number, string> = {
  1: "border-highlight/70 bg-highlight/10",
  2: "border-white/35 bg-white/10",
  3: "border-accent/60 bg-white/[0.07]",
}

/**
 * Points that count up to their new value. With reduced motion the new
 * value is simply shown.
 */
function CountUp({ value, instant }: { value: number; instant: boolean }) {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)

  useEffect(() => {
    if (instant || shownRef.current === value) {
      shownRef.current = value
      return
    }
    const controls = animate(shownRef.current, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (latest) => {
        shownRef.current = Math.round(latest)
        setShown(shownRef.current)
      },
    })
    return () => controls.stop()
  }, [value, instant])

  return <>{instant ? value : shown}</>
}

// Large ranked leaderboard for the projector class screen (dark background).
export function LiveLeaderboardBoard({
  teams,
  solvedCounts,
  totalChallenges,
  ranked = true,
}: LiveLeaderboardBoardProps) {
  const prefersReduced = useReducedMotion()
  const spring = prefersReduced ? { duration: 0 } : { type: "spring" as const, stiffness: 300, damping: 32 }

  if (teams.length === 0) {
    return (
      <p className="py-24 text-center text-2xl text-white/70">Veikloje nedalyvavo nė viena komanda</p>
    )
  }

  if (!ranked) {
    const byName = [...teams].sort((a, b) => a.name.localeCompare(b.name, "lt"))
    return (
      <div>
        <p className="mb-4 text-lg text-white/80">
          Prisijungė {teams.length} {pluralizeLt(teams.length, "komanda", "komandos", "komandų")}. Rezultatų lentelė
          šioje veikloje nerodoma.
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {byName.map((team) => (
              <motion.li
                key={team.id}
                layout={!prefersReduced}
                initial={prefersReduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0 }}
                transition={spring}
                className="truncate rounded-2xl border border-white/15 bg-white/[0.07] px-6 py-4 text-2xl font-bold text-white sm:text-3xl"
              >
                {team.name}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    )
  }

  // More than six teams: compact rows, so a class of ten or more fits on
  // one projector screen.
  const compact = teams.length > 6
  const ranks = sharedRanks(teams)

  return (
    <ol className={compact ? "space-y-2" : "space-y-3"}>
      <AnimatePresence initial={false}>
        {teams.map((team, index) => {
          const rank = ranks[index]
          const podium = rank !== null && rank <= 3
          const solved = solvedCounts.get(team.id) ?? 0

          return (
            <motion.li
              key={team.id}
              layout={!prefersReduced}
              initial={prefersReduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0 }}
              transition={spring}
              className={cn(
                "relative flex items-center overflow-hidden rounded-2xl border",
                compact ? "gap-3 px-4 py-2 sm:gap-4 sm:px-5" : "gap-3 px-4 py-3 sm:gap-5 sm:px-6 sm:py-4",
                podium ? ROW_STYLES[rank] : "border-white/15 bg-white/[0.05]",
              )}
            >
              {/* A solved task: the row lights up once and settles. */}
              {!prefersReduced && solved > 0 && (
                <motion.span
                  key={solved}
                  aria-hidden="true"
                  initial={{ opacity: 0.55 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                  className="pointer-events-none absolute inset-0 bg-primary"
                />
              )}

              <div
                className={cn(
                  "relative flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums",
                  compact ? "h-10 w-10 text-xl" : "h-11 w-11 text-2xl sm:h-14 sm:w-14 sm:text-3xl",
                  podium ? RANK_STYLES[rank] : "bg-white/10 text-white",
                )}
              >
                {rank !== null ? (
                  <>
                    <span className="sr-only">Vieta: </span>
                    {rank}
                  </>
                ) : (
                  <span className="sr-only">Dar be taškų</span>
                )}
              </div>

              <div className="relative min-w-0 flex-1">
                <p
                  className={cn(
                    "flex items-center gap-2 font-bold text-white",
                    compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl lg:text-4xl",
                  )}
                >
                  <span className="truncate">{team.name}</span>
                  {rank === 1 && (
                    <Crown className="h-7 w-7 shrink-0 text-highlight" aria-hidden="true" />
                  )}
                </p>
                <p className={cn("text-white/80", compact ? "text-sm" : "text-base sm:text-lg")}>
                  {solved} / {totalChallenges} užd. išspręsta
                </p>
              </div>

              <div className="relative shrink-0 text-right">
                <p
                  className={cn(
                    "font-bold tabular-nums leading-none text-white",
                    compact ? "text-3xl" : "text-4xl sm:text-5xl",
                  )}
                >
                  <CountUp value={team.total_points} instant={prefersReduced} />
                </p>
                <p className="mt-1 text-sm text-white/80">taškų</p>
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}
