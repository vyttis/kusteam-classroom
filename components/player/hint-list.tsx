"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Lightbulb, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { nextHintCost } from "@/lib/game/scoring"

// Hints of one task. The server sends only the hints this team has opened
// (others are null), so a hint's text arrives when the team asks for it and
// the penalty is recorded at the same moment.
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
  const [opening, setOpening] = useState(false)
  const [failed, setFailed] = useState(false)

  if (hints.length === 0) return null

  const shown = hints.filter((hint): hint is string => hint !== null)
  const nextIndex = hints.findIndex((hint) => hint === null)
  const cost = nextHintCost(points, shown.length, penalty)

  async function reveal() {
    if (opening || nextIndex < 0) return
    setOpening(true)
    setFailed(false)
    const ok = await onReveal(nextIndex)
    setFailed(!ok)
    setOpening(false)
  }

  return (
    <div className="mb-4 space-y-2">
      {shown.length > 0 && (
        <div className="space-y-1.5">
          {shown.map((hint, i) => (
            <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <div className="flex items-start gap-2 rounded-lg border border-highlight/30 bg-highlight/10 p-3 text-sm">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-highlight-ink" aria-hidden />
                <p className="text-steam-dark">{hint}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {nextIndex >= 0 && !solved && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reveal}
          disabled={opening}
          className="h-11 gap-1.5 px-3 text-highlight-ink hover:bg-highlight/10 hover:text-highlight-ink"
        >
          {opening ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Lightbulb className="h-3.5 w-3.5" aria-hidden />
          )}
          {shown.length === 0 ? "Reikia užuominos?" : `Kita užuomina (${shown.length}/${hints.length})`}
          {cost > 0 && <span className="text-xs font-semibold">(-{cost} tšk.)</span>}
        </Button>
      )}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          Užuominos atidengti nepavyko. Bandykite dar kartą.
        </p>
      )}
    </div>
  )
}
