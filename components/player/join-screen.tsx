"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Gamepad2 } from "lucide-react"
import { QRScanner } from "@/components/player/qr-scanner"
import Image from "next/image"
import { PrivacyLink } from "@/components/privacy-link"

/**
 * Participant entry: type the activity code or scan the QR code.
 * Served at /prisijungti; the older /play address redirects here.
 */
export function JoinScreen() {
  const [code, setCode] = useState("")
  const router = useRouter()

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="rise-in w-full max-w-sm text-center">
        <Image src="/illustrations/adventure-start.svg" alt="" width={192} height={192} className="mx-auto mb-6" priority />

        <h1 className="text-2xl font-bold text-steam-dark mb-2">
          Prisijunkite prie veiklos
        </h1>
        <p className="text-muted-foreground mb-6">
          Įveskite veiklos kodą arba nuskaitykite QR kodą
        </p>

        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-xl">
          <CardContent className="p-5 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Gamepad2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().slice(0, 6))
                  }
                  placeholder="KODAS"
                  className="pl-11 h-14 text-center text-2xl tracking-[0.4em] font-mono font-bold bg-white"
                  maxLength={6}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  enterKeyHint="go"
                  aria-label="Veiklos kodas"
                />
              </div>
              <Button
                type="submit"
                disabled={code.trim().length < 6}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 gap-2"
              >
                Prisijungti
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-muted-foreground">arba</span>
              </div>
            </div>

            <QRScanner onScan={handleQRScan} />
          </CardContent>
        </Card>

        <a href="https://kusteam.app/veiklos" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-steam-dark underline underline-offset-4">Grįžti į veiklų katalogą</a>
        <p className="text-xs text-muted-foreground mt-6">
          STEAM LT Klaipėda &middot; Klaipėdos universitetas &middot; <PrivacyLink />
        </p>
      </div>
    </div>
  )
}
