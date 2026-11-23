"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"

/**
 * "Išeiti" with a second step: leaving drops the team's session on this
 * device, and coming back needs the facilitator's "Grąžinti į komandą" QR,
 * so a stray tap must not do it.
 */
export function LeaveTeamButton({ onLeave }: { onLeave: () => void }) {
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Išeiti
      </button>
    )
  }

  // "Likti" is the filled button and has the focus: leaving is never the
  // default.
  return (
    <div
      role="group"
      aria-label="Išeiti iš komandos?"
      className="mx-auto mt-2 max-w-sm rounded-2xl border border-border bg-white p-4 text-center"
    >
      <p className="text-base text-foreground">Išeiti iš komandos? Grąžinti galės tik vedėjas.</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          autoFocus
          onClick={() => setAsking(false)}
          className="inline-flex min-h-11 items-center rounded-full bg-foreground px-6 text-base font-bold text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Likti
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="inline-flex min-h-11 items-center rounded-full px-4 text-base text-foreground underline underline-offset-4 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Taip, išeiti
        </button>
      </div>
    </div>
  )
}
