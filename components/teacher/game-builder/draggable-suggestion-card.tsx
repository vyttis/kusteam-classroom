"use client"

import { useDraggable } from "@dnd-kit/core"
import { AiSuggestion } from "@/lib/ai/types"
import { AiSuggestionCard } from "../ai-suggestion-card"
import { GripVertical } from "lucide-react"

interface DraggableSuggestionCardProps {
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

export function DraggableSuggestionCard({
  suggestion,
  index,
  selected,
  added,
  adding,
  onToggleSelect,
  onAdd,
  onEdit,
  onReject,
}: DraggableSuggestionCardProps) {
  const isFailed = suggestion.verification?.verdict === "fail"
  const canDrag = !added && !isFailed

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `suggestion-${index}`,
    disabled: !canDrag,
    data: { type: "suggestion", index, suggestion },
  })

  return (
    <div
      ref={setNodeRef}
      className={`relative group ${isDragging ? "opacity-40" : ""}`}
    >
      {/* Drag handle overlay */}
      {canDrag && (
        <button
          type="button"
          aria-label={`Vilkti pasiūlymą „${suggestion.title}“ į užduočių sąrašą`}
          className="absolute right-1.5 top-1.5 z-10 hidden h-9 w-9 cursor-grab touch-none items-center justify-center rounded-full bg-white opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing group-hover:opacity-100 motion-reduce:transition-none lg:flex"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      )}
      <AiSuggestionCard
        suggestion={suggestion}
        index={index}
        selected={selected}
        added={added}
        adding={adding}
        onToggleSelect={onToggleSelect}
        onAdd={onAdd}
        onEdit={onEdit}
        onReject={onReject}
      />
    </div>
  )
}
