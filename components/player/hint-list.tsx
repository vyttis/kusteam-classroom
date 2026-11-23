"use client"

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Lightbulb, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { calculatePoints, nextHintCost } from "@/lib/game/scoring"
import { SECONDARY_BUTTON, TEXT_BUTTON } from "@/components/player/play-ui"

// Hints of one task. The server sends only the hints this team has opened
// (others are null), so a hint's text arrives when the team asks for it and
// the penalty is recorded at the same moment. A hint that costs points is
// opened in two steps: the first shows the price and what the task will
// then be worth, the second spends it. A free hint opens at once.
export function HintList({
  hints,
  penalty,
  points,
  solved = false,
  onReveal,
}: {
  hints: (string | null)[]
  penalty: number
  /** The task's points: hints never take more than half of them. */
  points: number
  /** Answered correctly: opened hints stay, no offer of another one. */
  solved?: boolean
  onReveal: (index: number) => Promise<boolean>
}) {
  const reduce = useReducedMotion()
  const [opening, setOpening] = useState(false)
  const [failed, setFailed] = useState(false)
  const [asking, setAsking] = useState(false)

  if (hints.length === 0) return null

  const shown = hints.filter((hint): hint is string => hint !== null)
  const nextIndex = hints.findIndex((hint) => hint === null)
  const cost = nextHintCost(points, shown.length, penalty)
  const worthNow = calculatePoints(points, shown.length, penalty)
  const worthAfter = calculatePoints(points, shown.length + 1, penalty)
  const unfold = reduce ? { duration: 0 } : { duration: 0.25, ease: "easeOut" as const }

  async function reveal() {
    if (opening || nextIndex < 0) return
    setOpening(true)
    setFailed(false)
    const ok = await onReveal(nextIndex)
    setFailed(!ok)
    setOpening(false)
    if (ok) setAsking(false)
  }

  return (
    <div className="mb-4 space-y-2">
      {shown.map((hint, i) => (
        <motion.div
          key={i}
          initial={reduce ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={unfold}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2.5 rounded-xl border border-highlight bg-highlight/20 p-3 text-left">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">
                Užuomina{hints.length > 1 ? ` ${i + 1}` : ""}
              </p>
              <p className="break-words text-base text-foreground">{hint}</p>
            </div>
          </div>
        </motion.div>
      ))}

      {nextIndex >= 0 && !solved && !asking && (
        <Button
          type="button"
          variant="outline"
          onClick={() => (cost > 0 ? setAsking(true) : void reveal())}
          disabled={opening}
          className={`${SECONDARY_BUTTON} flex-wrap gap-x-2 gap-y-0 px-4`}
        >
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            {opening ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
            ) : (
              <Lightbulb aria-hidden />
            )}
            {shown.length === 0 ? "Reikia užuominos?" : `Kita užuomina (${shown.length}/${hints.length})`}
          </span>
          {cost > 0 && <span className="whitespace-nowrap font-normal">(-{cost} tšk.)</span>}
        </Button>
      )}

      <AnimatePresence initial={false}>
        {nextIndex >= 0 && !solved && asking && (
          <motion.div
            key="ask"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, height: 0 }}
            transition={unfold}
            className="overflow-hidden"
          >
            <div
              role="group"
              aria-label="Ar atverti užuominą?"
              className="rounded-xl border-2 border-foreground/25 bg-white p-4 text-left"
            >
              <p className="font-bold text-foreground">Užuomina kainuos {cost} tšk.</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Už teisingą atsakymą tada gausite {worthAfter} tšk. vietoj {worthNow}. Atvertos užuominos uždaryti
                nebegalima.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={reveal} disabled={opening} className={SECONDARY_BUTTON}>
                  {opening ? <Loader2 className="motion-safe:animate-spin" aria-hidden /> : <Lightbulb aria-hidden />}
                  Atverti už {cost} tšk.
                </Button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    setAsking(false)
                    setFailed(false)
                  }}
                  disabled={opening}
                  className={TEXT_BUTTON}
                >
                  Ne dabar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {failed && (
        <p role="alert" className="text-sm text-foreground">
          Užuominos atverti nepavyko. Bandykite dar kartą.
        </p>
      )}
    </div>
  )
}
