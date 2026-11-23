"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight } from "lucide-react"
import { SteamRays } from "@/components/brand/steam-rays"
import { QRScanner } from "@/components/player/qr-scanner"
import { PRIMARY_BUTTON, SCREEN } from "@/components/player/play-ui"
import { PrivacyLink } from "@/components/privacy-link"

/**
 * Participant entry: type the activity code or scan the QR code.
 * Served at /prisijungti; the older /play address redirects here. The
 * first screen of the participant's way, so the STEAM rays are large here
 * and draw themselves once.
 */
export function JoinScreen() {
  const [code, setCode] = useState("")
  const router = useRouter()
  const codeId = useId()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().length >= 6) {
      router.push(`/play/${code.trim().toUpperCase()}`)
    }
  }

  function handleQRScan(gameCode: string) {
    router.push(`/play/${gameCode}`)
  }

  return (
    <div className={`${SCREEN} flex items-center justify-center px-4 py-6`}>
      <div className="w-full max-w-sm text-center">
        <SteamRays draw className="mx-auto mb-4 h-32 w-auto [@media(max-height:560px)]:h-16" />

        <h1 className="mb-1 text-3xl font-bold leading-tight text-foreground">Prisijunkite prie veiklos</h1>
        <p className="mb-5 text-base text-muted-foreground">Įveskite veiklos kodą arba nuskaitykite QR kodą</p>

        <div className="space-y-4 rounded-2xl border border-border bg-white p-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor={codeId} className="block text-left text-base font-bold text-foreground">
              Veiklos kodas
            </label>
            <Input
              id={codeId}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="KODAS"
              className="h-14 border-2 border-foreground/25 bg-white text-center font-mono text-2xl font-bold tracking-[0.4em] text-foreground md:text-2xl"
              maxLength={6}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="go"
              aria-describedby={`${codeId}-help`}
            />
            <p id={`${codeId}-help`} className="text-left text-sm text-muted-foreground">
              Kodą iš 6 ženklų rasite vedėjo ekrane.
            </p>
            <Button type="submit" disabled={code.trim().length < 6} className={PRIMARY_BUTTON}>
              Prisijungti
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>

          <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            arba
            <span className="h-px flex-1 bg-border" />
          </div>

          <QRScanner onScan={handleQRScan} />
        </div>

        <a
          href="https://kusteam.app/veiklos"
          className="mt-4 inline-flex min-h-11 items-center text-base text-foreground underline underline-offset-4"
        >
          Grįžti į veiklų katalogą
        </a>
        <p className="mt-2 text-sm text-muted-foreground">
          STEAM LT Klaipėda &middot; Klaipėdos universitetas &middot; <PrivacyLink />
        </p>
      </div>
    </div>
  )
}
