"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Users, ArrowRight, Loader2, Gamepad2, AlertCircle, ArrowLeft } from "lucide-react"
import type { PlayerSession } from "@/types/game"
import { getPlayerSession, savePlayerSession } from "@/lib/game/session"
import Link from "next/link"
import Image from "next/image"
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
  const { toast } = useToast()
  const gameCode = (params.gameCode as string).toUpperCase()

  const [teamName, setTeamName] = useState("")
  const [loading, setLoading] = useState(false)
  const [gameState, setGameState] = useState<GameState>({ status: "loading" })

  useEffect(() => {
    // Check existing session (with expiry validation)
    const existingSession = getPlayerSession(gameCode)
    if (existingSession) {
      router.replace(`/play/${gameCode}/play`)
      return
    }
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

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) return

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
        let errorMsg = "Nepavyko prisijungti"
        try {
          const err = await res.json()
          errorMsg = err.error || errorMsg
        } catch {
          // Response was not JSON (e.g. server error)
        }
        throw new Error(errorMsg)
      }

      const data = await res.json()

      const session: PlayerSession = {
        team_id: data.team_id,
        session_token: data.session_token,
        game_code: gameCode,
        team_name: data.team_name,
      }
      savePlayerSession(gameCode, session)

      router.push(`/play/${gameCode}/play`)
    } catch (error: unknown) {
      toast({
        title: "Klaida",
        description: error instanceof Error ? error.message : "Nepavyko prisijungti prie veiklos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Loading
  if (gameState.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-ink" />
      </div>
    )
  }

  // Network or server failure: the code may well be right
  if (gameState.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-highlight/10 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-highlight-ink" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-steam-dark mb-2">Nepavyko susisiekti</h1>
          <p className="text-muted-foreground mb-6">
            Patikrinkite interneto ryšį ir bandykite dar kartą. Kodas <span className="font-mono font-bold">{gameCode}</span> gali būti teisingas.
          </p>
          <Button
            onClick={() => {
              setGameState({ status: "loading" })
              void validateGame()
            }}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Bandyti dar kartą
          </Button>
        </div>
      </div>
    )
  }

  // Game not found
  if (gameState.status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="rise-in w-full max-w-sm text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent/10 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-accent-ink" />
          </div>
          <h1 className="text-xl font-bold text-steam-dark mb-2">
            Veikla nerasta
          </h1>
          <p className="text-muted-foreground mb-2">
            Kodas <span className="font-mono font-bold">{gameCode}</span> neatitinka jokios veiklos.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Patikrinkite kodą ir bandykite dar kartą.
          </p>
          <Link href="/prisijungti">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Įvesti kitą kodą
            </Button>
          </Link>
        </div>
      </div>
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
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="rise-in w-full max-w-sm text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-highlight/10 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-highlight-ink" />
          </div>
          <h1 className="text-xl font-bold text-steam-dark mb-2">
            {gameState.gameStatus === "finished"
              ? "Veikla baigta"
              : gameState.gameStatus === "closed"
                ? "Prisijungimas uždarytas"
                : "Palaukite"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {messages[gameState.gameStatus] || "Veikla šiuo metu nepasiekiama."}
          </p>
          <div className="flex flex-col gap-2 items-center">
            {(gameState.gameStatus === "draft" || gameState.gameStatus === "paused" || gameState.gameStatus === "closed") && (
              <Button
                onClick={() => {
                  setGameState({ status: "loading" })
                  validateGame()
                }}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Patikrinti dar kartą
              </Button>
            )}
            <Link href="/prisijungti">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Įvesti kitą kodą
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Game ready — show join form with game title
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="rise-in w-full max-w-sm relative z-10">
        <div className="flex justify-center mb-6">
          <Image
            src="/illustrations/adventure-start.svg"
            alt=""
            width={192}
            height={192}
            className="h-28 w-28 sm:h-48 sm:w-48"
          />
        </div>

        <Card className="border-0 shadow-2xl shadow-primary/10 bg-white/90 backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gamepad2 className="h-5 w-5 text-primary-ink" />
              <span className="font-mono text-sm font-bold text-primary-ink tracking-widest">
                {gameCode}
              </span>
            </div>
            <CardTitle className="text-xl font-bold text-steam-dark">
              {gameState.title}
            </CardTitle>
            {/* Three lines at most: a long description pushed the team name
                field below the fold on a phone. */}
            {gameState.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-3" title={gameState.description}>
                {gameState.description}
              </p>
            )}
          </CardHeader>

          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Komandos vardas"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="pl-10 h-12 text-base bg-white"
                    maxLength={30}
                    required
                    autoFocus
                    autoComplete="off"
                    enterKeyHint="go"
                    aria-label="Komandos vardas"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Sugalvokite komandos vardą be tikrų vardų ir pavardžių. Paskyros nereikia.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || !teamName.trim()}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Prisijungti prie veiklos
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          STEAM LT Klaipėda &middot; Klaipėdos universitetas &middot; <PrivacyLink />
        </p>
      </div>
    </div>
  )
}
