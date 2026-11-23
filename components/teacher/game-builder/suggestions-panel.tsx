"use client"

import { useState } from "react"
import { AiQuotaNote } from "@/components/teacher/ai-quota-note"
import { AiSuggestion } from "@/lib/ai/types"
import { Challenge } from "@/types/game"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DraggableSuggestionCard } from "./draggable-suggestion-card"
import { ImportDialog } from "./import-dialog"
import {
  Sparkles,
  Loader2,
  Wand2,
  AlertCircle,
  Plus,
  RefreshCw,
  CheckCircle2,
} from "lucide-react"

const quickActions = [
  { label: "3 klausimus", prompt: "Sugeneruok 3 įvairius klausimus" },
  {
    label: "Sunkesnių",
    prompt: "Sugeneruok sunkesnių užduočių, vertų daugiau taškų",
  },
  {
    label: "Pasirinkimo",
    prompt: "Sugeneruok tik multiple_choice tipo užduotis",
  },
]

interface SuggestionsPanelProps {
  gameTitle: string
  gameDescription: string | null
  existingChallenges: Challenge[]
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
  generationSuccess?: number | null
  // When provided, an "Importuoti" action lets the teacher generate
  // suggestions from an uploaded document (PDF/DOCX/TXT).
  onImportedSuggestions?: (suggestions: AiSuggestion[]) => void
  /** The optional scenario choice, shown with the first request. */
  scenarioPicker?: React.ReactNode
}

