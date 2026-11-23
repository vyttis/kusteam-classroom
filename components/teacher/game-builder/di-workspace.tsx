"use client"

import { Challenge } from "@/types/game"
import { AiSuggestion, ScenarioPreset } from "@/lib/ai/types"
import { SuggestionsPanel } from "./suggestions-panel"
import { cn } from "@/lib/utils"
import {
  Check,
  Zap,
  Search,
  DoorOpen,
  MessageSquare,
} from "lucide-react"

const scenarios: {
  id: ScenarioPreset
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    id: "quick_check",
    label: "Greitas patikrinimas",
    description: "Trumpi faktiniai klausimai, 1-2 min. kiekvienam",
    icon: <Zap className="h-5 w-5" />,
  },
  {
    id: "investigation",
    label: "Komandinis tyrimas",
    description: "Tyrinėjimo užduotys, reikalaujančios kelių žingsnių",
    icon: <Search className="h-5 w-5" />,
  },
  {
    id: "escape_room",
    label: "Pabėgimo kambarys",
    description: "Nuoseklūs galvosūkiai, kiekvienas atrakina kitą",
    icon: <DoorOpen className="h-5 w-5" />,
  },
  {
    id: "discussion",
    label: "Diskusijos pamoka",
    description: "Atviri klausimai, skatinantys mąstymą",
    icon: <MessageSquare className="h-5 w-5" />,
  },
]

interface DiWorkspaceProps {
  gameId: string
  gameTitle: string
  gameDescription: string | null
  challenges: Challenge[]
  suggestions: AiSuggestion[]
  selectedIds: Set<number>
  addedIds: Set<number>
  adding: boolean
  loading: boolean
  error: string | null
  teacherPrompt: string
  onTeacherPromptChange: (value: string) => void
  onGenerate: (promptOverride?: string, append?: boolean) => void
  onToggleSelect: (index: number) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onAdd: (index: number) => void
  onEdit?: (index: number) => void
  onBulkAdd: () => void
  onReject: (index: number) => void
  selectedScenario: ScenarioPreset | null
  onScenarioChange: (scenario: ScenarioPreset | null) => void
  generationSuccess?: number | null
  onImportedSuggestions?: (suggestions: AiSuggestion[]) => void
}

export function DiWorkspace({
  gameTitle,
  gameDescription,
  challenges,
  suggestions,
  selectedIds,
  addedIds,
  adding,
  loading,
  error,
  teacherPrompt,
  onTeacherPromptChange,
  onGenerate,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onAdd,
  onEdit,
  onBulkAdd,
  onReject,
  selectedScenario,
  onScenarioChange,
  generationSuccess,
  onImportedSuggestions,
}: DiWorkspaceProps) {
  return (
    <SuggestionsPanel
      gameTitle={gameTitle}
      gameDescription={gameDescription}
      existingChallenges={challenges}
      suggestions={suggestions}
      selectedIds={selectedIds}
      addedIds={addedIds}
      adding={adding}
      loading={loading}
      error={error}
      teacherPrompt={teacherPrompt}
      onTeacherPromptChange={onTeacherPromptChange}
      onGenerate={onGenerate}
      onToggleSelect={onToggleSelect}
      onSelectAll={onSelectAll}
      onDeselectAll={onDeselectAll}
      onAdd={onAdd}
      onEdit={onEdit}
      onBulkAdd={onBulkAdd}
      onReject={onReject}
      generationSuccess={generationSuccess}
      onImportedSuggestions={onImportedSuggestions}
      scenarioPicker={
        /* Scenario presets: an optional choice made before the first request */
        suggestions.length === 0 && !loading ? (
          <fieldset>
            <legend className="text-sm font-semibold text-foreground">
              Scenarijus <span className="font-normal text-muted-foreground">(neprivaloma)</span>
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {scenarios.map((s) => {
                const chosen = selectedScenario === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => onScenarioChange(chosen ? null : s.id)}
                    className={cn(
                      "flex min-h-14 items-start gap-2.5 rounded-xl border bg-white p-3 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      chosen ? "border-2 border-primary bg-primary/5 p-[calc(0.75rem-1px)]" : "border-border hover:border-foreground/30"
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-steam-dark [&_svg]:h-5 [&_svg]:w-5" aria-hidden="true">
                      {chosen ? <Check /> : s.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-steam-dark">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">{s.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        ) : null
      }
    />
  )
}
