"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Link2Off, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SCREEN, SECONDARY_BUTTON, StateScreen } from "@/components/player/play-ui"
import { STORAGE_BLOCKED_MESSAGE, canStorePlayerSession, clearPlayerSession, savePlayerSession } from "@/lib/game/session"

type State = { kind: "working" } | { kind: "error"; message: string }
type RejoinAnswer = { error?: string; team_id?: string; team_name?: string; session_token?: string }

/**
 * Opened from the facilitator's "Grąžinti į komandą" QR or link. The token
 * after "#" never reaches the server logs; this page sends it once, stores
 * the team's new session on this device and opens the activity. The link
 * works once, and the device that had the team before is signed out.
 */
export default function RejoinPage() {
  const params = useParams()
  const router = useRouter()
  const gameCode = (params.gameCode as string).toUpperCase()
  const [state, setState] = useState<State>({ kind: "working" })
  // Read once: the hash is cleared right after, and an effect can run twice.
  const tokenRef = useRef<string | null>(null)
  const exchangeRef = useRef<Promise<{ ok: boolean; data: RejoinAnswer }> | null>(null)

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
    // The link works once: an effect that runs twice must not send it twice
    // (the second request would be told it was already used).
    exchangeRef.current ??= fetch("/api/play/rejoin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_code: gameCode, token }),
    }).then(async (res) => ({ ok: res.ok, data: (await res.json().catch(() => ({}))) as RejoinAnswer }))
    const exchange = exchangeRef.current
    ;(async () => {
      try {
        const { ok, data } = await exchange
        if (cancelled) return
        if (!ok || !data.team_id || !data.session_token) {
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
      <div className={`${SCREEN} flex flex-col items-center justify-center gap-3 p-4`}>
        <Loader2 className="h-8 w-8 text-foreground motion-safe:animate-spin" aria-hidden="true" />
        <p role="status" className="text-base text-muted-foreground">
          Grąžiname jus į komandą...
        </p>
      </div>
    )
  }

  return (
    <StateScreen
      icon={Link2Off}
      tone="wait"
      title="Grįžti nepavyko"
      actions={
        <Button asChild variant="outline" className={SECONDARY_BUTTON}>
          <Link href="/prisijungti">
            <ArrowLeft aria-hidden="true" />
            Įvesti veiklos kodą
          </Link>
        </Button>
      }
    >
      <p role="alert">{state.message}</p>
    </StateScreen>
  )
}
