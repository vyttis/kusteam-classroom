"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { STORAGE_BLOCKED_MESSAGE, canStorePlayerSession, clearPlayerSession, savePlayerSession } from "@/lib/game/session"

type State = { kind: "working" } | { kind: "error"; message: string }

/**
 * Opened from the facilitator's "Grąžinti į komandą" QR or link. The token
 * after "#" never reaches the server logs; this page sends it once, stores
 * the team's session on this device and opens the activity.
 */
export default function RejoinPage() {
  const params = useParams()
  const router = useRouter()
  const gameCode = (params.gameCode as string).toUpperCase()
  const [state, setState] = useState<State>({ kind: "working" })
  // Read once: the hash is cleared right after, and an effect can run twice.
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (tokenRef.current === null) {
      tokenRef.current = window.location.hash.slice(1)
      // The token should not stay in history or be shared on from here.
      window.history.replaceState(null, "", window.location.pathname)
    }
    const token = tokenRef.current
    if (!token) {
      setState({ kind: "error", message: "Nuorodoje nėra komandos kodo. Paprašykite vedėjo naujos nuorodos." })
      return
    }
    // Asked before the link is used: a browser that cannot keep the session
    // would spend the facilitator's link for nothing.
    if (!canStorePlayerSession()) {
      setState({ kind: "error", message: STORAGE_BLOCKED_MESSAGE })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/play/rejoin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game_code: gameCode, token }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          team_id?: string
          team_name?: string
          session_token?: string
        }
        if (cancelled) return
        if (!res.ok || !data.team_id || !data.session_token) {
          setState({ kind: "error", message: data.error || "Nepavyko grįžti į komandą. Bandykite dar kartą." })
          return
        }
        // Whatever this device held for the activity belongs to another team.
        clearPlayerSession(gameCode)
        const saved = savePlayerSession(gameCode, {
          team_id: data.team_id,
          session_token: data.session_token,
          game_code: gameCode,
          team_name: data.team_name ?? "",
        })
        if (!saved) {
          setState({ kind: "error", message: STORAGE_BLOCKED_MESSAGE })
          return
        }
        router.replace(`/play/${gameCode}/play`)
      } catch {
        if (!cancelled) setState({ kind: "error", message: "Nepavyko susisiekti. Patikrinkite interneto ryšį." })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameCode, router])

  if (state.kind === "working") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary-ink" aria-hidden="true" />
        <p role="status">Grąžiname jus į komandą...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent/10 flex items-center justify-center">
          <AlertCircle className="h-10 w-10 text-accent-ink" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-steam-dark mb-2">Grįžti nepavyko</h1>
        <p className="text-muted-foreground mb-6" role="alert">
          {state.message}
        </p>
        <Link href="/prisijungti">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Įvesti veiklos kodą
          </Button>
        </Link>
      </div>
    </div>
  )
}
