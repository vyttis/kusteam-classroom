"use client"

import { useId, type Ref } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface AnswerInputProps {
  type: string
  value: string
  onChange: (value: string) => void
  /**
   * The answer is being checked. The field turns read-only, not disabled:
   * a disabled field loses focus and the phone keyboard jumps away.
   */
  busy?: boolean
  /** The last answer was wrong and the field still holds it. */
  invalid?: boolean
  inputRef?: Ref<HTMLInputElement>
}

/**
 * The typed answer field for text and number tasks, with its visible
 * label. Phones must not change the answer on their own (autocorrect,
 * capitals, spell check), and the keyboard should not open over the task
 * text before the team has read it. 16 px text, so iOS does not zoom in.
 * Number tasks get the decimal keypad plus a sign button, because the
 * iPhone decimal keypad has no minus key.
 */
export function AnswerInput({ type, value, onChange, busy, invalid, inputRef }: AnswerInputProps) {
  const isNumber = type === "number"
  const id = useId()

  function toggleSign() {
    const trimmed = value.trimStart()
    if (/^[-−–]/.test(trimmed)) onChange(trimmed.slice(1))
    else onChange(`-${trimmed.replace(/^\+/, "")}`)
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-foreground">
        {isNumber ? "Atsakymas (skaičius)" : "Atsakymas"}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          ref={inputRef}
          type="text"
          inputMode={isNumber ? "decimal" : "text"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          placeholder={isNumber ? "Pvz. 2,5" : "Jūsų atsakymas..."}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={busy}
          aria-invalid={invalid || undefined}
          className="h-12 flex-1 border-2 border-foreground/25 bg-white text-base text-foreground md:text-base"
        />
        {isNumber && (
          <Button
            type="button"
            variant="outline"
            onClick={toggleSign}
            disabled={busy}
            aria-label="Pakeisti skaičiaus ženklą (minusas)"
            className="h-12 w-12 shrink-0 border-2 border-foreground/25 text-lg font-bold"
          >
            ±
          </Button>
        )}
      </div>
    </div>
  )
}
