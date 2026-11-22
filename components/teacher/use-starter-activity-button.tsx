"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus } from "lucide-react"

const GENERIC_ERROR = "Nepavyko sukurti veiklos. Bandykite dar kartą."

/**
 * The one primary action of the catalogue: makes the facilitator's own draft
 * of a ready-made activity and opens it. Only the slug is sent; the server
 * holds the content.
 */
export function UseStarterActivityButton({ slug }: { slug: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // State updates are async: the ref stops a second click in the same tick.
  const busy = useRef(false)

  async function handleUse() {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/games/starter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      const data = (await res.json().catch(() => null)) as { game_id?: string; error?: string } | null
      if (!res.ok || !data?.game_id) {
        throw new Error(data?.error || GENERIC_ERROR)
      }
      toast({
        title: "Veikla sukurta",
        description: "Tai jūsų kopija: peržiūrėkite užduotis, pakeiskite, ką norite, ir pradėkite.",
        action: (
          <ToastAction altText="Atidaryti metodines pastabas" asChild>
            <Link href={`/paruostos-veiklos/${slug}`}>Metodinės pastabos</Link>
          </ToastAction>
        ),
      })
      // Stays disabled until the new page replaces this one.
      router.push(`/games/${data.game_id}`)
    } catch (err: unknown) {
      const message =
        err instanceof TypeError
          ? "Nepavyko prisijungti prie serverio. Patikrinkite interneto ryšį ir bandykite dar kartą."
          : err instanceof Error
            ? err.message
            : GENERIC_ERROR
      setError(message)
      setLoading(false)
      busy.current = false
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        onClick={handleUse}
        disabled={loading}
        aria-busy={loading}
        className="gap-2 w-full sm:w-auto sm:self-start"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4" aria-hidden="true" />
        )}
        {loading ? "Kuriama veikla" : "Naudoti šią veiklą"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Gausite savo kopiją juodraštyje. Dalyviai jos nematys, kol nepradėsite veiklos.
      </p>
      <p role="alert" className="text-sm font-medium text-destructive empty:hidden">
        {error}
      </p>
    </div>
  )
}
