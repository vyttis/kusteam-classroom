"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Challenge } from "@/types/game"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GripVertical, Edit3, Trash2, Copy, Sparkles, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react"

interface SortableTaskCardProps {
  challenge: Challenge
  index: number
  isSelected: boolean
  onSelect: (challenge: Challenge) => void
  onDelete: (challenge: Challenge) => void
  onDuplicate: (challenge: Challenge) => void
  /** Moves the task one step up (-1) or down (1) without dragging. */
  onMove?: (challenge: Challenge, direction: -1 | 1) => void
  isFirst?: boolean
  isLast?: boolean
  /** The activity is running or paused: no dragging, removing or copying. */
  locked?: boolean
}

export function SortableTaskCard({
  challenge,
  index,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onMove,
  isFirst = false,
  isLast = false,
  locked = false,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `challenge-${challenge.id}`, disabled: locked })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const difficultyLabel =
    challenge.difficulty === "easy"
      ? "Lengva"
      : challenge.difficulty === "medium"
      ? "Vidutinė"
      : challenge.difficulty === "hard"
      ? "Sunki"
      : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-40 z-50" : ""}
    >
      <Card
        className={`border-border/50 bg-white hover:border-primary/30 transition-colors cursor-pointer ${
          isSelected ? "ring-2 ring-primary/40 border-primary/30" : ""
        }`}
        onClick={() => onSelect(challenge)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            {locked ? (
              <span className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0">
                <span className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-bold text-primary-ink w-5 text-center">
                  {index + 1}
                </span>
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Vilkti užduotį ${index + 1} „${challenge.title}“ į kitą vietą`}
                className="flex flex-col items-center gap-0.5 pt-0.5 cursor-grab active:cursor-grabbing touch-none shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold text-primary-ink w-5 text-center">
                  {index + 1}
                </span>
              </button>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-medium text-sm text-steam-dark truncate">
                  {challenge.title}
                </h3>
                {challenge.generated_by_di && (
                  <Sparkles className="h-3 w-3 text-highlight-ink shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {challenge.needs_answer && (
                  <Badge
                    className="text-xs px-1.5 py-0 bg-accent/10 text-accent-ink border-accent/40 hover:bg-accent/15 gap-0.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(challenge)
                    }}
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Trūksta atsakymo
                  </Badge>
                )}
                {!challenge.needs_answer &&
                  challenge.generated_by_di &&
                  (challenge.verification_verdict === "uncertain" ||
                    challenge.verification_verdict === "fail") && (
                    <Badge
                      variant="outline"
                      className="text-xs px-1.5 py-0 border-highlight/50 bg-highlight/10 text-steam-dark"
                      title="DI patikra abejoja šia užduotimi. Atidarykite, peržiūrėkite ir išsaugokite."
                    >
                      Reikia peržiūros
                    </Badge>
                  )}
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  {challenge.points} tšk.
                </Badge>
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {challenge.type === "text"
                    ? "Tekstas"
                    : challenge.type === "number"
                    ? "Skaičius"
                    : "Pasirinkimas"}
                </Badge>
                {difficultyLabel && (
                  <Badge
                    variant="outline"
                    className={`text-xs px-1.5 py-0 ${
                      challenge.difficulty === "easy"
                        ? "text-primary-ink border-primary/30"
                        : challenge.difficulty === "hard"
                        ? "text-accent-ink border-accent/30"
                        : "text-highlight-ink border-highlight/30"
                    }`}
                  >
                    {difficultyLabel}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex max-w-[5.5rem] flex-wrap justify-end gap-0.5 shrink-0">
              {!locked && onMove && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Perkelti „${challenge.title}“ aukštyn`}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-secondary-ink"
                    disabled={isFirst}
                    onClick={(e) => {
                      e.stopPropagation()
                      onMove(challenge, -1)
                    }}
                  >
                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Perkelti „${challenge.title}“ žemyn`}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-secondary-ink"
                    disabled={isLast}
                    onClick={(e) => {
                      e.stopPropagation()
                      onMove(challenge, 1)
                    }}
                  >
                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Redaguoti „${challenge.title}“`}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-secondary-ink"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(challenge)
                }}
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              {!locked && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Kopijuoti „${challenge.title}“`}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-secondary-ink"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDuplicate(challenge)
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Ištrinti „${challenge.title}“`}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-accent-ink"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(challenge)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function TaskCardOverlay({
  challenge,
  index,
}: {
  challenge: Challenge
  index: number
}) {
  return (
    <Card className="border-primary/30 bg-white shadow-lg shadow-primary/10 w-full max-w-md">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-primary-ink" />
          <span className="text-xs font-bold text-primary-ink">{index + 1}</span>
          <h3 className="font-medium text-sm text-steam-dark truncate flex-1">
            {challenge.title}
          </h3>
          <Badge variant="outline" className="text-xs">
            {challenge.points} tšk.
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
