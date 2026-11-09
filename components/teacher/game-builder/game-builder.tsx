"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { Challenge, GameStatus, GameSettings } from "@/types/game"
import { readJson } from "@/lib/http/read-json"
import { AiSuggestion, DiGenerateResponse, ScenarioPreset } from "@/lib/ai/types"
import { BuilderHeader } from "./builder-header"
import { BuilderSettings } from "./builder-settings"
import { TaskDeleteDialog } from "./task-delete-dialog"
import { TaskListPanel } from "./task-list-panel"
import { TaskWorkspace } from "./task-workspace"
import { TaskCardOverlay } from "./sortable-task-card"
import { AiSuggestionCard } from "../ai-suggestion-card"
import { useToast } from "@/hooks/use-toast"
import { useIsDesktop } from "@/hooks/use-is-desktop"
import { confirmDiscardTask } from "@/hooks/use-leave-warning"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { AlertTriangle, Sparkles } from "lucide-react"
import { isLiveStatus } from "@/lib/game/live-edit"

interface GameBuilderProps {
  initialGame: {
    id: string
    title: string
    description: string | null
    status: GameStatus
    settings: GameSettings
    game_code: string
  }
  initialChallenges: Challenge[]
  /** A task to open in the editor on arrival (?task= from the activity page). */
  initialTaskId?: string | null
}

