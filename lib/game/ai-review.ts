// Which DI-made tasks the facilitator has not confirmed yet. Shared by the
// start dialog (client) and the status route (server), so both ask about the
// same tasks. No "use client": the route imports it too.

export type AiVerdict = "pass" | "fail" | "uncertain" | null

export interface AiReviewCandidate {
  id: string
  title: string
  generated_by_di?: boolean | null
  verification_verdict?: AiVerdict
  needs_answer?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  order_index?: number | null
}

export interface AiTaskToReview {
  id: string
  title: string
  verdict: AiVerdict
}

/**
 * A DI-made task counts as not reviewed by the facilitator when either
 * - it still carries the DI check's verdict (pass, uncertain or fail): saving
 *   the task in the editor clears the verdict (mark_reviewed, or a new
 *   answer), so a stored verdict means nobody has confirmed the answer, or
 * - it has no verdict and has never been changed since it was created
 *   (updated_at equals created_at): the DI check did not run and the task
 *   was added as generated.
 * Tasks flagged needs_answer are left out: they block the start on their own.
 * There is no per-task "reviewed" column; this uses only what is stored.
 */
export function isUnreviewedAiTask(task: AiReviewCandidate): boolean {
  if (!task.generated_by_di || task.needs_answer) return false
  if (task.verification_verdict) return true
  if (!task.created_at || !task.updated_at) return false
  const created = Date.parse(task.created_at)
  const updated = Date.parse(task.updated_at)
  return Number.isFinite(created) && created === updated
}

/** The tasks the start dialog lists, in activity order. */
export function aiTasksToReview(tasks: AiReviewCandidate[]): AiTaskToReview[] {
  return tasks
    .filter(isUnreviewedAiTask)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((t) => ({ id: t.id, title: t.title, verdict: t.verification_verdict ?? null }))
}

/** What the DI check said about the stored answer, for the facilitator. */
export function aiVerdictLabel(verdict: AiVerdict): string {
  if (verdict === "pass") return "DI patikra atsakymui pritarė"
  if (verdict === "uncertain") return "DI patikra atsakymu abejoja"
  if (verdict === "fail") return "DI patikra rado galimą klaidą"
  return "DI atsakymo nepatikrino"
}

export const AI_REVIEW_REQUIRED_MESSAGE =
  "Veikloje yra DI sukurtų užduočių, kurių atsakymų dar nepatvirtinote. Peržiūrėkite jas ir patvirtinkite prieš pradėdami veiklą."
