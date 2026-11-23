"use client"

import { useState, useEffect, useId, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ArrowRight, CloudOff, Flag, Hourglass, Loader2, SearchX } from "lucide-react"
import { SteamRays } from "@/components/brand/steam-rays"
import { PRIMARY_BUTTON, SCREEN, SECONDARY_BUTTON, Shake, StateScreen } from "@/components/player/play-ui"
import type { PlayerSession } from "@/types/game"
import { STORAGE_BLOCKED_MESSAGE, canStorePlayerSession, getPlayerSession, savePlayerSession } from "@/lib/game/session"
import Link from "next/link"
import { PrivacyLink } from "@/components/privacy-link"

type GameState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "error" }
  | { status: "inactive"; gameStatus: string }
  | { status: "ready"; title: string; description: string | null }

export default function JoinGamePage() {
  const params = useParams()
  const router = useRouter()
  const gameCode = (params.gameCode as string).toUpperCase()

  const [teamName, setTeamName] = useState("")
  const [loading, setLoading] = useState(false)
  const [gameState, setGameState] = useState<GameState>({ status: "loading" })
  // The browser cannot keep the team's session: joining would create a team
  // this device loses at once, so the form says why instead.
  const [storageBlocked, setStorageBlocked] = useState(false)
  // Why joining was refused (e.g. the name is taken), shown under the field.
  const [joinError, setJoinError] = useState<string | null>(null)
  // Refusals so far: each one shakes the field and is announced anew.
  const [joinAttempts, setJoinAttempts] = useState(0)
  const nameId = useId()
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Check existing session (with expiry validation)
    const existingSession = getPlayerSession(gameCode)
    if (existingSession) {
      router.replace(`/play/${gameCode}/play`)
      return
    }
    setStorageBlocked(!canStorePlayerSession())
    // Validate game exists and is active
    validateGame()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCode, router])

  async function validateGame() {
    try {
      const res = await fetch(`/api/play/state?game_code=${encodeURIComponent(gameCode)}`, { cache: "no-store" })
      // Only a clear "no such activity" says the code is wrong; a network
      // or server failure asks to try again instead.
      if (res.status === 404 || res.status === 400) {
        setGameState({ status: "not_found" })
        return
      }
      if (!res.ok) {
        setGameState({ status: "error" })
        return
      }
      const data = await res.json()
      const game = data?.game as {
        title: string
        description: string | null
        status: string
        settings?: { joining_closed?: boolean } | null
      } | null

      if (!game) {
        setGameState({ status: "not_found" })
        return
      }

      if (game.status !== "active") {
        setGameState({ status: "inactive", gameStatus: game.status })
        return
      }
      // The facilitator closed joining: say so before a name is typed.
      if (game.settings?.joining_closed === true) {
        setGameState({ status: "inactive", gameStatus: "closed" })
        return
      }

      setGameState({
        status: "ready",
        title: game.title,
        description: game.description,
      })
    } catch {
      setGameState({ status: "error" })
    }
  }

  // While the activity has not started (or is paused), check every 5 s and
  // show the new state as soon as it changes: the join form when it runs,
  // the finished screen when it ends without resuming.
  const waitingFor = gameState.status === "inactive" ? gameState.gameStatus : null
  useEffect(() => {
    if (waitingFor !== "draft" && waitingFor !== "paused" && waitingFor !== "closed") return
    let disposed = false
    const check = async () => {
      try {
        const res = await fetch(`/api/play/status?game_code=${encodeURIComponent(gameCode)}`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { status: string | null }
        // null: the activity was deleted; validateGame shows "not found".
        // Closed joining is checked again each round: it may reopen.
        if (!disposed && (data.status !== waitingFor || waitingFor === "closed")) void validateGame()
      } catch {
        // The next round retries.
      }
    }
    const interval = setInterval(check, 5000)
    return () => {
      disposed = true
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingFor, gameCode])

  // The reason goes under the field; the name stays, selected for a quick fix.
  function refuseJoin(message: string) {
    setJoinError(message)
    setJoinAttempts((n) => n + 1)
    nameRef.current?.focus()
    nameRef.current?.select()
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) return
    // Asked again here: storage may have been allowed since the page opened.
    // Without it the team would be created and lost on the next page.
    if (!canStorePlayerSession()) {
      setStorageBlocked(true)
      return
    }
    setStorageBlocked(false)
    setJoinError(null)

    setLoading(true)
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_code: gameCode,
          team_name: teamName.trim(),
        }),
      })

      if (!res.ok) {
        let errorMsg = "Nepavyko prisijungti. Bandykite dar kartą."
        try {
          const err = await res.json()
          errorMsg = err.error || errorMsg
        } catch {
          // Response was not JSON (e.g. server error)
        }
        refuseJoin(errorMsg)
        return
      }

      const data = await res.json()

      const session: PlayerSession = {
        team_id: data.team_id,
        session_token: data.session_token,
        game_code: gameCode,
        team_name: data.team_name,
      }
      if (!savePlayerSession(gameCode, session)) {
        setStorageBlocked(true)
        return
      }

      router.push(`/play/${gameCode}/play`)
    } catch {
      refuseJoin("Nepavyko prisijungti. Patikrinkite interneto ryšį ir bandykite dar kartą.")
    } finally {
      setLoading(false)
    }
  }

  // Loading
  if (gameState.status === "loading") {
    return (
      <div className={`${SCREEN} flex items-center justify-center`} role="status">
        <Loader2 className="h-8 w-8 text-foreground motion-safe:animate-spin" aria-hidden="true" />
        <span className="sr-only">Kraunama...</span>
      </div>
    )
  }

  const otherCode = (
    <Button asChild variant="outline" className={SECONDARY_BUTTON}>
      <Link href="/prisijungti">
        <ArrowLeft aria-hidden="true" />
        Įvesti kitą kodą
      </Link>
    </Button>
  )
  const code = <span className="font-mono font-bold text-foreground">{gameCode}</span>

  // Network or server failure: the code may well be right
  if (gameState.status === "error") {
    return (
      <StateScreen
        icon={CloudOff}
        tone="wait"
        title="Nepavyko susisiekti"
        actions={
          <Button
            onClick={() => {
              setGameState({ status: "loading" })
              void validateGame()
            }}
            className={PRIMARY_BUTTON}
          >
            Bandyti dar kartą
          </Button>
        }
      >
        <p>Patikrinkite interneto ryšį ir bandykite dar kartą. Kodas {code} gali būti teisingas.</p>
      </StateScreen>
    )
  }

  // Game not found
  if (gameState.status === "not_found") {
    return (
      <StateScreen icon={SearchX} tone="info" title="Veikla nerasta" actions={otherCode}>
        <p>Kodas {code} neatitinka jokios veiklos.</p>
        <p>Patikrinkite kodą ir bandykite dar kartą.</p>
      </StateScreen>
    )
  }

  // Game inactive (draft, paused, finished)
  if (gameState.status === "inactive") {
    const messages: Record<string, string> = {
      draft: "Veikla dar neprasidėjo. Šis langas atsinaujins pats, kai vedėjas ją pradės.",
      paused: "Veikla pristabdyta. Šis langas atsinaujins pats, kai vedėjas ją tęs.",
      finished: "Ši veikla jau baigta.",
      closed:
        "Vedėjas uždarė prisijungimą prie šios veiklos. Jei jūsų komanda dar neprisijungė, kreipkitės į vedėją. Šis langas atsinaujins pats, jei prisijungimas vėl atsidarys.",
    }
    const waiting =
      gameState.gameStatus === "draft" || gameState.gameStatus === "paused" || gameState.gameStatus === "closed"
    return (
      <StateScreen
        icon={gameState.gameStatus === "finished" ? Flag : Hourglass}
        tone={waiting ? "wait" : "info"}
        title={
          gameState.gameStatus === "finished"
            ? "Veikla baigta"
            : gameState.gameStatus === "closed"
              ? "Prisijungimas uždarytas"
              : "Palaukite"
        }
        actions={
          <>
            {waiting && (
              <Button
                onClick={() => {
                  setGameState({ status: "loading" })
                  validateGame()
                }}
                className={PRIMARY_BUTTON}
              >
                Patikrinti dar kartą
              </Button>
            )}
            {otherCode}
          </>
        }
      >
        <p>{messages[gameState.gameStatus] || "Veikla šiuo metu nepasiekiama."}</p>
      </StateScreen>
    )
  }

  // Game ready: the join form under the activity's title. The rays draw
  // once: the one deliberate motion of this screen.
  return (
    <div className={`${SCREEN} flex items-center justify-center px-4 py-6`}>
      <div className="w-full max-w-sm">
        <SteamRays draw className="mx-auto mb-4 h-24 w-auto" />

        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="mb-2 text-center">
            <span className="sr-only">Veiklos kodas </span>
            <span className="inline-block rounded-full border-2 border-foreground/25 px-3 py-0.5 font-mono text-sm font-bold tracking-widest text-foreground">
              {gameCode}
            </span>
          </p>
          <h1 className="break-words text-center text-2xl font-bold leading-tight text-foreground">{gameState.title}</h1>
          {/* Three lines at most: a long description pushed the team name
              field below the fold on a phone. */}
          {gameState.description && (
            <p className="mt-2 line-clamp-3 text-center text-base text-muted-foreground" title={gameState.description}>
              {gameState.description}
            </p>
          )}

          <form onSubmit={handleJoin} className="mt-5 space-y-4" noValidate>
            <div>
              <label htmlFor={nameId} className="mb-1.5 block text-base font-bold text-foreground">
                Komandos vardas
              </label>
              <Shake trigger={joinAttempts}>
                <Input
                  id={nameId}
                  ref={nameRef}
                  placeholder="Pvz., Smalsūs tyrėjai"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value)
                    setJoinError(null)
                  }}
                  className="h-12 border-2 border-foreground/25 bg-white text-base text-foreground md:text-base"
                  maxLength={30}
                  required
                  autoFocus
                  autoComplete="off"
                  enterKeyHint="go"
                  aria-describedby={`${nameId}-help`}
                  aria-invalid={joinError ? true : undefined}
                />
              </Shake>
              <p id={`${nameId}-help`} className="mt-1.5 text-sm text-muted-foreground">
                Sugalvokite komandos vardą be tikrų vardų ir pavardžių. Paskyros nereikia.
              </p>
            </div>

            {joinError && (
              <p
                key={joinAttempts}
                role="alert"
                className="rounded-xl border border-highlight bg-highlight/20 p-3 text-base text-foreground"
              >
                {joinError}
              </p>
            )}

            {storageBlocked && (
              <p role="alert" className="rounded-xl border border-highlight bg-highlight/20 p-3 text-base text-foreground">
                {STORAGE_BLOCKED_MESSAGE}
              </p>
            )}

            <Button type="submit" disabled={loading || !teamName.trim()} aria-busy={loading} className={PRIMARY_BUTTON}>
              {loading ? (
                <>
                  <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
                  Jungiamasi...
                </>
              ) : (
                <>
                  Prisijungti prie veiklos
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          STEAM LT Klaipėda &middot; Klaipėdos universitetas &middot; <PrivacyLink />
        </p>
      </div>
    </div>
  )
}
