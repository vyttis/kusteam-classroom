"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Clock, Timer, Plus, Loader2 } from "lucide-react"

interface TimeControlsProps {
  gameId: string
  currentTimeLimit: number | null
  /** "card" on the activity page, "bar" in the class screen's control bar. */
  variant?: "card" | "bar"
  /** Called with the new limit right after an extension. */
  onExtended?: (minutes: number) => void
}

/**
 * Adds minutes to a running activity. The server adds them in one step, so
 * two devices pressing "Pratęsti" both count. An activity without a time
 * limit has nothing to extend, so the control is not offered there.
 */
export function TimeControls({ gameId, currentTimeLimit, variant = "card", onExtended }: TimeControlsProps) {
  const [additionalMinutes, setAdditionalMinutes] = useState<string>("5")
  const [extending, setExtending] = useState(false)
  // The limit the server returned, kept until the parent's value catches up
  // (realtime or a refresh); a newer parent value always wins.
  const [extended, setExtended] = useState<{ base: number | null; value: number } | null>(null)
  const { toast } = useToast()

  const timeLimit = extended && extended.base === currentTimeLimit ? extended.value : currentTimeLimit

  async function extend(minutes: number) {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return
    setExtending(true)
    try {
      const res = await fetch(`/api/games/${gameId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
      })
      const data = (await res.json().catch(() => ({}))) as { time_limit_minutes?: number; error?: string }
      if (!res.ok || typeof data.time_limit_minutes !== "number") {
        throw new Error(data.error || "Nepavyko pratęsti laiko")
      }
      setExtended({ base: currentTimeLimit, value: data.time_limit_minutes })
      onExtended?.(data.time_limit_minutes)
      toast({
        title: `Pridėta ${minutes} min.`,
        description: `Laiko limitas dabar ${data.time_limit_minutes} min.`,
      })
    } catch (e) {
      toast({
        title: "Laiko pratęsti nepavyko",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setExtending(false)
    }
  }

  if (variant === "bar") {
    if (!timeLimit) return null
    return (
      <div className="flex items-center gap-2" role="group" aria-label="Laiko pratęsimas">
        <span className="whitespace-nowrap text-sm text-white/80">
          Limitas <span className="font-bold tabular-nums text-white">{timeLimit} min.</span>
        </span>
        {[5, 10].map((m) => (
          <Button
            key={m}
            variant="outline"
            disabled={extending}
            onClick={() => extend(m)}
            className="h-11 gap-1 border-white/30 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white focus-visible:ring-highlight focus-visible:ring-offset-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {m} min.
          </Button>
        ))}
        {extending && <Loader2 className="h-4 w-4 animate-spin text-white/60" aria-label="Pratęsiama" />}
      </div>
    )
  }

  const typed = parseInt(additionalMinutes, 10)

  return (
    <Card className="border-border/50 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary-ink" aria-hidden="true" />
          Laiko valdymas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
          <Timer className="h-5 w-5 text-steam-dark/60" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">Laiko limitas</p>
            <p className="text-sm font-semibold text-steam-dark">{timeLimit ? `${timeLimit} min.` : "Nenustatytas"}</p>
          </div>
        </div>

        {timeLimit ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Pratęsti laiką visoms komandoms</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  inputMode="numeric"
                  aria-label="Kiek minučių pridėti"
                  value={additionalMinutes}
                  onChange={(e) => setAdditionalMinutes(e.target.value)}
                  className="pr-12 text-sm"
                  placeholder="5"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min.</span>
              </div>
              <Button
                size="sm"
                onClick={() => extend(typed)}
                disabled={extending || !Number.isInteger(typed) || typed < 1 || typed > 180}
                className={cn("shrink-0 gap-1 bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                {extending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                Pratęsti
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Pauzės laikas pridedamas automatiškai.</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Ši veikla vyksta be laiko limito, todėl pratęsti nereikia.</p>
        )}
      </CardContent>
    </Card>
  )
}
