"use client"

import { useState } from "react"
import { GameForm } from "@/components/teacher/game-form"
import { AiGameAssistant } from "@/components/teacher/ai-game-assistant"
import { AiGameIdea } from "@/lib/ai/types"
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export default function NewGamePage() {
  const [prefillData, setPrefillData] = useState<AiGameIdea | undefined>(
    undefined
  )

  function handleAcceptIdea(idea: AiGameIdea) {
    setPrefillData(idea)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <Link href="/dashboard" className="inline-block mb-6">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Grįžti į veiklas
        </Button>
      </Link>

      {/* Header with illustration */}
      <div className="flex items-center gap-6 mb-8">
        <div className="hidden sm:block w-24 h-24 shrink-0">
          <Image src="/illustrations/create-game.svg" alt="" width={96} height={96} className="w-full h-full" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-steam-dark">
            Nauja veikla
          </h1>
          <p className="text-muted-foreground mt-1">
            Sukurkite interaktyvią veiklą dalyviams. Vėliau galėsite pridėti užduotis.
          </p>
        </div>
      </div>

      {/* Ready-made activities: the fastest way to a first lesson */}
      <Link
        href="/paruostos-veiklos"
        className="group mb-6 flex items-center gap-3 rounded-xl border border-secondary/30 bg-card p-4 shadow-sm transition-colors hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Sparkles className="h-5 w-5 shrink-0 text-secondary-ink" aria-hidden="true" />
        <span className="flex-1">
          <span className="block font-semibold text-steam-dark">Paruoštos veiklos</span>
          <span className="block text-sm text-muted-foreground">
            Pasirinkite pagal dalyką ir klasę, gaukite savo kopiją ir keiskite ją kaip norite.
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-secondary-ink transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>

      {/* AI Assistant */}
      <div className="mb-6">
        <AiGameAssistant onAcceptIdea={handleAcceptIdea} />
      </div>

      <GameForm prefillData={prefillData} />
    </div>
  )
}
