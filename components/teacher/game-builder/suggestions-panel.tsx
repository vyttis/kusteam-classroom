"use client"

import { useState } from "react"
import { AiQuotaNote } from "@/components/teacher/ai-quota-note"
import { AiSuggestion } from "@/lib/ai/types"
import { Challenge } from "@/types/game"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AnimatePresence } from "framer-motion"
import { DraggableSuggestionCard } from "./draggable-suggestion-card"
import { ImportDialog } from "./import-dialog"
import { motion } from "framer-motion"
import {
  Sparkles,
  Loader2,
  Wand2,
  AlertCircle,
  Puzzle,
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
}: SuggestionsPanelProps) {
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false)
  const selectableCount = suggestions.filter(
    (s, i) => s.verification?.verdict !== "fail" && !addedIds.has(i)
  ).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-highlight-ink" />
        <h2 className="font-semibold text-steam-dark">DI Padėjėjas</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Sugeneruokite užduočių pasiūlymus ir vilkite juos į kairę pusę
      </p>

      {/* Game context */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
        <div className="flex items-center gap-2 mb-1">
          <Puzzle className="h-3.5 w-3.5 text-primary-ink" />
          <span className="text-xs font-medium text-steam-dark">
            {gameTitle}
          </span>
        </div>
        {gameDescription && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {gameDescription}
          </p>
        )}
        <Badge variant="outline" className="text-xs mt-2">
          Jau sukurta užduočių: {existingChallenges.length}
        </Badge>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">
          Greiti veiksmai
        </p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => onGenerate(action.prompt)}
              className="text-xs h-7 gap-1 border-highlight/40 text-highlight-ink hover:bg-highlight/10"
            >
              <Wand2 className="h-3 w-3" />
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

      {/* Custom prompt */}
      <div className="space-y-2">
        <Textarea
          placeholder="Aprašykite kokių užduočių norite... (neprivaloma)"
          value={teacherPrompt}
          onChange={(e) => onTeacherPromptChange(e.target.value)}
          className="resize-none bg-white text-sm"
          rows={3}
          disabled={loading}
        />
        <Button
          onClick={() => onGenerate()}
          disabled={loading}
          className="w-full bg-highlight hover:bg-highlight/90 text-steam-dark font-medium gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generuojama...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generuoti pasiūlymus
            </>
          )}
        </Button>
        <AiQuotaNote className="text-center" refreshKey={loading} />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-accent-ink shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-accent-ink font-medium">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onGenerate()}
              className="text-xs text-accent-ink mt-1 h-6 px-0 hover:bg-transparent hover:text-accent-ink/80"
            >
              Bandyti dar kartą
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8">
          <div className="relative mx-auto w-16 h-16 mb-4">
            <Sparkles className="h-8 w-8 text-highlight-ink absolute inset-0 m-auto animate-pulse" />
            <div className="absolute inset-0 border-2 border-highlight/20 border-t-highlight rounded-full animate-spin" />
          </div>
          <p className="text-sm font-medium text-steam-dark">
            DI generuoja užduotis...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Tai gali užtrukti kelias sekundes
          </p>
        </div>
      )}

      {/* Generation success banner */}
      <AnimatePresence>
        {generationSuccess && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2"
          >
            <CheckCircle2 className="h-5 w-5 text-primary-ink shrink-0" />
            <span className="text-sm font-medium text-steam-dark">
              Sugeneruota užduočių: {generationSuccess}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection toolbar */}
      {!loading && suggestions.length > 0 && (
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={onSelectAll}
              disabled={selectableCount === 0}
            >
              Pasirinkti visas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={onDeselectAll}
              disabled={selectedIds.size === 0}
            >
              Atžymėti
            </Button>
          </div>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-7 gap-1"
            disabled={selectedIds.size === 0 || adding}
            onClick={onBulkAdd}
          >
            {adding ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Pridėti ({selectedIds.size})
          </Button>
        </div>
      )}

      {/* Suggestions list */}
      {!loading && suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">
            Pasiūlymai ({suggestions.length}). Vilkite į kairę arba spauskite &bdquo;Pridėti&ldquo;
          </p>
          <AnimatePresence>
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
          </AnimatePresence>
        </div>
      )}

      {/* Generate more / Regenerate buttons */}
      {!loading && suggestions.length > 0 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1 flex-1"
            onClick={() => onGenerate(undefined, true)}
          >
            <Sparkles className="h-3 w-3" />
            Generuoti dar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1 flex-1 text-accent-ink border-accent/30 hover:bg-accent/5"
            onClick={() => setRegenerateConfirmOpen(true)}
          >
            <RefreshCw className="h-3 w-3" />
            Generuoti iš naujo
          </Button>
        </div>
      )}

      {/* Regenerate confirmation */}
      <Dialog open={regenerateConfirmOpen} onOpenChange={setRegenerateConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-accent-ink" />
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
              className="bg-accent-ink hover:bg-accent-ink/90 text-white"
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

      {/* Empty state */}
      {!loading && suggestions.length === 0 && !error && (
        <div className="text-center py-6">
          <Sparkles className="h-8 w-8 text-highlight-ink/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Paspauskite mygtuką arba pasirinkite greitą veiksmą, kad DI
            sugeneruotų užduočių pasiūlymus pagal jūsų veiklos temą.
          </p>
        </div>
      )}
    </div>
  )
}
