"use client"

/**
 * Shared building blocks of the participant screens: the full-height
 * wrapper, button looks, the status screen, the points counter, the
 * segmented task progress and the shake of a wrong answer.
 *
 * Motion rule (DESIGN-SYSTEM.md, "Judesys"): everything here answers an
 * action and is instant under prefers-reduced-motion.
 */

import { useEffect, useRef, useState, type ReactNode } from "react"
import { AnimatePresence, animate, motion, useAnimationControls, useReducedMotion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TaskSegment } from "@/components/player/play-progress"

/**
 * Full viewport height. dvh follows the phone's address bar; vh stays for
 * browsers without it.
 */
export const SCREEN = "min-h-screen supports-[min-height:100dvh]:min-h-dvh"

/** The one main action of a screen: 48 px, pill. */
export const PRIMARY_BUTTON =
  "h-auto min-h-12 w-full whitespace-normal rounded-full bg-primary px-6 py-2 text-base font-bold text-primary-foreground shadow-none hover:bg-primary/90 [&_svg]:size-5"

/** A second action: outlined, 44 px, pill. */
export const SECONDARY_BUTTON =
  "h-auto min-h-11 whitespace-normal rounded-full border-2 border-foreground/25 bg-white px-5 py-2 text-base font-bold text-foreground shadow-none hover:bg-muted [&_svg]:size-5"

/** A third action: text only, still 44 px tall. */
export const TEXT_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-base text-foreground underline underline-offset-4 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

const TONE_BG = {
  /** Neutral information. */
  info: "bg-secondary/15",
  /** Something to wait for. */
  wait: "bg-highlight/30",
  /** Something went wrong; still calm. */
  problem: "bg-accent/15",
} as const

export type Tone = keyof typeof TONE_BG

/**
 * A whole-screen message (waiting, not found, connection lost, moved to
 * another device). One look for all of them: icon, heading, what happened
 * and what to do, then the actions.
 */
export function StateScreen({
  icon: Icon,
  tone = "info",
  title,
  children,
  actions,
  role,
}: {
  icon: LucideIcon
  tone?: Tone
  title: string
  children: ReactNode
  actions?: ReactNode
  role?: "status"
}) {
  return (
    <div className={cn(SCREEN, "flex items-center justify-center p-4")}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 text-center" role={role}>
        <div className={cn("mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full", TONE_BG[tone])}>
          <Icon className="h-7 w-7 text-foreground" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-foreground">{title}</h1>
        <div className="space-y-2 text-base text-muted-foreground">{children}</div>
        {actions && <div className="mt-6 flex flex-col items-stretch gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/**
 * A number that counts up to its new value (points after a correct
 * answer). It never counts down and is instant with reduced motion.
 */
export function CountUp({
  value,
  from,
  suffix = "",
  className,
}: {
  value: number
  /** Start of the first count; without it the value is simply shown. */
  from?: number
  suffix?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(from ?? value)
  // What is on screen now: a new count starts from it.
  const shownRef = useRef(from ?? value)

  useEffect(() => {
    const show = (n: number) => {
      shownRef.current = n
      setShown(n)
    }
    const start = shownRef.current
    if (reduce || start >= value) {
      show(value)
      return
    }
    const controls = animate(start, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => show(Math.round(v)),
    })
    return () => controls.stop()
  }, [value, reduce])

  return <span className={className}>{`${shown}${suffix}`}</span>
}

/**
 * One segment per task: solved, open now, still to do. A segment fills
 * when its task is solved; segments already solved when the bar appears
 * are simply full.
 */
export function SegmentedProgress({
  segments,
  className,
}: {
  segments: { id: string; state: TaskSegment }[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const solved = segments.filter((s) => s.state === "solved").length
  return (
    <div
      role="progressbar"
      aria-label="Išspręstos užduotys"
      aria-valuemin={0}
      aria-valuemax={segments.length}
      aria-valuenow={solved}
      aria-valuetext={`${solved} iš ${segments.length}`}
      className={cn("flex gap-1", className)}
    >
      {segments.map((segment) => (
        <span
          key={segment.id}
          className={cn(
            "relative h-2 min-w-0 flex-1 overflow-hidden rounded-full",
            segment.state === "current" ? "bg-foreground" : "bg-foreground/15",
          )}
        >
          <AnimatePresence initial={false}>
            {segment.state === "solved" && (
              <motion.span
                key="fill"
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: reduce ? 0 : 0.45, ease: "easeOut" }}
                className="absolute inset-0 origin-left rounded-full bg-primary"
              />
            )}
          </AnimatePresence>
        </span>
      ))}
    </div>
  )
}

/**
 * Shakes its content sideways once each time `trigger` grows (a wrong
 * answer). Nothing moves with reduced motion.
 */
export function Shake({ trigger, children, className }: { trigger: number; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const controls = useAnimationControls()
  useEffect(() => {
    if (trigger === 0 || reduce) return
    void controls.start({ x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: 0.4, ease: "easeInOut" } })
  }, [trigger, reduce, controls])
  return (
    <motion.div animate={controls} className={className}>
      {children}
    </motion.div>
  )
}
