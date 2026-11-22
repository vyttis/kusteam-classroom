// Wording for adding several tasks at once (a generated lesson, selected DI
// suggestions): some can fail while others are saved, and the facilitator
// must see exactly which ones and why.

export interface AddFailure {
  title: string
  reason: string
}

export const SESSION_ENDED_REASON = "Sesija baigėsi."
export const NETWORK_REASON = "Nepavyko pasiekti serverio. Patikrinkite interneto ryšį."

/**
 * Why one task was not added. `status` is the HTTP status, or null when the
 * request never got an answer. The server's own message is in Lithuanian and
 * is shown as it is.
 */
export function addFailureReason(status: number | null, serverError?: unknown): string {
  if (status === null) return NETWORK_REASON
  if (status === 401) return SESSION_ENDED_REASON
  if (typeof serverError === "string" && serverError.trim()) return serverError.trim()
  return `Serverio klaida (${status}).`
}

/** "Pridėta užduočių: 2. Nepridėta: 1." */
export function partialAddSummary(added: number, failed: number): string {
  return `Pridėta užduočių: ${added}. Nepridėta: ${failed}.`
}

/** One line per failed task: „Pavadinimas“: priežastis */
export function failureLines(failures: AddFailure[]): string[] {
  return failures.map((f) => `„${f.title}“: ${f.reason}`)
}
