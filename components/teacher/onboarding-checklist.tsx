"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CreateSampleGameButton } from "./create-sample-game-button"
import type { ChecklistStep } from "@/lib/teacher/dashboard"
import { CheckCircle2, Circle, Rocket, ChevronRight, X } from "lucide-react"

interface OnboardingChecklistProps {
  steps: ChecklistStep[]
  // Offer the one-click demo game while the teacher has nothing to work with
  showSampleGameButton: boolean
  /** Keeps "hidden" apart for two facilitators who share a browser. */
  userId: string
  className?: string
}

const HIDDEN_EVENT = "cls:first-steps-hidden"
const storageKey = (userId: string) => `cls:first-steps-hidden:${userId}`

function subscribe(onChange: () => void) {
  window.addEventListener(HIDDEN_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(HIDDEN_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

function readHidden(userId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1"
  } catch {
    return false
  }
}

// First-success checklist on the dashboard. Step state is derived from the
// teacher's actual data. Once every step is done the teacher can hide the
// card; that choice is remembered in this browser only.
export function OnboardingChecklist({
  steps,
  showSampleGameButton,
  userId,
  className = "",
}: OnboardingChecklistProps) {
  const allDone = steps.every((s) => s.done)
  // On the server the finished card counts as hidden, so a teacher who hid
  // it never sees it flash back while the page loads.
  const hidden = useSyncExternalStore(
    subscribe,
    () => readHidden(userId),
    () => true,
  )
  if (allDone && hidden) return null

  const doneCount = steps.filter((s) => s.done).length
  const progress = Math.round((doneCount / steps.length) * 100)

  function hide() {
    try {
      window.localStorage.setItem(storageKey(userId), "1")
    } catch {
      // Storage is blocked: the card stays, nothing else breaks.
    }
    window.dispatchEvent(new Event(HIDDEN_EVENT))
  }

  return (
    <Card className={`border-primary/30 bg-gradient-to-br from-primary/5 to-white ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-base font-semibold leading-none tracking-tight">
            <Rocket className="h-4 w-4 text-primary-ink" aria-hidden="true" />
            Pirmieji žingsniai
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              <span className="sr-only">Atlikta žingsnių: </span>
              {doneCount} / {steps.length}
            </span>
            {allDone && (
              <Button variant="ghost" size="sm" onClick={hide} className="h-8 gap-1 px-2 text-muted-foreground hover:text-steam-dark">
                <X className="h-4 w-4" aria-hidden="true" />
                Slėpti
              </Button>
            )}
          </div>
        </div>
        <Progress value={progress} className="h-1.5 mt-2" aria-label="Pirmųjų žingsnių eiga" />
      </CardHeader>
      <CardContent className="space-y-1">
        {allDone && (
          <p className="pb-1 text-sm text-steam-dark">
            Visi žingsniai atlikti. Šio sąrašo nebereikia, galite jį paslėpti.
          </p>
        )}
        <ol className="space-y-1">
          {steps.map((step, index) => (
            <li key={step.label}>
              <Link
                href={step.href}
                aria-current={step.current ? "step" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${
                  step.current
                    ? "bg-primary/10 text-steam-dark font-semibold ring-1 ring-primary/40 hover:bg-primary/15"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-primary-ink shrink-0" aria-hidden="true" />
                ) : (
                  <Circle
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 ${step.current ? "text-primary-ink" : "text-muted-foreground/40"}`}
                  />
                )}
                <span className={step.done ? "line-through decoration-muted-foreground/40" : ""}>
                  {index + 1}. {step.label}
                </span>
                <span className="sr-only">
                  {step.done ? " (atlikta)" : step.current ? " (dabartinis žingsnis)" : ""}
                </span>
                {step.current && (
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-ink">
                    <span className="hidden sm:inline" aria-hidden="true">Dabar</span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>

        {showSampleGameButton && (
          <div className="pt-3 mt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-xs text-muted-foreground flex-1">
              Norite tik išbandyti? Sukursime pavyzdinę veiklą su 3 užduotimis, jums beliks ją pradėti.
            </p>
            <CreateSampleGameButton size="sm" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
