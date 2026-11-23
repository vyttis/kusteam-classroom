"use client"

import { MotionConfig } from "framer-motion"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import { SCREEN } from "@/components/player/play-ui"

/**
 * Every participant screen (also /prisijungti, which re-exports this).
 * One flat, calm surface that fills the phone's screen whatever the
 * address bar does. reducedMotion="user": for someone who asked for less
 * motion, framer-motion drops every move and layout animation here; the
 * components also set their own durations to zero.
 */
export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MotionConfig reducedMotion="user">
      <main className={`${SCREEN} bg-muted`}>
        <ErrorBoundary
          fallbackTitle="Veiklos klaida"
          fallbackMessage="Įvyko netikėta klaida. Pabandykite atnaujinti puslapį arba prisijungti iš naujo."
        >
          {children}
        </ErrorBoundary>
      </main>
    </MotionConfig>
  )
}
