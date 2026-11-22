"use client"

import { useCallback, useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

/** Failed polls in a row before the page says the connection is lost. */
export const OFFLINE_AFTER_FAILURES = 2

export interface ConnectionState {
  /** Polls failed in a row. */
  failures: number
  /** The browser reported "offline" and nothing has succeeded since. */
  browserOffline: boolean
}

export const CONNECTED: ConnectionState = { failures: 0, browserOffline: false }

export type ConnectionEvent = "poll_ok" | "poll_failed" | "browser_offline" | "browser_online"

/**
 * One successful poll clears everything, also a stale "offline" from the
 * browser. "online" from the browser clears only its own flag: the banner
 * stays until a poll really gets through.
 */
export function nextConnection(state: ConnectionState, event: ConnectionEvent): ConnectionState {
  switch (event) {
    case "poll_ok":
      return state.failures === 0 && !state.browserOffline ? state : CONNECTED
    case "poll_failed":
      return { ...state, failures: state.failures + 1 }
    case "browser_offline":
      return state.browserOffline ? state : { ...state, browserOffline: true }
    case "browser_online":
      return state.browserOffline ? { ...state, browserOffline: false } : state
  }
}

export function isOffline(state: ConnectionState): boolean {
  return state.browserOffline || state.failures >= OFFLINE_AFTER_FAILURES
}

/** Automatic retries of a failed first load: 2, 4, 8 and 16 s apart. */
export const LOAD_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000] as const

/** Delay before automatic retry number `attempt` (from 0), or null when they are used up. */
export function loadRetryDelayMs(attempt: number): number | null {
  return LOAD_RETRY_DELAYS_MS[attempt] ?? null
}

/**
 * Connection state of a polling participant page. The page calls
 * `report(ok)` after each poll; `onBackOnline` runs when the browser says
 * the network is back, so the page can poll at once.
 */
export function useConnection(onBackOnline?: () => void) {
  const [state, setState] = useState<ConnectionState>(CONNECTED)

  const report = useCallback((ok: boolean) => {
    setState((s) => nextConnection(s, ok ? "poll_ok" : "poll_failed"))
  }, [])

  useEffect(() => {
    const onOffline = () => setState((s) => nextConnection(s, "browser_offline"))
    const onOnline = () => {
      setState((s) => nextConnection(s, "browser_online"))
      onBackOnline?.()
    }
    if (navigator.onLine === false) onOffline()
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    return () => {
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }, [onBackOnline])

  return { offline: isOffline(state), report }
}

export const OFFLINE_TEXT = "Nėra ryšio. Bandome prisijungti iš naujo..."

/**
 * "No connection" notice at the bottom of the screen, on every state of the
 * page. The live region is always in the page, so a screen reader announces
 * the text when it appears. It does not block anything: taps pass through.
 */
export function ConnectionBanner({ offline }: { offline: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
    >
      {offline && (
        <p className="flex items-center gap-2 rounded-xl bg-highlight px-4 py-2.5 text-sm font-medium text-highlight-foreground shadow-lg">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          {OFFLINE_TEXT}
        </p>
      )}
    </div>
  )
}
