"use client"

import { useEffect } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Crown, Zap, Brain, Trophy, Flame, X, type LucideIcon } from "lucide-react"
import { ACHIEVEMENT_CONFIG, type AchievementType } from "@/lib/game/achievements"

const ICON_MAP: Record<string, LucideIcon> = {
  Crown,
  Zap,
  Brain,
  Trophy,
  Flame,
}

const ACHIEVEMENT_DESCRIPTIONS: Record<AchievementType, string> = {
  first_solver: "Išsprendėte užduotį pirmieji!",
  speed_demon: "Išsprendėte greičiau nei per minutę!",
  hint_free: "Išsprendėte be jokių užuominų!",
  perfect_game: "Visos užduotys be užuominų!",
  streak: "Teisingi atsakymai iš eilės!",
}

interface AchievementToastProps {
  achievement: {
    type: AchievementType
    metadata?: Record<string, unknown>
  }
  onDismiss: () => void
}

export function AchievementToast({
  achievement,
  onDismiss,
}: AchievementToastProps) {
  const config = ACHIEVEMENT_CONFIG[achievement.type]
  const Icon = ICON_MAP[config.icon]
  const reduce = useReducedMotion()

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  let description = ACHIEVEMENT_DESCRIPTIONS[achievement.type]
  if (
    achievement.type === "streak" &&
    typeof achievement.metadata?.streak_count === "number"
  ) {
    description = `${achievement.metadata.streak_count} teisingi atsakymai iš eilės!`
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
        role="status"
        // Inline on mobile (pushes content down — no overlap with title);
        // fixed top-right on desktop (out of the way).
        className="relative z-[60] mb-3 w-full sm:fixed sm:right-4 sm:top-4 sm:mb-0 sm:w-auto sm:max-w-sm"
      >
        <div
          className="flex items-center gap-3 rounded-2xl border border-highlight bg-white px-4 py-2 shadow-lg"
        >
          <div
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 40,
              height: 40,
              backgroundColor: `${config.color}1A`,
            }}
          >
            <Icon size={22} style={{ color: config.color }} strokeWidth={2.5} aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1 pr-1">
            <p className="text-base font-bold leading-tight text-foreground">
              <span className="sr-only">Pasiekimas: </span>
              {config.name}
            </p>
            <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
              {description}
            </p>
          </div>

          <button
            onClick={onDismiss}
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Uždaryti pasiekimo pranešimą"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
