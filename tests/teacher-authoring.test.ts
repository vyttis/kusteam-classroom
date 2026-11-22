import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  AI_REVIEW_REQUIRED_MESSAGE,
  aiTasksToReview,
  aiVerdictLabel,
  isUnreviewedAiTask,
} from "@/components/teacher/ai-review"
import {
  NETWORK_REASON,
  SESSION_ENDED_REASON,
  addFailureReason,
  failureLines,
  partialAddSummary,
} from "@/components/teacher/task-add-result"
import {
  PENDING_SUGGESTIONS_TTL_MS,
  pendingSuggestionsKey,
  readPendingSuggestions,
  writePendingSuggestions,
} from "@/components/teacher/game-builder/pending-suggestions"
import { DND_INSTRUCTIONS_LT, dndAnnouncementsLt, stepTarget } from "@/components/teacher/game-builder/dnd-a11y"
import { SIGN_IN_PATH, isSessionExpired } from "@/hooks/use-session-expired"
import type { AiSuggestion } from "@/lib/ai/types"

const read = (path: string) => readFileSync(path, "utf8")

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

const T0 = "2026-11-20T10:00:00.000Z"
const T1 = "2026-11-20T10:05:00.000Z"
const task = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  title: "Tiltas",
  generated_by_di: true,
  verification_verdict: null as "pass" | "fail" | "uncertain" | null,
  needs_answer: false,
  created_at: T0,
  updated_at: T0,
  order_index: 0,
  ...over,
})

describe("isUnreviewedAiTask", () => {
  it("never asks about tasks the facilitator wrote", () => {
    expect(isUnreviewedAiTask(task({ generated_by_di: false, verification_verdict: "fail" }))).toBe(false)
  })

  it.each(["pass", "uncertain", "fail"] as const)("asks while the DI verdict %s is still stored", (verdict) => {
    // Saving the task in the editor clears the verdict, so a stored one
    // means nobody confirmed the answer, even after a reorder touched the row.
    expect(isUnreviewedAiTask(task({ verification_verdict: verdict, updated_at: T1 }))).toBe(true)
  })

  it("asks about an unchecked DI task that was never changed", () => {
    expect(isUnreviewedAiTask(task())).toBe(true)
    // The same moment written with another offset is still the same moment.
    expect(isUnreviewedAiTask(task({ updated_at: "2026-11-20T12:00:00+02:00" }))).toBe(true)
  })

  it("accepts a DI task saved by the facilitator (verdict cleared, row changed)", () => {
    expect(isUnreviewedAiTask(task({ updated_at: T1 }))).toBe(false)
  })

  it("leaves tasks without an answer to the needs_answer block", () => {
    expect(isUnreviewedAiTask(task({ needs_answer: true, verification_verdict: "fail" }))).toBe(false)
  })

  it("does not guess when the times are missing", () => {
    expect(isUnreviewedAiTask(task({ created_at: null, updated_at: null }))).toBe(false)
  })
})

describe("aiTasksToReview", () => {
  it("lists only unreviewed DI tasks, in activity order, with their verdict", () => {
    const list = aiTasksToReview([
      task({ id: "c", title: "C", order_index: 2, verification_verdict: "uncertain" }),
      task({ id: "a", title: "A", order_index: 0, generated_by_di: false }),
      task({ id: "b", title: "B", order_index: 1, verification_verdict: "pass" }),
      task({ id: "d", title: "D", order_index: 3, updated_at: T1 }),
    ])
    expect(list).toEqual([
      { id: "b", title: "B", verdict: "pass" },
      { id: "c", title: "C", verdict: "uncertain" },
    ])
  })

  it("names every verdict in Lithuanian", () => {
    expect(aiVerdictLabel("pass")).toBe("DI patikra atsakymui pritarė")
    expect(aiVerdictLabel("uncertain")).toBe("DI patikra atsakymu abejoja")
    expect(aiVerdictLabel("fail")).toBe("DI patikra rado galimą klaidą")
    expect(aiVerdictLabel(null)).toBe("DI atsakymo nepatikrino")
  })
})

