"use client"

import { XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * One multiple-choice option. Green means correct elsewhere on the page, so
 * a choice is marked in the dark brand colour and a wrong answer in red with
 * a cross (as Quizlet and Brainly do), never in green.
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
      className={`w-full justify-start items-start h-auto min-h-12 py-3 px-4 text-left whitespace-normal break-words border-2 ${
        markedWrong
          ? "border-accent bg-accent/5 text-steam-dark hover:bg-accent/10"
          : chosen
            ? "border-steam-dark bg-steam-dark text-white hover:bg-steam-dark/90 hover:text-white"
            : ""
      }`}
      onClick={() => onChoose(option)}
    >
      <span
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold mr-3 shrink-0 mt-0.5 ${
          markedWrong ? "border-accent text-accent-ink" : ""
        }`}
      >
        {markedWrong ? <XCircle className="h-4 w-4" aria-hidden /> : String.fromCharCode(65 + index)}
      </span>
      <span className="flex-1 leading-relaxed">{option}</span>
      {markedWrong && <span className="sr-only"> (neteisingas atsakymas)</span>}
    </Button>
  )
}
