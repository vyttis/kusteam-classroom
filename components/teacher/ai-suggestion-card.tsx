"use client"

import { useState } from "react"
import { AiSuggestion, VerificationVerdict } from "@/lib/ai/types"
import { proposedAcceptedAnswers } from "@/components/teacher/game-builder/suggestion-payload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { motion } from "framer-motion"
import {
  X,
  Lightbulb,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Edit3,
} from "lucide-react"

const typeLabels: Record<string, string> = {
  text: "Tekstas",
  number: "Skaičius",
  multiple_choice: "Pasirinkimas",
}

function VerdictBadge({ verdict }: { verdict?: VerificationVerdict }) {
  if (!verdict) return null
  const config = {
    pass: {
      label: "DI klaidų nerado",
      // Not a guarantee: the facilitator confirms the answer.
      title: "Tai ne garantija. Atsakymą patvirtinate jūs.",
      className: "bg-primary/10 text-primary-ink border-primary/20",
      Icon: ShieldCheck,
    },
    uncertain: {
      label: "Reikia peržiūros",
      title: undefined,
      className: "bg-highlight/10 text-highlight-ink border-highlight/20",
      Icon: AlertTriangle,
    },
    fail: {
      label: "Klaida",
      title: undefined,
      className: "bg-accent/10 text-accent-ink border-accent/20",
      Icon: XCircle,
    },
  }
  const c = config[verdict]
  return (
    <Badge variant="outline" title={c.title} className={`text-xs gap-1 ${c.className}`}>
      <c.Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  )
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
  const [showDetails, setShowDetails] = useState(false)

  const isFailed = suggestion.verification?.verdict === "fail"
  const isUncertain = suggestion.verification?.verdict === "uncertain"
  const isDisabled = added || isFailed
  const alsoAccepted = proposedAcceptedAnswers(suggestion)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card
        className={`border-l-4 border-border/50 bg-white ${
          isFailed
            ? "border-l-accent/50 opacity-60"
            : isUncertain
            ? "border-l-highlight"
            : added
            ? "border-l-primary/30 opacity-70"
            : "border-l-highlight"
        }`}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header with checkbox */}
          <div className="flex items-start gap-3">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(index)}
              disabled={isDisabled}
              className="mt-1 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-steam-dark text-sm leading-tight">
                  {suggestion.title}
                </h4>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <Badge variant="outline" className="text-xs">
                    {suggestion.points} taškų
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {typeLabels[suggestion.type] || suggestion.type}
                  </Badge>
                </div>
              </div>

              {/* Verification badge */}
              {suggestion.verification && (
                <div className="mt-1.5">
                  <VerdictBadge verdict={suggestion.verification.verdict} />
                </div>
              )}

              {/* Added badge */}
              {added && (
                <div className="mt-1.5">
                  <Badge
                    variant="outline"
                    className="text-xs bg-primary/10 text-primary-ink border-primary/20 gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Pridėta
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {suggestion.description && (
            <p className="text-xs text-muted-foreground leading-relaxed pl-7">
              {suggestion.description}
            </p>
          )}

          {/* Answer */}
          <div className="flex items-center gap-1.5 p-2 rounded-md bg-primary/5 border border-primary/10 ml-7">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary-ink shrink-0" />
            <span className="text-xs font-medium text-steam-dark">
              Atsakymas: {suggestion.correct_answer}
            </span>
          </div>

          {/* Other spellings the DI proposes; added with the task */}
          {alsoAccepted.length > 0 && (
            <p className="text-xs text-muted-foreground pl-7">
              Taip pat tinka: {alsoAccepted.join(", ")}
            </p>
          )}

          {/* Options (for multiple choice) */}
          {suggestion.type === "multiple_choice" && suggestion.options && (
            <div className="space-y-1 pl-7">
              <p className="text-xs text-muted-foreground font-medium">
                Variantai:
              </p>
              <div className="flex flex-wrap gap-1">
                {suggestion.options.map((opt, i) => (
                  <Badge
                    key={i}
                    variant={
                      opt === suggestion.correct_answer ? "default" : "outline"
                    }
                    className="text-xs"
                  >
                    {opt}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Hints */}
          {suggestion.hints.length > 0 && (
            <div className="flex items-start gap-1.5 pl-7">
              <Lightbulb className="h-3.5 w-3.5 text-highlight-ink shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                {suggestion.hints.map((hint, i) => (
                  <span key={i}>
                    {hint}
                    {i < suggestion.hints.length - 1 && " • "}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Verification details (collapsible) */}
          {suggestion.verification?.issues &&
            suggestion.verification.issues.length > 0 && (
              <div className="pl-7">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-muted-foreground hover:text-steam-dark flex items-center gap-1"
                >
                  {showDetails ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  Rodyti patikros detales
                </button>
                {showDetails && (
                  <div className="mt-2 p-2 rounded bg-muted/30 text-xs space-y-1">
                    {suggestion.verification.issues.map((issue, i) => (
                      <p key={i} className="text-muted-foreground">
                        • {issue}
                      </p>
                    ))}
                    {suggestion.verification.confidence !== undefined && (
                      <p className="text-muted-foreground mt-1">
                        Patikros tikimybė:{" "}
                        {Math.round(suggestion.verification.confidence * 100)}%
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* Actions */}
          <div className="flex gap-2 pt-1 pl-7">
            {!added && !isFailed && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAdd(index)}
                disabled={adding}
                className="text-primary-ink hover:text-primary-ink/80 gap-1.5 text-xs h-8"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Pridėti
              </Button>
            )}
            {onEdit && !added && !isFailed && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(index)}
                className="text-secondary-ink hover:text-secondary-ink/80 gap-1.5 text-xs h-8"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Redaguoti
              </Button>
            )}
            {!added && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReject(index)}
                className="text-muted-foreground hover:text-accent-ink gap-1.5 text-xs h-8"
              >
                <X className="h-3.5 w-3.5" />
                Atmesti
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