export function GameBuilder({ initialGame, initialChallenges, initialTaskId = null }: GameBuilderProps) {
  const router = useRouter()
  const { toast } = useToast()

  // Game state: derived from props, not frozen in useState — after a save the
  // page calls router.refresh(), the server component re-renders with fresh
  // data, and the header/settings must reflect it (title, status badge).
  const game = initialGame
  const live = isLiveStatus(game.status)
  const pathMode: "linear" | "free" = game.settings?.challenge_path_mode ?? "linear"
  // Render the workspace in exactly one place: the desktop panel OR the mobile
  // sheet, never both. A CSS-hidden desktop panel stays mounted on mobile,
  // producing two live editors (duplicate radio groups, duplicated /api/library
  // fetches, double autoFocus) whenever the mobile sheet is open.
  const isDesktop = useIsDesktop()
  const [challenges, setChallenges] = useState<Challenge[]>(initialChallenges)
  const initialTask = initialTaskId ? initialChallenges.find((c) => c.id === initialTaskId) ?? null : null
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(initialTask?.id ?? null)

  // Editor state
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(initialTask)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [prefillData, setPrefillData] = useState<AiSuggestion | null>(null)
  const [previewChallenge, setPreviewChallenge] = useState<Challenge | null>(null)

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Workspace tab: the editor when a task was asked for, else DI.
  const [activeTab, setActiveTab] = useState(initialTask ? "manual" : "di")

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isOverChallengeList, setIsOverChallengeList] = useState(false)

  // DI state
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [diLoading, setDiLoading] = useState(false)
  const [diError, setDiError] = useState<string | null>(null)
  const [teacherPrompt, setTeacherPrompt] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())
  // The suggestion open in the editor: saving it there adds it.
  const [editingSuggestionIndex, setEditingSuggestionIndex] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioPreset | null>(null)

  // Mobile sheet
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  // Below lg the editor lives in a sheet: open it once for the asked-for task.
  // useIsDesktop starts true and settles after mount, hence the effect.
  const initialTaskShown = useRef(false)
  useEffect(() => {
    if (!initialTask || initialTaskShown.current || isDesktop) return
    initialTaskShown.current = true
    setMobileSheetOpen(true)
  }, [initialTask, isDesktop])

  // DI suggestions survive a reload of this tab: generating them took a
  // minute of DI work. Kept per activity, for this tab only.
  const suggestionsKey = `ks-di-suggestions:${game.id}`
  const suggestionsRestored = useRef(false)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(suggestionsKey)
      const saved = raw ? (JSON.parse(raw) as { suggestions?: unknown; added?: unknown }) : null
      if (saved && Array.isArray(saved.suggestions) && saved.suggestions.length > 0) {
        setSuggestions(saved.suggestions as AiSuggestion[])
        setAddedIds(new Set(Array.isArray(saved.added) ? (saved.added as number[]) : []))
      }
    } catch {
      // Storage blocked or unreadable: start without saved suggestions.
    }
    suggestionsRestored.current = true
  }, [suggestionsKey])
  useEffect(() => {
    if (!suggestionsRestored.current) return
    try {
      if (suggestions.length > 0) {
        sessionStorage.setItem(suggestionsKey, JSON.stringify({ suggestions, added: [...addedIds] }))
      } else {
        sessionStorage.removeItem(suggestionsKey)
      }
    } catch {
      // Storage full or blocked: the suggestions stay for this visit.
    }
  }, [suggestions, addedIds, suggestionsKey])

  // Leaving a task with unsaved changes asks first.
  const confirmDiscard = confirmDiscardTask

  // Generation success feedback
  const [generationSuccess, setGenerationSuccess] = useState<number | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Delete confirmation
  const [deletingChallenge, setDeletingChallenge] = useState<Challenge | null>(null)
  const [deleteInProgress, setDeleteInProgress] = useState(false)

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  )

  // ========== Refresh challenges ==========
  const refreshChallenges = useCallback(async () => {
    try {
      const res = await fetch(`/api/challenges?game_id=${game.id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data.challenges || [])
      const sorted = list.sort(
        (a: Challenge, b: Challenge) => a.order_index - b.order_index
      )
      setChallenges(sorted)
    } catch {
      toast({
        title: "Nepavyko atnaujinti užduočių sąrašo",
        description: "Rodomas ankstesnis sąrašas. Bandykite dar kartą.",
        variant: "destructive",
      })
    }
  }, [game.id, toast])

  // ========== DI Generation ==========
  const handleGenerate = useCallback(
    async (promptOverride?: string, append = false) => {
      setDiLoading(true)
      setDiError(null)
      if (!append) {
        setSelectedIds(new Set())
        setAddedIds(new Set())
      }
      try {
        const res = await fetch("/api/di/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game_id: game.id,
            game_title: game.title,
            game_description: game.description,
            existing_challenges: challenges.map((c) => ({
              title: c.title,
              description: c.description,
              type: c.type,
              points: c.points,
            })),
            teacher_prompt: promptOverride || teacherPrompt.trim() || undefined,
            count: 3,
            scenario: selectedScenario || undefined,
          }),
        })
        if (!res.ok) {
          const err = await readJson<{ error?: unknown }>(res)
          throw new Error(err.error || "Nepavyko sugeneruoti pasiūlymų")
        }
        const data: DiGenerateResponse = await res.json()
        if (append) {
          setSuggestions((prev) => [...prev, ...data.suggestions])
        } else {
          setSuggestions(data.suggestions)
        }
        // Show success banner
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
        setGenerationSuccess(data.suggestions.length)
        successTimerRef.current = setTimeout(() => setGenerationSuccess(null), 3000)
      } catch (err) {
        setDiError(err instanceof Error ? err.message : "Nežinoma klaida")
      } finally {
        setDiLoading(false)
      }
    },
    [game.id, game.title, game.description, challenges, teacherPrompt, selectedScenario]
  )

  // Document import produces the same AiSuggestion shape as DI generation —
  // append them and reuse the success banner.
  function handleImported(imported: AiSuggestion[]) {
    if (imported.length === 0) return
    setSuggestions((prev) => [...prev, ...imported])
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    setGenerationSuccess(imported.length)
    successTimerRef.current = setTimeout(() => setGenerationSuccess(null), 3000)
  }

  // ========== Suggestion helpers ==========
  function handleReject(index: number) {
    setEditingSuggestionIndex((cur) => (cur === null || cur === index ? null : cur > index ? cur - 1 : cur))
    setSuggestions((prev) => prev.filter((_, i) => i !== index))
    setSelectedIds((prev) => {
      const next = new Set<number>()
      prev.forEach((id) => {
        if (id < index) next.add(id)
        else if (id > index) next.add(id - 1)
      })
      return next
    })
    setAddedIds((prev) => {
      const next = new Set<number>()
      prev.forEach((id) => {
        if (id < index) next.add(id)
        else if (id > index) next.add(id - 1)
      })
      return next
    })
  }

  function handleToggleSelect(index: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function handleSelectAll() {
    const ids = new Set<number>()
    suggestions.forEach((s, i) => {
      if (s.verification?.verdict !== "fail" && !addedIds.has(i)) ids.add(i)
    })
    setSelectedIds(ids)
  }

  function handleDeselectAll() {
    setSelectedIds(new Set())
  }

  async function addSuggestion(index: number): Promise<string | null> {
    const suggestion = suggestions[index]
    if (!suggestion || addedIds.has(index)) return "Pasiūlymas jau pridėtas"
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: game.id,
          title: suggestion.title,
          description: suggestion.description || "",
          type: suggestion.type,
          points: Number(suggestion.points) || 100,
          correct_answer: String(suggestion.correct_answer),
          hints: (suggestion.hints || []).slice(0, 10),
          options: suggestion.type === "multiple_choice" ? suggestion.options : null,
          explanation: suggestion.explanation || null,
          difficulty: suggestion.difficulty || null,
          generated_by_di: true,
          verification_verdict: suggestion.verification?.verdict ?? null,
          verification_issues: suggestion.verification?.issues ?? [],
          verification_confidence: suggestion.verification?.confidence ?? null,
        }),
      })
      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(index))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(index)
          return next
        })
        return null
      }
      const errBody = await res.json().catch(() => null)
      const msg = errBody?.error || `HTTP ${res.status}`
      console.error("addSuggestion failed:", msg, { status: res.status, suggestion: suggestion.title })
      return msg
    } catch (err) {
      console.error("addSuggestion network error:", err)
      return "Tinklo klaida"
    }
  }

  async function handleAddSingle(index: number) {
    setAdding(true)
    const error = await addSuggestion(index)
    if (!error) {
      toast({ title: "Užduotis pridėta" })
      refreshChallenges()
    } else {
      toast({ title: "Nepavyko pridėti", description: error, variant: "destructive" })
    }
    setAdding(false)
  }

  async function handleBulkAdd() {
    const toAdd = Array.from(selectedIds)
      .filter((i) => !addedIds.has(i))
      .filter((i) => suggestions[i]?.verification?.verdict !== "fail")
    if (toAdd.length === 0) return

    setAdding(true)
    let count = 0
    let lastError: string | null = null
    for (const i of toAdd) {
      const error = await addSuggestion(i)
      if (!error) count++
      else lastError = error
    }
    setSelectedIds(new Set())
    if (count > 0) {
      toast({ title: `Pridėta užduočių: ${count}` })
      refreshChallenges()
    } else {
      toast({ title: "Nepavyko pridėti užduočių", description: lastError || undefined, variant: "destructive" })
    }
    setAdding(false)
  }

  // ========== Edit suggestion (open in manual editor) ==========
  function handleEditSuggestion(index: number) {
    const suggestion = suggestions[index]
    if (!suggestion || !confirmDiscard()) return
    setEditingSuggestionIndex(index)
    setPrefillData(suggestion)
    setEditingChallenge(null)
    setIsCreatingNew(true)
    setSelectedChallengeId(null)
    setPreviewChallenge(null)
    setActiveTab("manual")
  }

  // ========== Challenge actions ==========
  function handleSelectChallenge(challenge: Challenge) {
    if (editingChallenge?.id !== challenge.id && !confirmDiscard()) return
    setEditingSuggestionIndex(null)
    setSelectedChallengeId(challenge.id)
    setEditingChallenge(challenge)
    setIsCreatingNew(false)
    setPrefillData(null)
    setPreviewChallenge(null)
    setActiveTab("manual")
    // Below lg the editor lives in a sheet: open it, or the tap does nothing.
    if (!isDesktop) setMobileSheetOpen(true)
  }

  function handleAddNew() {
    if (!confirmDiscard()) return
    setEditingSuggestionIndex(null)
    setEditingChallenge(null)
    setIsCreatingNew(true)
    setPrefillData(null)
    setPreviewChallenge(null)
    setSelectedChallengeId(null)
    setActiveTab("manual")
    if (!isDesktop) setMobileSheetOpen(true)
  }

  function handleDeleteChallenge(challenge: Challenge) {
    setDeletingChallenge(challenge)
  }

  async function confirmDeleteChallenge() {
    if (!deletingChallenge) return
    const challenge = deletingChallenge
    setDeleteInProgress(true)
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "")
      }
      toast({ title: "Užduotis ištrinta" })
      if (editingChallenge?.id === challenge.id) {
        setEditingChallenge(null)
        setIsCreatingNew(false)
      }
      refreshChallenges()
    } catch (e) {
      toast({
        title: "Nepavyko ištrinti",
        description: e instanceof Error && e.message ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setDeleteInProgress(false)
      setDeletingChallenge(null)
    }
  }

  async function handleDuplicateChallenge(challenge: Challenge) {
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: game.id,
          title: `${challenge.title} (kopija)`,
          description: challenge.description || "",
          type: challenge.type,
          points: challenge.points,
          // answer_hash can't be copied client-side; the copy is flagged until
          // the teacher sets a real answer (blocks activation)
          needs_answer: true,
          hints: challenge.hints || [],
          options: challenge.options,
          explanation: challenge.explanation,
          difficulty: challenge.difficulty,
          hint_penalty: challenge.hint_penalty,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "")
      }
      toast({
        title: "Užduotis nukopijuota",
        description: "Kopijai reikia nustatyti teisingą atsakymą.",
      })
      refreshChallenges()
    } catch (e) {
      toast({
        title: "Nepavyko kopijuoti",
        description: e instanceof Error && e.message ? e.message : undefined,
        variant: "destructive",
      })
    }
  }

  function handleEditorSuccess() {
    // A suggestion saved from the editor counts as added, so "Pasirinkti
    // visas" does not add it a second time.
    if (editingSuggestionIndex !== null) {
      const index = editingSuggestionIndex
      setAddedIds((prev) => new Set(prev).add(index))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
    setEditingSuggestionIndex(null)
    setEditingChallenge(null)
    setIsCreatingNew(false)
    setPrefillData(null)
    refreshChallenges()
  }

  function handleEditorCancel() {
    setEditingSuggestionIndex(null)
    setEditingChallenge(null)
    setIsCreatingNew(false)
    setPrefillData(null)
  }

  // ========== DnD handlers ==========
  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event
    if (!over) {
      setIsOverChallengeList(false)
      return
    }
    const overId = String(over.id)
    setIsOverChallengeList(
      overId === "challenge-list-drop" || overId.startsWith("challenge-")
    )
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setIsOverChallengeList(false)
    if (!over) return

    const activeStr = String(active.id)
    const overStr = String(over.id)

    // Reorder within challenge list
    if (
      activeStr.startsWith("challenge-") &&
      (overStr.startsWith("challenge-") || overStr === "challenge-list-drop")
    ) {
      if (live || overStr === "challenge-list-drop" || activeStr === overStr) return
      const oldIdx = challenges.findIndex((c) => `challenge-${c.id}` === activeStr)
      const newIdx = challenges.findIndex((c) => `challenge-${c.id}` === overStr)
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return

      const previous = challenges
      const reordered = arrayMove(challenges, oldIdx, newIdx)
      setChallenges(reordered)

      // Roll back the optimistic reorder if the server rejects it — otherwise
      // the list looks reordered but silently reverts on the next load
      try {
        const res = await fetch("/api/challenges/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game_id: game.id,
            order: reordered.map((c, i) => ({ id: c.id, order_index: i })),
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch {
        setChallenges(previous)
        toast({
          title: "Nepavyko išsaugoti tvarkos",
          description: "Patikrinkite ryšį ir bandykite dar kartą.",
          variant: "destructive",
        })
      }
    }

    // Drop suggestion into challenge list
    if (
      activeStr.startsWith("suggestion-") &&
      (overStr.startsWith("challenge-") || overStr === "challenge-list-drop")
    ) {
      const idx = parseInt(activeStr.replace("suggestion-", ""), 10)
      if (isNaN(idx)) return
      setAdding(true)
      const error = await addSuggestion(idx)
      if (!error) {
        toast({ title: "Užduotis pridėta" })
        refreshChallenges()
      } else {
        toast({ title: "Nepavyko pridėti", description: error, variant: "destructive" })
      }
      setAdding(false)
    }
  }

  // DnD overlay data
  const activeSuggestionIndex = activeId?.startsWith("suggestion-")
    ? parseInt(activeId.replace("suggestion-", ""), 10)
    : null
  const activeChallengeId = activeId?.startsWith("challenge-")
    ? activeId.replace("challenge-", "")
    : null
  const activeSuggestion =
    activeSuggestionIndex !== null ? suggestions[activeSuggestionIndex] : null
  const activeChallengeIndex = activeChallengeId
    ? challenges.findIndex((c) => c.id === activeChallengeId)
    : -1
  const activeChallenge =
    activeChallengeIndex >= 0 ? challenges[activeChallengeIndex] : null
  const totalPoints = challenges.reduce((sum, c) => sum + (c.points || 0), 0)

  return (
    <div className="min-h-screen bg-muted/20">
      <BuilderHeader
        game={game}
        challengeCount={challenges.length}
        totalPoints={totalPoints}
        tasksNeedingAnswer={challenges
          .filter((c) => c.needs_answer)
          .map((c) => ({ id: c.id, title: c.title }))}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {live && (
        <div
          role="status"
          className="mx-4 sm:mx-6 lg:mx-8 mt-4 flex items-start gap-3 rounded-lg border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm text-steam-dark"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-highlight-ink" aria-hidden="true" />
          <p>
            <span className="font-semibold">Veikla vyksta.</span> Pakeistą atsakymą ir taškus sistema taiko
            iš karto naujiems bandymams, o pakeistą ar naują užduotį dalyviai pamatys per kelias sekundes.
            Užduočių ištrinti, kopijuoti, pertvarkyti ir keisti jų atrakinimo sąlygų negalima, kol veikla
            nebaigta.
          </p>
        </div>
      )}

      <BuilderSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        gameId={game.id}
        title={game.title}
        description={game.description}
        settings={game.settings}
        live={game.status === "active" || game.status === "paused"}
        onSaved={() => {
          router.refresh()
        }}
      />

      <TaskDeleteDialog
        open={deletingChallenge !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingChallenge(null)
        }}
        taskTitle={deletingChallenge?.title || ""}
        deleting={deleteInProgress}
        onConfirm={confirmDeleteChallenge}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
            {/* Left panel: Task list */}
            <div className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto rounded-lg border border-border/50 bg-white p-4">
              <TaskListPanel
                challenges={challenges}
                selectedId={selectedChallengeId}
                onSelect={handleSelectChallenge}
                onDelete={handleDeleteChallenge}
                onDuplicate={handleDuplicateChallenge}
                onAddNew={handleAddNew}
                locked={live}
                isOverPanel={
                  isOverChallengeList &&
                  activeId?.startsWith("suggestion-") === true
                }
              />
              {/* Mobile: open DI sheet */}
              <div className="lg:hidden mt-4">
                <button
                  type="button"
                  className="w-full p-3 rounded-lg border border-highlight/30 bg-highlight/5 text-sm font-medium text-highlight-ink flex items-center justify-center gap-2"
                  onClick={() => setMobileSheetOpen(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  DI Padėjėjas / Redagavimas
                </button>
              </div>
            </div>

            {/* Right panel: Workspace (desktop only — mobile uses the sheet
                below, so the editor never mounts twice) */}
            {isDesktop && (
            <div className="hidden lg:block">
              <div className="rounded-lg border border-border/50 bg-white p-4">
                <TaskWorkspace
                  gameId={game.id}
                  pathMode={pathMode}
                  gameTitle={game.title}
                  gameDescription={game.description}
                  challenges={challenges}
                  editingChallenge={editingChallenge}
                  prefillData={prefillData}
                  isCreatingNew={isCreatingNew}
                  onEditorSuccess={handleEditorSuccess}
                  onEditorCancel={handleEditorCancel}
                  previewChallenge={previewChallenge}
                  onClosePreview={() => setPreviewChallenge(null)}
                  suggestions={suggestions}
                  selectedIds={selectedIds}
                  addedIds={addedIds}
                  adding={adding}
                  diLoading={diLoading}
                  diError={diError}
                  teacherPrompt={teacherPrompt}
                  onTeacherPromptChange={setTeacherPrompt}
                  onGenerate={handleGenerate}
                  onToggleSelect={handleToggleSelect}
                  onSelectAll={handleSelectAll}
                  onDeselectAll={handleDeselectAll}
                  onAddSuggestion={handleAddSingle}
                  onEditSuggestion={handleEditSuggestion}
                  onBulkAdd={handleBulkAdd}
                  onReject={handleReject}
                  selectedScenario={selectedScenario}
                  onScenarioChange={setSelectedScenario}
                  generationSuccess={generationSuccess}
                  onImportedSuggestions={handleImported}
                  onTaskAdded={refreshChallenges}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Mobile: Workspace as Sheet — only mounted below lg, so it can't
            coexist with the desktop panel */}
        <Sheet
          open={!isDesktop && mobileSheetOpen}
          onOpenChange={(open) => {
            // Closing the sheet drops the editor: unsaved changes ask first.
            if (!open && !confirmDiscardTask()) return
            setMobileSheetOpen(open)
          }}
        >
          <SheetContent
            side="right"
            className="w-full sm:w-[440px] sm:max-w-[440px] flex flex-col overflow-hidden p-0"
          >
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/30 shrink-0">
              <SheetTitle className="text-steam-dark">
                Darbo erdvė
              </SheetTitle>
              <SheetDescription>
                Kurkite, redaguokite arba generuokite užduotis
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <TaskWorkspace
                gameId={game.id}
                pathMode={pathMode}
                gameTitle={game.title}
                gameDescription={game.description}
                challenges={challenges}
                editingChallenge={editingChallenge}
                prefillData={prefillData}
                isCreatingNew={isCreatingNew}
                onEditorSuccess={() => {
                  handleEditorSuccess()
                  setMobileSheetOpen(false)
                }}
                onEditorCancel={() => {
                  handleEditorCancel()
                  setMobileSheetOpen(false)
                }}
                previewChallenge={previewChallenge}
                onClosePreview={() => setPreviewChallenge(null)}
                suggestions={suggestions}
                selectedIds={selectedIds}
                addedIds={addedIds}
                adding={adding}
                diLoading={diLoading}
                diError={diError}
                teacherPrompt={teacherPrompt}
                onTeacherPromptChange={setTeacherPrompt}
                onGenerate={handleGenerate}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onAddSuggestion={handleAddSingle}
                onEditSuggestion={handleEditSuggestion}
                onBulkAdd={handleBulkAdd}
                onReject={handleReject}
                selectedScenario={selectedScenario}
                onScenarioChange={setSelectedScenario}
                generationSuccess={generationSuccess}
                onImportedSuggestions={handleImported}
                onTaskAdded={refreshChallenges}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeChallenge && (
            <TaskCardOverlay
              challenge={activeChallenge}
              index={activeChallengeIndex}
            />
          )}
          {activeSuggestion && activeSuggestionIndex !== null && (
            <div className="w-[360px] opacity-90 shadow-lg rounded-lg">
              <AiSuggestionCard
                suggestion={activeSuggestion}
                index={activeSuggestionIndex}
                selected={false}
                added={false}
                adding={false}
                onToggleSelect={() => {}}
                onAdd={() => {}}
                onReject={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
