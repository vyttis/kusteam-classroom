import type { AiSuggestion } from "@/lib/ai/types"

// DI suggestions that were generated (and counted against the monthly
// allowance) but not yet added to the activity. Kept in this browser per
// activity, like the generated lesson plan draft (lesson-plan-generator),
// with the same 7-day expiry. The key starts with "ks-di-suggestions", so
// signing out removes it (clearLocalWork).
const PENDING_SUGGESTIONS_KEY = "ks-di-suggestions:v2"
export const PENDING_SUGGESTIONS_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const pendingSuggestionsKey = (gameId: string) => `${PENDING_SUGGESTIONS_KEY}:${gameId}`

export interface PendingSuggestions {
  /** When the oldest suggestion still waiting was generated. */
  savedAt: number
  suggestions: AiSuggestion[]
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">

/** The suggestions still waiting for this activity, or null (none, expired, unreadable). */
export function readPendingSuggestions(store: Store, key: string, now = Date.now()): PendingSuggestions | null {
  try {
    const raw = store.getItem(key)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<PendingSuggestions> | null
    const fresh = typeof saved?.savedAt === "number" && now - saved.savedAt < PENDING_SUGGESTIONS_TTL_MS
    if (!fresh || !Array.isArray(saved?.suggestions) || saved.suggestions.length === 0) {
      store.removeItem(key)
      return null
    }
    return { savedAt: saved.savedAt as number, suggestions: saved.suggestions }
  } catch {
    return null
  }
}

/**
 * Stores what is still waiting: suggestions already added to the activity
 * are left out, and when nothing waits the entry is removed.
 */
export function writePendingSuggestions(
  store: Store,
  key: string,
  suggestions: AiSuggestion[],
  addedIds: ReadonlySet<number>,
  savedAt: number,
) {
  try {
    const pending = suggestions.filter((_, i) => !addedIds.has(i))
    if (pending.length === 0) store.removeItem(key)
    else store.setItem(key, JSON.stringify({ savedAt, suggestions: pending } satisfies PendingSuggestions))
  } catch {
    // Storage full or blocked: the suggestions stay for this visit only.
  }
}
