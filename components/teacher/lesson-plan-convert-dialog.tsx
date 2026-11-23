"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { pluralizeLt } from "@/lib/utils"
import { defaultTaskStageIndexes } from "@/lib/lesson-plans/stages"

const STAGE_LABELS: Record<string, string> = {
  intro: "Įvadas",
  challenge: "Užduotis",
  discussion: "Diskusija",
  reflection: "Refleksija",
}

const ANSWER_LABELS: Record<string, string> = {
  text: "tekstas",
  number: "skaičius",
  multiple_choice: "pasirinkimas",
}

interface ConvertStage {
  activity_type: string
  title: string
  type: string
}

interface LessonPlanConvertDialogProps {
  planId: string
  stages: ConvertStage[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const uzduotis = (n: number) => `${n} ${pluralizeLt(n, "užduotis", "užduotys", "užduočių")}`

/**
 * Chooses which plan stages become scored tasks. The task stages are
 * checked; an introduction, a discussion or a reflection is usually led by
 * the facilitator and has no single answer, so it starts unchecked. The
 * parent mounts it for each opening, so every opening starts from that.
 */
export function LessonPlanConvertDialog({ planId, stages, open, onOpenChange }: LessonPlanConvertDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selected, setSelected] = useState<Set<number>>(() => new Set(defaultTaskStageIndexes(stages)))
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(index: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(index)
      else next.delete(index)
      return next
    })
  }

  async function convert() {
    setConverting(true)
    setError(null)
    try {
      const res = await fetch(`/api/lesson-plans/${planId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_indexes: [...selected].sort((a, b) => a - b) }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        game_id?: string
        challenges_created?: number
        needs_answers?: number
        needs_review?: number
      }
      if (!res.ok || !data.game_id) {
        setError(data.error ?? "Nepavyko sukurti veiklos. Bandykite dar kartą.")
        return
      }

      const notes: string[] = []
      if (data.needs_answers) notes.push(`Laukia jūsų atsakymo: ${uzduotis(data.needs_answers)}.`)
      if (data.needs_review) notes.push(`Reikia peržiūros: ${uzduotis(data.needs_review)}.`)
      toast({
        title: `Veikla sukurta: ${uzduotis(data.challenges_created ?? 0)}`,
        description: notes.length > 0 ? notes.join(" ") : "DI klaidų atsakymuose nerado. Vis tiek juos peržiūrėkite.",
      })
      onOpenChange(false)
      // Tasks to fix are fixed in the builder; otherwise the overview.
      router.push(notes.length > 0 ? `/games/${data.game_id}/builder` : `/games/${data.game_id}`)
      router.refresh()
    } catch {
      setError("Nepavyko susisiekti. Patikrinkite interneto ryšį.")
    } finally {
      setConverting(false)
    }
  }

  const count = selected.size

  return (
    <Dialog open={open} onOpenChange={(next) => !converting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sukurti veiklą dalyviams</DialogTitle>
          <DialogDescription>
            Pažymėkite etapus, kurie taps užduotimis su atsakymu ir taškais. Įvadą, diskusiją ir refleksiją
            paprastai vedate patys, todėl jie nepažymėti.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="max-h-[50vh] space-y-1 overflow-y-auto pr-1" disabled={converting}>
          <legend className="sr-only">Plano etapai</legend>
          {stages.map((stage, index) => {
            const id = `convert-stage-${index}`
            return (
              <div key={index} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/40">
                <Checkbox
                  id={id}
                  checked={selected.has(index)}
                  onCheckedChange={(checked) => toggle(index, checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm leading-snug">
                  <span className="font-medium text-steam-dark">{stage.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {STAGE_LABELS[stage.activity_type] ?? "Etapas"}, atsakymas: {ANSWER_LABELS[stage.type] ?? "tekstas"}
                  </span>
                </label>
              </div>
            )
          })}
        </fieldset>

        <p className="text-xs text-muted-foreground">
          DI dar kartą patikrins užduotis. Abejotinos bus pažymėtos „Reikia peržiūros“, o jei atsakymo negalima
          naudoti (pvz., jo nėra tarp variantų), jį įrašysite patys. Veikla bus be laiko limito: jį galite nustatyti
          veiklos nustatymuose.
        </p>

        {error && (
          <p role="alert" className="text-sm text-accent-ink">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={converting}>
            Atšaukti
          </Button>
          <Button onClick={() => void convert()} disabled={count === 0 || converting} className="gap-2">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Tikrinami atsakymai...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                {count === 0 ? "Pažymėkite bent vieną" : `Sukurti: ${uzduotis(count)}`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