describe("start of an activity with DI tasks", () => {
  const route = read("app/api/games/[gameId]/route.ts")
  const dialog = read("components/teacher/game-status-actions.tsx")

  it("is refused by the server without the acknowledgement", () => {
    expect(route).toContain("ai_reviewed: z.boolean().optional()")
    expect(route).toContain("parsed.data.ai_reviewed !== true")
    expect(route).toContain('code: "ai_review_required"')
    expect(route).toContain("AI_REVIEW_REQUIRED_MESSAGE")
    expect(AI_REVIEW_REQUIRED_MESSAGE).not.toContain("—")
  })

  it("is enabled in the dialog only after the checkbox", () => {
    expect(dialog).toContain("(needsAiReview && !aiReviewed)")
    expect(dialog).toContain("ai_reviewed: true")
    expect(dialog).toContain("Peržiūrėjau šių užduočių atsakymus ir patvirtinu, kad jie teisingi")
  })

  it("counts a save in the editor as the review of any DI verdict", () => {
    const editor = read("components/teacher/game-builder/manual-task-editor.tsx")
    expect(editor).toContain(
      "if (challenge.generated_by_di && challenge.verification_verdict !== null) payload.mark_reviewed = true"
    )
  })
})

describe("adding several tasks", () => {
  it("explains why a task was not added", () => {
    expect(addFailureReason(null)).toBe(NETWORK_REASON)
    expect(addFailureReason(401, "Neautorizuota")).toBe(SESSION_ENDED_REASON)
    expect(addFailureReason(400, "Pavadinimas per trumpas")).toBe("Pavadinimas per trumpas")
    expect(addFailureReason(500, { code: "x" })).toBe("Serverio klaida (500).")
    expect(addFailureReason(500, "  ")).toBe("Serverio klaida (500).")
  })

  it("words a partial result", () => {
    expect(partialAddSummary(2, 1)).toBe("Pridėta užduočių: 2. Nepridėta: 1.")
    expect(failureLines([{ title: "Tiltas", reason: NETWORK_REASON }])).toEqual([`„Tiltas“: ${NETWORK_REASON}`])
  })

  it("keeps the lesson generator on the page when a task failed", () => {
    const source = read("components/teacher/lesson-generator.tsx")
    // Navigation happens only inside the branch where nothing failed.
    const success = source.indexOf("if (failed.length === 0) {")
    const push = source.indexOf("router.push(`/games/${gameId}/builder`)")
    const stay = source.indexOf("setActivities(failed.map((f) => f.activity))")
    expect(success).toBeGreaterThan(-1)
    expect(push).toBeGreaterThan(success)
    expect(stay).toBeGreaterThan(push)
    expect(source.match(/router\.push\(/g)).toHaveLength(1)
    expect(source).toContain('useLeaveWarning(loading || (phase !== "input" && activities.length > 0))')
  })

  it("never reports a partial bulk add as a plain success", () => {
    const source = read("components/teacher/game-builder/game-builder.tsx")
    expect(source).toContain('count > 0 ? "Pridėtos ne visos užduotys" : "Nepavyko pridėti užduočių"')
    expect(source).toContain("setSelectedIds(new Set(failures.map((f) => f.index)))")
  })
})

describe("pending DI suggestions", () => {
  const suggestion = (title: string) => ({ title }) as unknown as AiSuggestion
  function memoryStore() {
    const data = new Map<string, string>()
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
  }
  const key = pendingSuggestionsKey("game-1")
  const NOW = Date.parse("2026-11-22T12:00:00Z")

  it("uses a key that signing out clears, one per activity", () => {
    expect(key.startsWith("ks-di-suggestions")).toBe(true)
    expect(pendingSuggestionsKey("game-2")).not.toBe(key)
    expect(read("hooks/use-leave-warning.ts")).toContain('key.startsWith("ks-di-suggestions")')
  })

  it("keeps only what was not added and restores it", () => {
    const store = memoryStore()
    writePendingSuggestions(store, key, [suggestion("A"), suggestion("B"), suggestion("C")], new Set([1]), NOW)
    expect(readPendingSuggestions(store, key, NOW + 1000)).toEqual({
      savedAt: NOW,
      suggestions: [{ title: "A" }, { title: "C" }],
    })
  })

  it("removes the entry once everything is added or dismissed", () => {
    const store = memoryStore()
    writePendingSuggestions(store, key, [suggestion("A")], new Set(), NOW)
    expect(store.data.has(key)).toBe(true)
    writePendingSuggestions(store, key, [suggestion("A")], new Set([0]), NOW)
    expect(store.data.has(key)).toBe(false)
    writePendingSuggestions(store, key, [suggestion("A")], new Set(), NOW)
    writePendingSuggestions(store, key, [], new Set(), NOW)
    expect(store.data.has(key)).toBe(false)
  })

  it("expires after 7 days, like the lesson plan draft", () => {
    expect(PENDING_SUGGESTIONS_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
    expect(read("components/teacher/lesson-plan-generator.tsx")).toContain(
      "const PLAN_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000"
    )
    const store = memoryStore()
    writePendingSuggestions(store, key, [suggestion("A")], new Set(), NOW)
    expect(readPendingSuggestions(store, key, NOW + PENDING_SUGGESTIONS_TTL_MS - 1)).not.toBeNull()
    expect(readPendingSuggestions(store, key, NOW + PENDING_SUGGESTIONS_TTL_MS)).toBeNull()
    expect(store.data.has(key)).toBe(false)
  })

  it("survives unreadable or blocked storage", () => {
    const store = memoryStore()
    store.data.set(key, "{not json")
    expect(readPendingSuggestions(store, key, NOW)).toBeNull()
    const blocked = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {
        throw new Error("blocked")
      },
    }
    expect(readPendingSuggestions(blocked, key, NOW)).toBeNull()
    expect(() => writePendingSuggestions(blocked, key, [suggestion("A")], new Set(), NOW)).not.toThrow()
  })

  it("refreshes the quota line when a generation finishes", () => {
    expect(read("components/teacher/game-builder/game-builder.tsx")).toMatch(
      /finally \{\s*setDiLoading\(false\)[\s\S]{0,200}notifyAiUsageChanged\(\)/
    )
    expect(read("components/teacher/ai-quota-note.tsx")).toContain(
      "window.addEventListener(USAGE_CHANGED_EVENT, onUsageChanged)"
    )
  })
})

describe("session ended mid-work", () => {
  it("recognises only 401", () => {
    expect(isSessionExpired({ status: 401 })).toBe(true)
    expect(isSessionExpired({ status: 403 })).toBe(false)
    expect(isSessionExpired({ status: 200 })).toBe(false)
  })

  it("opens the sign-in page in a new tab, so the form is kept", () => {
    const notice = read("components/teacher/session-expired-notice.tsx")
    expect(SIGN_IN_PATH).toBe("/vedejui")
    expect(notice).toContain('<a href={SIGN_IN_PATH} target="_blank" rel="noopener">')
    expect(notice).toContain("jūsų tekstas liko šiame lange")
    expect(notice).not.toContain("—")
  })

  it.each([
    "components/teacher/game-builder/game-builder.tsx",
    "components/teacher/game-builder/manual-task-editor.tsx",
    "components/teacher/lesson-plan-detail.tsx",
    "components/teacher/lesson-plan-generator.tsx",
    "components/teacher/lesson-generator.tsx",
  ])("%s passes its saves through the shared helper", (path) => {
    const source = read(path)
    expect(source).toContain("useSessionExpired()")
    expect(source).toContain("session.check(")
    expect(source).toContain("<SessionExpiredNotice")
  })
})

describe("lesson plan editing", () => {
  it("warns before leaving with unsaved edits", () => {
    const source = read("components/teacher/lesson-plan-detail.tsx")
    expect(source).toContain("useLeaveWarning(dirty)")
    expect(source).toContain("draftContent(draft) !== draftBaseline")
    expect(source).toContain("Plano pakeitimai neišsaugoti. Atmesti juos?")
  })
})

describe("copying an activity", () => {
  const route = read("app/api/games/[gameId]/duplicate/route.ts")

  it("never sends a database message to the browser", () => {
    // Zod's own (Lithuanian) validation message is the only one passed on.
    expect(route).not.toMatch(/Error\??\.message/)
    expect(route).not.toMatch(/(?<!parsed\.)error\.message/)
  })

  it("marks a partial copy and the dialog shows it instead of success", () => {
    expect(route).toContain("partial: true")
    const dialog = read("components/teacher/game-duplicate-dialog.tsx")
    expect(dialog).toContain("res.status === 207 || data.partial")
    expect(dialog).toContain("Veikla nukopijuota ne visa")
  })

  it("is called „kopijuoti“ everywhere in the facilitator interface", () => {
    const files = [...filesUnder("components/teacher"), ...filesUnder("app/(teacher)"), "app/api/games/[gameId]/duplicate/route.ts"]
    for (const file of files) {
      expect(read(file), file).not.toMatch(/dubliuo|Dubliuo/)
    }
    expect(read("components/teacher/game-status-actions.tsx")).toContain("Pradėti veiklą")
  })
})

describe("deleting an activity", () => {
  it("is offered for finished activities with a plain warning", () => {
    expect(read("components/teacher/game-card.tsx")).toContain("const canDelete = isDraft || isFinished")
    expect(read("components/teacher/game-detail-client.tsx")).toContain("finished={isFinished}")
    const dialog = read("components/teacher/game-delete-dialog.tsx")
    expect(dialog).toContain("visam laikui bus ištrintos užduotys, visos komandos, jų atsakymai, rezultatai ir refleksijos")
    expect(dialog).toContain("Eksportuoti CSV")
    expect(dialog).toContain("disabled={deleting || (finished && !understood)}")
  })

  it("does not leak a database message", () => {
    expect(read("app/api/games/[gameId]/route.ts")).not.toMatch(/error: error\.message/)
  })
})

describe("builder drag and drop accessibility", () => {
  const describeId = (id: string | number) =>
    id === "challenge-1" ? "1 užduotis „Tiltas“" : id === "challenge-list-drop" ? "užduočių sąrašas" : null
  const announce = dndAnnouncementsLt(describeId)
  const arg = (active: string, over: string | null) =>
    ({ active: { id: active }, over: over ? { id: over } : null }) as unknown as Parameters<typeof announce.onDragEnd>[0]

  it("speaks Lithuanian", () => {
    expect(DND_INSTRUCTIONS_LT.draggable).toContain("tarpo klavišą")
    expect(announce.onDragStart(arg("challenge-1", null))).toBe("Paimta: 1 užduotis „Tiltas“.")
    expect(announce.onDragOver(arg("challenge-1", "challenge-list-drop"))).toBe(
      "1 užduotis „Tiltas“ dabar virš: užduočių sąrašas."
    )
    expect(announce.onDragEnd(arg("challenge-1", null))).toBe("Padėta: 1 užduotis „Tiltas“. Vieta nepasikeitė.")
    expect(announce.onDragCancel(arg("challenge-1", null))).toBe(
      "Perkėlimas atšauktas: 1 užduotis „Tiltas“ liko savo vietoje."
    )
  })

  it("says nothing about items it does not know", () => {
    expect(announce.onDragStart(arg("other", null))).toBeUndefined()
  })

  it("moves one step and stops at the edges", () => {
    expect(stepTarget(0, -1, 3)).toBeNull()
    expect(stepTarget(2, 1, 3)).toBeNull()
    expect(stepTarget(1, -1, 3)).toBe(0)
    expect(stepTarget(1, 1, 3)).toBe(2)
    expect(stepTarget(-1, 1, 3)).toBeNull()
  })

  it("gives the handles a name, focus visibility and move buttons", () => {
    const handle = read("components/teacher/game-builder/draggable-suggestion-card.tsx")
    expect(handle).toContain("aria-label={`Vilkti pasiūlymą „${suggestion.title}“ į užduočių sąrašą`}")
    expect(handle).toContain("focus-visible:opacity-100")
    const card = read("components/teacher/game-builder/sortable-task-card.tsx")
    expect(card).toContain("aria-label={`Perkelti „${challenge.title}“ aukštyn`}")
    expect(card).toContain("aria-label={`Perkelti „${challenge.title}“ žemyn`}")
    const builder = read("components/teacher/game-builder/game-builder.tsx")
    expect(builder).toContain("screenReaderInstructions: DND_INSTRUCTIONS_LT")
    // Drag and the buttons save through the same call.
    expect(builder.match(/"\/api\/challenges\/reorder"/g)).toHaveLength(1)
  })
})