export function SuggestionsPanel({
  gameTitle,
  gameDescription,
  existingChallenges,
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
  generationSuccess,
  onImportedSuggestions,
  scenarioPicker,
}: SuggestionsPanelProps) {
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false)
  const selectableCount = suggestions.filter(
    (s, i) => s.verification?.verdict !== "fail" && !addedIds.has(i)
  ).length

  const hasSuggestions = suggestions.length > 0

  // The request form. Before the first request it is the whole mode; once
  // there are suggestions it moves below them as "more of these".
  const promptField = (
    <div className="space-y-1.5">
      <Label htmlFor="di-prompt" className="text-sm font-semibold text-foreground">
        {hasSuggestions ? "Ko dar reikia?" : "Kokių užduočių reikia?"}{" "}
        <span className="font-normal text-muted-foreground">(neprivaloma)</span>
      </Label>
      <Textarea
        id="di-prompt"
        placeholder="Aprašykite kokių užduočių norite... (neprivaloma)"
        value={teacherPrompt}
        onChange={(e) => onTeacherPromptChange(e.target.value)}
        className="resize-none bg-white text-sm"
        rows={3}
        disabled={loading}
        aria-describedby="di-prompt-note"
      />
      <p id="di-prompt-note" className="text-xs text-muted-foreground">
        Pvz. tema, klasė ar ko mokiniai dar nemoka. Palikus tuščią, DI remsis veiklos pavadinimu ir aprašymu.
      </p>
    </div>
  )

  const errorNotice = error && (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-border border-l-[6px] border-l-accent bg-white px-4 py-3"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">Pasiūlymų gauti nepavyko</p>
        <p className="text-sm text-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => onGenerate()} className="mt-2">
          Bandyti dar kartą
        </Button>
      </div>
    </div>
  )

  const loadingNotice = loading && (
    <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-4">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-steam-dark motion-reduce:animate-none" aria-hidden="true" />
      <div>
        <p className="text-sm font-bold text-steam-dark">DI generuoja užduotis...</p>
        <p className="text-sm text-muted-foreground">Tai gali užtrukti kelias sekundes</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold leading-tight text-steam-dark">DI Padėjėjas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          DI pasiūlo užduotis su atsakymais pagal veiklą &bdquo;{gameTitle}&ldquo;. Pasiūlymą pridėsite mygtuku
          &bdquo;Pridėti&ldquo; arba nutempę į užduočių sąrašą. Jau sukurta užduočių: {existingChallenges.length}.
        </p>
      </div>

      {!hasSuggestions && (
        <>
          {promptField}
          {scenarioPicker}

          <div className="space-y-2">
            <Button
              onClick={() => onGenerate()}
              disabled={loading}
              variant="outline"
              className="w-full gap-2 border-2 border-primary bg-white font-bold text-foreground hover:bg-primary/10 sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Generuojama...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Generuoti pasiūlymus
                </>
              )}
            </Button>
            <AiQuotaNote refreshKey={loading} />
          </div>

          {errorNotice}
          {loadingNotice}

          {/* Quick actions */}
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-semibold text-foreground">Greiti veiksmai</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => onGenerate(action.prompt)}
                  className="gap-1.5"
                >
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                  {action.label}
                </Button>
              ))}
              {onImportedSuggestions && (
                <ImportDialog
                  gameTitle={gameTitle}
                  gameDescription={gameDescription}
                  onImported={onImportedSuggestions}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Generation success banner */}
      {generationSuccess && !loading && (
        <p
          role="status"
          className="motion-fade-in flex items-center gap-2 rounded-xl border border-border border-l-[6px] border-l-primary bg-white px-4 py-3 text-sm font-bold text-foreground"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
          Sugeneruota užduočių: {generationSuccess}
        </p>
      )}

      {hasSuggestions && loadingNotice}

      {/* Suggestions: the toolbar, then the cards */}
      {!loading && hasSuggestions && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 className="text-base font-bold text-steam-dark">Pasiūlymai ({suggestions.length})</h3>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="px-3"
                onClick={onSelectAll}
                disabled={selectableCount === 0}
              >
                Pasirinkti visas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-3"
                onClick={onDeselectAll}
                disabled={selectedIds.size === 0}
              >
                Atžymėti
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-2 border-primary bg-white font-bold text-foreground hover:bg-primary/10"
                disabled={selectedIds.size === 0 || adding}
                onClick={onBulkAdd}
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                Pridėti ({selectedIds.size})
              </Button>
            </div>
          </div>
          {suggestions.map((suggestion, index) => (
            <DraggableSuggestionCard
              key={`${suggestion.title}-${index}`}
              suggestion={suggestion}
              index={index}
              selected={selectedIds.has(index)}
              added={addedIds.has(index)}
              adding={adding}
              onToggleSelect={onToggleSelect}
              onAdd={onAdd}
              onEdit={onEdit}
              onReject={onReject}
            />
          ))}
        </div>
      )}

      {/* More of these: the same request form, with both ways to generate */}
      {hasSuggestions && (
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-base font-bold text-steam-dark">Reikia daugiau?</h3>
          {promptField}
          {errorNotice}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-1.5 border-2 border-primary bg-white font-bold text-foreground hover:bg-primary/10"
              disabled={loading}
              onClick={() => onGenerate(undefined, true)}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generuoti dar
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={loading}
              onClick={() => setRegenerateConfirmOpen(true)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Generuoti iš naujo
            </Button>
            {onImportedSuggestions && (
              <ImportDialog
                gameTitle={gameTitle}
                gameDescription={gameDescription}
                onImported={onImportedSuggestions}
              />
            )}
          </div>
          <AiQuotaNote refreshKey={loading} />
        </div>
      )}

      {/* Regenerate confirmation */}
      <Dialog open={regenerateConfirmOpen} onOpenChange={setRegenerateConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              Generuoti pasiūlymus iš naujo?
            </DialogTitle>
            <DialogDescription>
              Dabartiniai pasiūlymai bus pakeisti naujais. Tai bus nauja DI užklausa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegenerateConfirmOpen(false)}
            >
              Atšaukti
            </Button>
            <Button
              onClick={() => {
                setRegenerateConfirmOpen(false)
                onGenerate()
              }}
            >
              Generuoti iš naujo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
