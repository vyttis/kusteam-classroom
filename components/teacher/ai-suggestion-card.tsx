"use client"

import { useState } from "react"
import { AiSuggestion, VerificationVerdict } from "@/lib/ai/types"
import { proposedAcceptedAnswers } from "@/components/teacher/game-builder/suggestion-payload"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  HelpCircle,
  Pencil,
  Plus,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react"

const typeLabels: Record<string, string> = {
  text: "Tekstas",
  number: "Skaičius",
  multiple_choice: "Pasirinkimas",
}

const difficultyLabels: Record<string, string> = {
  easy: "Lengva",
  medium: "Vidutinė",
  hard: "Sunki",
}

// What the DI check said, in words. The colour is only the edge of the box.
const VERDICTS: Record<
  VerificationVerdict | "none",
  { label: string; note: string; edge: string; Icon: typeof ShieldCheck }
> = {
  pass: {
    label: "DI klaidų nerado",
    // Not a guarantee: the facilitator confirms the answer.
    note: "Tai ne garantija. Atsakymą patvirtinate jūs.",
    edge: "border-l-primary",
    Icon: ShieldCheck,
  },
  uncertain: {
    label: "Reikia peržiūros",
    note: "DI patikra abejoja šiuo pasiūlymu. Prieš pridėdami patikrinkite atsakymą.",
    edge: "border-l-highlight",
    Icon: AlertTriangle,
  },
  fail: {
    label: "Klaida",
    note: "DI patikra rado klaidą, todėl šio pasiūlymo pridėti negalima.",
    edge: "border-l-accent",
    Icon: XCircle,
  },
  none: {
    label: "DI atsakymo nepatikrino",
    note: "Prieš pridėdami patikrinkite atsakymą patys.",
    edge: "border-l-border",
    Icon: HelpCircle,
  },
}

interface AiSuggestionCardProps {
  suggestion: AiSuggestion
  index: number
  selected: boolean
  added: boolean
  adding: boolean
  onToggleSelect: (index: number) => void
  onAdd: (index: number) => void
  onEdit?: (index: number) => void
  onReject: (index: number) => void
}

export function AiSuggestionCard({
  suggestion,
  index,
  selected,
  added,
  adding,
  onToggleSelect,
  onAdd,
  onEdit,
  onReject,
}: AiSuggestionCardProps) {
  const verdict = suggestion.verification?.verdict
  const isFailed = verdict === "fail"
  const isUncertain = verdict === "uncertain"
  const isDisabled = added || isFailed
  const alsoAccepted = proposedAcceptedAnswers(suggestion)
  const issues = suggestion.verification?.issues ?? []
  // What the check doubted is shown at once; a clean pass keeps it folded.
  const [showDetails, setShowDetails] = useState(isFailed || isUncertain)
  const v = VERDICTS[verdict ?? "none"]

  const meta = [
    `${suggestion.points} tšk.`,
    typeLabels[suggestion.type] || suggestion.type,
    suggestion.difficulty ? difficultyLabels[suggestion.difficulty] : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      className={cn(
        "motion-rise-in space-y-3 rounded-xl border bg-white p-4",
        added ? "border-primary" : selected ? "border-foreground/40" : "border-border",
        isFailed && "bg-muted/40"
      )}
      style={{ animationDelay: `${Math.min(index, 5) * 60}ms` }}
    >
      {/* Title and facts */}
      <div className="flex items-start gap-1">
        <label className="-ml-3 -mt-3 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(index)}
            disabled={isDisabled}
            aria-label={`Pažymėti pasiūlymą „${suggestion.title}“`}
          />
        </label>
        <div className="min-w-0 flex-1 pr-8">
          <h4 className="break-words text-base font-bold leading-snug text-steam-dark">{suggestion.title}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
        </div>
      </div>

      {/* Question */}
      {suggestion.description && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{suggestion.description}</p>
      )}

      {/* Options (multiple choice): the correct one is marked and named */}
      {suggestion.type === "multiple_choice" && suggestion.options && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Variantai</p>
          <ul className="mt-1 space-y-1 text-sm">
            {suggestion.options.map((opt, i) => {
              const correct = opt === suggestion.correct_answer
              return (
                <li key={i} className={cn("flex items-start gap-2", correct && "font-bold text-foreground")}>
                  {correct ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="min-w-0 break-words">
                    {opt}
                    {correct && <span className="sr-only"> (teisingas)</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Answer, and the other spellings the DI proposes (added with the task) */}
      <div className="rounded-lg border border-border px-3 py-2 text-sm">
        <p className="flex items-start gap-2 font-bold text-foreground">
          {/* No tick on an answer the check rejected. */}
          {!isFailed && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />}
          <span className="min-w-0 break-words">Atsakymas: {suggestion.correct_answer}</span>
        </p>
        {alsoAccepted.length > 0 && (
          <p className={cn("mt-1 break-words text-muted-foreground", !isFailed && "pl-6")}>
            Taip pat tinka: {alsoAccepted.join(", ")}
          </p>
        )}
      </div>

      {/* Hints */}
      {suggestion.hints.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Užuominos</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-foreground">
            {suggestion.hints.map((hint, i) => (
              <li key={i}>{hint}</li>
            ))}
          </ol>
        </div>
      )}

      {/* What the DI check found */}
      <div className={cn("rounded-lg border border-l-4 border-border bg-muted/40 px-3 py-2 text-sm", v.edge)}>
        <p className="flex items-start gap-2 text-foreground">
          <v.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-bold">{v.label}.</span> {v.note}
          </span>
        </p>
        {issues.length > 0 && (
          <div className="pl-6">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              aria-expanded={showDetails}
              className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {showDetails ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
              {showDetails ? "Slėpti patikros detales" : "Rodyti patikros detales"}
            </button>
            {showDetails && (
              <div className="pb-1 text-sm text-foreground">
                <ul className="list-disc space-y-0.5 pl-5">
                  {issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
                {suggestion.verification?.confidence !== undefined && (
                  <p className="mt-1 text-muted-foreground">
                    Patikros tikimybė: {Math.round(suggestion.verification.confidence * 100)}%
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {added ? (
        <p className="motion-pop-in flex items-center gap-1.5 text-sm font-bold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary-ink" aria-hidden="true" />
          Pridėta
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {!isFailed && (
            <Button
              variant="outline"
              onClick={() => onAdd(index)}
              disabled={adding}
              className="gap-1.5 border-2 border-primary bg-white font-bold text-foreground hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Pridėti
            </Button>
          )}
          {onEdit && !isFailed && (
            <Button variant="outline" onClick={() => onEdit(index)} className="gap-1.5">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Redaguoti
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onReject(index)}
            className="ml-auto gap-1.5 px-3 text-muted-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Atmesti
          </Button>
        </div>
      )}
    </div>
  )
}
