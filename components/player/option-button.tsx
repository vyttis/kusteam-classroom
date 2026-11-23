"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * One multiple-choice option. Green means correct elsewhere on the page, so
 * a choice is marked in the dark brand colour, never in green. A wrong
 * choice keeps its place with a cross and a dashed outline: marked, not
 * shouted at.
 */
export function OptionButton({
  option,
  index,
  chosen,
  wrong,
  disabled,
  onChoose,
}: {
  option: string
  index: number
  chosen: boolean
  /** The last answer was wrong: the chosen option is the one that was wrong. */
  wrong: boolean
  disabled?: boolean
  onChoose: (option: string) => void
}) {
  const markedWrong = chosen && wrong
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={chosen}
      disabled={disabled}
      className={`h-auto min-h-12 w-full items-start justify-start whitespace-normal break-words rounded-xl border-2 px-4 py-3 text-left text-base font-normal shadow-none ${
        markedWrong
          ? "border-dashed border-foreground/50 bg-muted text-foreground hover:bg-muted"
          : chosen
            ? "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
            : "border-foreground/25 bg-white text-foreground"
      }`}
      onClick={() => onChoose(option)}
    >
      <span className="mr-3 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs font-bold">
        {markedWrong ? <X className="h-4 w-4" aria-hidden /> : String.fromCharCode(65 + index)}
      </span>
      <span className="flex-1 leading-relaxed">{option}</span>
      {markedWrong && <span className="sr-only"> (neteisingas atsakymas)</span>}
    </Button>
  )
}
