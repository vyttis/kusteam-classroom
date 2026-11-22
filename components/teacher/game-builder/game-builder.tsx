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
  type UniqueIdentifier,
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
import { useSessionExpired } from "@/hooks/use-session-expired"
import { SessionExpiredNotice } from "@/components/teacher/session-expired-notice"
import { notifyAiUsageChanged } from "@/components/teacher/ai-quota-note"
import {
  addFailureReason,
  failureLines,
  partialAddSummary,
  type AddFailure,
} from "@/components/teacher/task-add-result"
import { DND_INSTRUCTIONS_LT, dndAnnouncementsLt, stepTarget } from "./dnd-a11y"
import {
  pendingSuggestionsKey,
  readPendingSuggestions,
  writePendingSuggestions,
} from "./pending-suggestions"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { AlertTriangle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isLiveStatus } from "@/lib/game/live-edit"
import { aiTasksToReview } from "@/lib/game/ai-review"

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

  // Generated suggestions were already counted against the monthly DI
  // allowance: until they are added or dismissed they are kept in this
  // browser per activity (7 days), so a reload does not lose them.
  const suggestionsKey = pendingSuggestionsKey(game.id)
  const [suggestionsStoreReady, setSuggestionsStoreReady] = useState(false)
  // When the suggestions on screen were generated (kept across a restore).
  const [suggestionsSavedAt, setSuggestionsSavedAt] = useState<number | null>(null)
  // Set when suggestions were restored from this browser: shows the notice.
  const [restoredSuggestions, setRestoredSuggestions] = useState<{ count: number; savedAt: number } | null>(null)
  useEffect(() => {
    let saved = null
    try {
      saved = readPendingSuggestions(window.localStorage, suggestionsKey)
    } catch {
      // Storage blocked: start without saved suggestions.
    }
    if (saved) {
      setSuggestions(saved.suggestions)
      setAddedIds(new Set())
      setSuggestionsSavedAt(saved.savedAt)
      setRestoredSuggestions({ count: saved.suggestions.length, savedAt: saved.savedAt })
    }
    setSuggestionsStoreReady(true)
  }, [suggestionsKey])
  useEffect(() => {
    // Not before the stored ones were read: an empty first render would
    // erase them.
    if (!suggestionsStoreReady) return
    try {
      writePendingSuggestions(
        window.localStorage,
        suggestionsKey,
        suggestions,
        addedIds,
        suggestionsSavedAt ?? Date.now()
      )
    } catch {
      // Storage blocked: the suggestions stay for this visit.
    }
  }, [suggestions, addedIds, suggestionsKey, suggestionsStoreReady, suggestionsSavedAt])

  // A session that ended mid-work: one notice for the whole builder.
  const session = useSessionExpired()

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
        if (session.check(res)) {
          throw new Error("Sesija baigėsi. Prisijunkite naujame skirtuke ir generuokite dar kartą.")
        }
        if (!res.ok) {
          const err = await readJson<{ error?: unknown }>(res)
          throw new Error(err.error || "Nepavyko sugeneruoti pasiūlymų")
        }
        const data: DiGenerateResponse = await res.json()
        if (append) {
          setSuggestions((prev) => [...prev, ...data.suggestions])
          setSuggestionsSavedAt((at) => at ?? Date.now())
        } else {
          setSuggestions(data.suggestions)
          setSuggestionsSavedAt(Date.now())
          setRestoredSuggestions(null)
        }
        // Show success banner
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
        setGenerationSuccess(data.suggestions.length)
        successTimerRef.current = setTimeout(() => setGenerationSuccess(null), 3000)
      } catch (err) {
        setDiError(err instanceof Error ? err.message : "Nežinoma klaida")
      } finally {
        setDiLoading(false)
        // The request was counted (or refused) by now: the "liko N DI
        // užklausų" line reads the allowance again.
        notifyAiUsageChanged()
      }
    },
    [game.id, game.title, game.description, challenges, teacherPrompt, selectedScenario, session]
  )

  // Document import produces the same AiSuggestion shape as DI generation —
  // append them and reuse the success banner.
  function handleImported(imported: AiSuggestion[]) {
    if (imported.length === 0) return
    setSuggestions((prev) => [...prev, ...imported])
    setSuggestionsSavedAt((at) => at ?? Date.now())
    notifyAiUsageChanged()
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
      session.check(res)
      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(index))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(index)
          return next
        })
        return null
      }
      const errBody = (await res.json().catch(() => null)) as { error?: unknown } | null
      const msg = addFailureReason(res.status, errBody?.error)
      console.error("addSuggestion failed:", msg, { status: res.status, suggestion: suggestion.title })
      return msg
    } catch (err) {
      console.error("addSuggestion network error:", err)
      return addFailureReason(null)
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
    const failures: (AddFailure & { index: number })[] = []
    for (const i of toAdd) {
      const error = await addSuggestion(i)
      if (!error) count++
      else failures.push({ index: i, title: suggestions[i]?.title ?? "", reason: error })
    }
    // What failed stays selected, so "Pridėti" tries exactly those again.
    setSelectedIds(new Set(failures.map((f) => f.index)))
    if (failures.length === 0) {
      toast({ title: `Pridėta užduočių: ${count}` })
    } else {
      // Never a plain success when something was left out: say how many
      // were added, which were not and why.
      toast({
        title: count > 0 ? "Pridėtos ne visos užduotys" : "Nepavyko pridėti užduočių",
        description: `${partialAddSummary(count, failures.length)} ${failureLines(failures).join(" ")} Nepridėti pasiūlymai liko sąraše pažymėti, galite bandyti dar kartą.`,
        variant: "destructive",
      })
    }
    if (count > 0) refreshChallenges()
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

  // Brings the DI tab with the restored suggestions into view.
  function showRestoredSuggestions() {
    if (editingChallenge || isCreatingNew) {
      if (!confirmDiscard()) return
      handleEditorCancel()
    }
    setPreviewChallenge(null)
    setActiveTab("di")
    if (!isDesktop) setMobileSheetOpen(true)
    setRestoredSuggestions(null)
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
      if (session.check(res)) throw new Error(addFailureReason(401))
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
      if (session.check(res)) throw new Error(addFailureReason(401))
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

  // ========== Reorder (drag and the move buttons share this) ==========
  // Spoken to screen readers after a move made with the buttons.
  const [moveAnnouncement, setMoveAnnouncement] = useState("")

  async function saveOrder(reordered: Challenge[], previous: Challenge[]): Promise<boolean> {
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
      session.check(res)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return true
    } catch {
      setChallenges(previous)
      toast({
        title: "Nepavyko išsaugoti tvarkos",
        description: "Patikrinkite ryšį ir bandykite dar kartą.",
        variant: "destructive",
      })
      return false
    }
  }

  // The single-pointer alternative to dragging (WCAG 2.5.7): one step up or
  // down per press.
  async function handleMoveChallenge(challenge: Challenge, direction: -1 | 1) {
    if (live) return
    const index = challenges.findIndex((c) => c.id === challenge.id)
    const target = stepTarget(index, direction, challenges.length)
    if (target === null) return
    const saved = await saveOrder(arrayMove(challenges, index, target), challenges)
    setMoveAnnouncement(
      saved
        ? `Užduotis „${challenge.title}“ perkelta į ${target + 1} vietą iš ${challenges.length}.`
        : `Užduoties „${challenge.title}“ perkelti nepavyko.`
    )
  }

  // What a drag id means, for the screen reader announcements.
  function describeDragId(id: UniqueIdentifier): string | null {
    const key = String(id)
    if (key === "challenge-list-drop") return "užduočių sąrašas"
    if (key.startsWith("challenge-")) {
      const index = challenges.findIndex((c) => `challenge-${c.id}` === key)
      return index >= 0 ? `${index + 1} užduotis „${challenges[index].title}“` : null
    }
    if (key.startsWith("suggestion-")) {
      const suggestion = suggestions[parseInt(key.replace("suggestion-", ""), 10)]
      return suggestion ? `DI pasiūlymas „${suggestion.title}“` : null
    }
    return null
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

      await saveOrder(arrayMove(challenges, oldIdx, newIdx), challenges)
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
        aiTasksToReview={aiTasksToReview(challenges)}
        onOpenTask={(taskId) => {
          const task = challenges.find((c) => c.id === taskId)
          if (task) handleSelectChallenge(task)
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {session.expired && <SessionExpiredNotice className="mx-4 sm:mx-6 lg:mx-8 mt-4" />}

      {restoredSuggestions && suggestions.length > 0 && (
        <div
          role="status"
          className="mx-4 sm:mx-6 lg:mx-8 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm text-steam-dark"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-highlight-ink" aria-hidden="true" />
          <p className="min-w-0 flex-1 basis-64">
            <span className="font-semibold">Atkurti dar nepridėti DI pasiūlymai: {restoredSuggestions.count}.</span>{" "}
            Sugeneruoti{" "}
            {new Date(restoredSuggestions.savedAt).toLocaleString("lt-LT", {
              timeZone: "Europe/Vilnius",
              dateStyle: "medium",
              timeStyle: "short",
            })}
            , saugomi šioje naršyklėje 7 dienas. Naujos DI užklausos jiems nereikia.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={showRestoredSuggestions}>
              Rodyti pasiūlymus
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRestoredSuggestions(null)}>
              Gerai
            </Button>
          </div>
        </div>
      )}

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

      <p className="sr-only" role="status" aria-live="polite">
        {moveAnnouncement}
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          screenReaderInstructions: DND_INSTRUCTIONS_LT,
          announcements: dndAnnouncementsLt(describeDragId),
        }}
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
                onMove={handleMoveChallenge}
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
