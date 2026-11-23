"use client"

import { Challenge } from "@/types/game"
import { AiSuggestion, ScenarioPreset } from "@/lib/ai/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ManualTaskEditor } from "./manual-task-editor"
import { DiWorkspace } from "./di-workspace"
import { LibraryWorkspace } from "./library-workspace"
import { TaskPreview } from "./task-preview"
import { Button } from "@/components/ui/button"
import { BookOpen, Pencil, Plus, Sparkles } from "lucide-react"

interface TaskWorkspaceProps {
  gameId: string
  gameTitle: string
  gameDescription: string | null
  challenges: Challenge[]
  // Path mode drives the free-mode prerequisites picker in the editor
  pathMode: "linear" | "free"
  // Editor state
  editingChallenge: Challenge | null
  prefillData: AiSuggestion | null
  isCreatingNew: boolean
  onEditorSuccess: () => void
  onEditorCancel: () => void
  // Preview state
  previewChallenge: Challenge | null
  onClosePreview: () => void
  // DI state
  suggestions: AiSuggestion[]
  selectedIds: Set<number>
  addedIds: Set<number>
  adding: boolean
  diLoading: boolean
  diError: string | null
  teacherPrompt: string
  onTeacherPromptChange: (value: string) => void
  onGenerate: (promptOverride?: string, append?: boolean) => void
  onToggleSelect: (index: number) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onAddSuggestion: (index: number) => void
  onEditSuggestion?: (index: number) => void
  onBulkAdd: () => void
  onReject: (index: number) => void
  selectedScenario: ScenarioPreset | null
  onScenarioChange: (scenario: ScenarioPreset | null) => void
  generationSuccess?: number | null
  onImportedSuggestions?: (suggestions: AiSuggestion[]) => void
  // Library
  onTaskAdded: () => void
  /** Starts a new task in the editor (the manual mode's next step). */
  onAddNew: () => void
  // Active tab
  activeTab: string
  onTabChange: (tab: string) => void
}

export function TaskWorkspace({
  gameId,
  gameTitle,
  gameDescription,
  challenges,
  pathMode,
  editingChallenge,
  prefillData,
  isCreatingNew,
  onEditorSuccess,
  onEditorCancel,
  previewChallenge,
  onClosePreview,
  suggestions,
  selectedIds,
  addedIds,
  adding,
  diLoading,
  diError,
  teacherPrompt,
  onTeacherPromptChange,
  onGenerate,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onAddSuggestion,
  onEditSuggestion,
  onBulkAdd,
  onReject,
  selectedScenario,
  onScenarioChange,
  generationSuccess,
  onImportedSuggestions,
  onTaskAdded,
  onAddNew,
  activeTab,
  onTabChange,
}: TaskWorkspaceProps) {
  // If previewing a challenge, show preview
  if (previewChallenge) {
    return <TaskPreview challenge={previewChallenge} onClose={onClosePreview} />
  }

  // If editing or creating, show the editor
  if (editingChallenge || isCreatingNew) {
    return (
      <div className="motion-fade-in">
        <h2 className="mb-5 text-xl font-bold leading-tight text-steam-dark">
          {editingChallenge ? "Redaguoti užduotį" : "Nauja užduotis"}
        </h2>
        <ManualTaskEditor
          gameId={gameId}
          challenge={editingChallenge}
          prefillData={prefillData}
          onSuccess={onEditorSuccess}
          onCancel={onEditorCancel}
          pathMode={pathMode}
          allChallenges={challenges}
        />
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      {/* Three ways to get a task, as one segmented control. */}
      <TabsList className="mb-5 grid w-full grid-cols-3" aria-label="Kaip kurti užduotį">
        <TabsTrigger value="manual" className="gap-1.5 px-2">
          <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
          Rankinis
        </TabsTrigger>
        <TabsTrigger value="di" className="gap-1.5 px-2">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          DI
        </TabsTrigger>
        <TabsTrigger value="library" className="gap-1.5 px-2">
          <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          Biblioteka
        </TabsTrigger>
      </TabsList>

      <TabsContent value="manual" className="mt-0">
        <div className="mx-auto max-w-md py-8 text-center">
          <h2 className="text-xl font-bold leading-tight text-steam-dark">Rašykite užduotį patys</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Užduočiai reikia klausimo, teisingo atsakymo ir taškų. Jei norite pakeisti jau esamą užduotį,
            pasirinkite ją užduočių sąraše.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onAddNew}
            className="mt-5 gap-1.5 border-2 border-primary bg-white font-bold text-foreground hover:bg-primary/10"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nauja užduotis
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="di" className="mt-0">
        <DiWorkspace
          gameId={gameId}
          gameTitle={gameTitle}
          gameDescription={gameDescription}
          challenges={challenges}
          suggestions={suggestions}
          selectedIds={selectedIds}
          addedIds={addedIds}
          adding={adding}
          loading={diLoading}
          error={diError}
          teacherPrompt={teacherPrompt}
          onTeacherPromptChange={onTeacherPromptChange}
          onGenerate={onGenerate}
          onToggleSelect={onToggleSelect}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          onAdd={onAddSuggestion}
          onEdit={onEditSuggestion}
          onBulkAdd={onBulkAdd}
          onReject={onReject}
          selectedScenario={selectedScenario}
          onScenarioChange={onScenarioChange}
          generationSuccess={generationSuccess}
          onImportedSuggestions={onImportedSuggestions}
        />
      </TabsContent>

      <TabsContent value="library" className="mt-0">
        <LibraryWorkspace gameId={gameId} onTaskAdded={onTaskAdded} />
      </TabsContent>
    </Tabs>
  )
}
