"use client"

import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Challenge } from "@/types/game"
import { SortableTaskCard } from "./sortable-task-card"
import { Plus, Puzzle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TaskListPanelProps {
  challenges: Challenge[]
  selectedId: string | null
  onSelect: (challenge: Challenge) => void
  onDelete: (challenge: Challenge) => void
  onDuplicate: (challenge: Challenge) => void
  /** Moves a task one step: the alternative to dragging. */
  onMove?: (challenge: Challenge, direction: -1 | 1) => void
  onAddNew: () => void
  isOverPanel: boolean
  locked?: boolean
}

export function TaskListPanel({
  challenges,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onMove,
  onAddNew,
  isOverPanel,
  locked = false,
}: TaskListPanelProps) {
  const { setNodeRef } = useDroppable({
    id: "challenge-list-drop",
  })

  const sortableIds = challenges.map((c) => `challenge-${c.id}`)
  const totalPoints = challenges.reduce((sum, c) => sum + (c.points || 0), 0)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-steam-dark flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-primary-ink" />
            Užduotys
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {challenges.length} užd. &middot; {totalPoints} tšk.
          </p>
        </div>
        <Button
          onClick={onAddNew}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-8"
        >
          <Plus className="h-3.5 w-3.5" />
          Nauja
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-lg transition-colors ${
          isOverPanel
            ? "bg-primary/5 border-2 border-dashed border-primary/30"
            : ""
        }`}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {challenges.length > 0 ? (
            <div className="space-y-2">
              {challenges.map((challenge, index) => (
                <SortableTaskCard
                  key={challenge.id}
                  challenge={challenge}
                  index={index}
                  isSelected={selectedId === challenge.id}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                  onMove={onMove}
                  isFirst={index === 0}
                  isLast={index === challenges.length - 1}
                  locked={locked}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              {isOverPanel ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <Plus className="h-8 w-8 text-primary-ink animate-pulse" />
                  </div>
                  <h3 className="text-sm font-semibold text-primary-ink mb-1">
                    Paleiskite užduotį čia
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Atleiskite, kad pridėtumėte
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-highlight/10 flex items-center justify-center">
                    <ArrowRight className="h-7 w-7 text-highlight-ink animate-[nudge_1.5s_ease-in-out_infinite]" />
                  </div>
                  <h3 className="text-sm font-semibold text-steam-dark mb-1">
                    Nutempkite DI užduotis čia
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    arba sukurkite rankiniu būdu
                  </p>
                  <Button
                    onClick={onAddNew}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Pridėti rankiniu būdu
                  </Button>
                </>
              )}
            </div>
          )}
        </SortableContext>

        {isOverPanel && challenges.length > 0 && (
          <div className="mt-2 h-10 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 flex items-center justify-center">
            <p className="text-xs text-primary-ink font-medium">
              Paleiskite čia
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
