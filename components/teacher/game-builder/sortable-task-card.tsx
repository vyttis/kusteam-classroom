"use client"

import { useState } from "react"
import { useSortable, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Challenge } from "@/types/game"
import { isUnreviewedAiTask } from "@/lib/game/ai-review"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Eye,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"

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
  /** A short confirmation on the row: the task was just added or saved. */
  flash?: "added" | "saved" | null
}

const TYPE_LABELS: Record<string, string> = {
  text: "Tekstas",
  number: "Skaičius",
  multiple_choice: "Pasirinkimas",
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Lengva",
  medium: "Vidutinė",
  hard: "Sunki",
}

/** Points, type and difficulty as one quiet line of text. */
export function taskMeta(challenge: Pick<Challenge, "points" | "type" | "difficulty" | "generated_by_di">): string {
  return [
    `${challenge.points} tšk.`,
    TYPE_LABELS[challenge.type] ?? challenge.type,
    challenge.difficulty ? DIFFICULTY_LABELS[challenge.difficulty] : null,
    challenge.generated_by_di ? "DI" : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

type Attention = { label: string; hint: string; blocking: boolean }

/**
 * What the facilitator still has to do with a task before the lesson, most
 * pressing first. Said in words: the colour of the mark only supports it.
 */
function taskAttention(challenge: Challenge): Attention | null {
  if (challenge.needs_answer) {
    return {
      label: "Trūksta atsakymo",
      hint: "Be teisingo atsakymo veiklos pradėti negalima. Atidarykite užduotį ir jį įrašykite.",
      blocking: true,
    }
  }
  if (
    challenge.generated_by_di &&
    (challenge.verification_verdict === "uncertain" || challenge.verification_verdict === "fail")
  ) {
    return {
      label: "Reikia peržiūros",
      hint: "DI patikra abejoja šia užduotimi. Atidarykite, peržiūrėkite ir išsaugokite.",
      blocking: false,
    }
  }
  if (isUnreviewedAiTask(challenge)) {
    return {
      label: "Patvirtinkite atsakymą",
      hint: "DI sukurta užduotis. Atidarykite, patikrinkite atsakymą ir išsaugokite.",
      blocking: false,
    }
  }
  return null
}

const menuItem =
  "flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-steam-dark hover:bg-muted focus-visible:bg-muted focus-visible:outline-none aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent"

// Rows also glide to their new place after a move made from the menu, not
// only while one is dragged.
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  args.isSorting || args.wasDragging ? defaultAnimateLayoutChanges(args) : true

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
  flash = null,
}: SortableTaskCardProps) {
  // "Reduce motion": rows change place at once.
  const reducedMotion = useReducedMotion()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `challenge-${challenge.id}`,
    disabled: locked,
    transition: reducedMotion ? null : undefined,
    animateLayoutChanges: reducedMotion ? () => false : animateLayoutChanges,
  })
  const [menuOpen, setMenuOpen] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const attention = taskAttention(challenge)

  return (
    <li
      ref={setNodeRef}
      style={style}
      id={`task-row-${challenge.id}`}
      className={cn("list-none", isDragging && "relative z-10 opacity-40")}
    >
      {/* The entrance animation sits on the inner box: on the sortable node
          its transform would fight the one dragging sets. */}
      <div
        className={cn(
          "flex items-stretch rounded-xl border bg-white transition-colors motion-reduce:transition-none",
          isSelected
            ? "border-l-[6px] border-primary bg-primary/5"
            : "border-border hover:border-foreground/30",
          flash === "added" && "motion-rise-in"
        )}
      >
        {locked ? (
          <span className="flex w-11 shrink-0 items-center justify-center text-sm font-bold tabular-nums text-steam-dark">
            {index + 1}
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Vilkti užduotį ${index + 1} „${challenge.title}“ į kitą vietą`}
            className="flex w-11 shrink-0 cursor-grab touch-none flex-col items-center justify-center gap-0.5 rounded-l-xl text-muted-foreground hover:bg-muted active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-bold leading-none tabular-nums text-steam-dark">{index + 1}</span>
          </button>
        )}

        <button
          type="button"
          aria-current={isSelected ? "true" : undefined}
          title={attention?.hint}
          className="min-h-14 min-w-0 flex-1 rounded-md py-2 pl-1 pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => onSelect(challenge)}
        >
          <span className="sr-only">Redaguoti: </span>
          <span className="line-clamp-2 break-words text-sm font-bold leading-snug text-steam-dark">
            {challenge.title}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{taskMeta(challenge)}</span>
          {flash ? (
            <span className="motion-pop-in mt-1 inline-flex items-center gap-1 text-xs font-semibold text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary-ink" aria-hidden="true" />
              {flash === "added" ? "Pridėta" : "Išsaugota"}
            </span>
          ) : (
            attention && (
              <span
                className={cn(
                  "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-foreground",
                  attention.blocking ? "bg-accent/15" : "bg-highlight/30"
                )}
              >
                {attention.blocking ? (
                  <AlertTriangle className="h-3 w-3 shrink-0 text-accent-ink" aria-hidden="true" />
                ) : (
                  <Eye className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                {attention.label}
              </span>
            )
          )}
          {isSelected && <span className="sr-only"> (dabar redaguojama)</span>}
        </button>

        {locked ? (
          <span className="flex w-11 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
            <Pencil className="h-4 w-4" />
          </span>
        ) : (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 self-center text-muted-foreground"
                aria-label={`Daugiau veiksmų: „${challenge.title}“`}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              <ul>
                {onMove && (
                  <>
                    {/* The menu stays open after a move, so a task can go
                        several steps without reopening it. */}
                    <li>
                      <button
                        type="button"
                        className={menuItem}
                        aria-label={`Perkelti „${challenge.title}“ aukštyn`}
                        aria-disabled={isFirst}
                        onClick={() => {
                          if (!isFirst) onMove(challenge, -1)
                        }}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        Perkelti aukštyn
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={menuItem}
                        aria-label={`Perkelti „${challenge.title}“ žemyn`}
                        aria-disabled={isLast}
                        onClick={() => {
                          if (!isLast) onMove(challenge, 1)
                        }}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        Perkelti žemyn
                      </button>
                    </li>
                  </>
                )}
                <li>
                  <button
                    type="button"
                    className={menuItem}
                    aria-label={`Kopijuoti „${challenge.title}“`}
                    onClick={() => {
                      setMenuOpen(false)
                      onDuplicate(challenge)
                    }}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Kopijuoti
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={menuItem}
                    aria-label={`Ištrinti „${challenge.title}“`}
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete(challenge)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-accent-ink" aria-hidden="true" />
                    Ištrinti
                  </button>
                </li>
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </li>
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
    <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-primary bg-white py-2 pl-3 pr-4 shadow-lg">
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm font-bold tabular-nums text-steam-dark">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-steam-dark">{challenge.title}</p>
        <p className="text-xs text-muted-foreground">{taskMeta(challenge)}</p>
      </div>
    </div>
  )
}
