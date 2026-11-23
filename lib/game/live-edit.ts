/**
 * While an activity runs (or is paused), participants see its tasks as they
 * are. Removing a task takes its answers away while team points stay,
 * reordering moves teams in linear mode, and a task without an answer cannot
 * be solved. Those changes wait until the activity has ended.
 */
export function isLiveStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "paused"
}

export const LIVE_EDIT_BLOCKED = {
  delete: "Vykstančios veiklos užduočių negalima ištrinti. Tai galėsite padaryti, kai veikla baigsis.",
  reorder: "Vykstančios veiklos užduočių tvarkos keisti negalima.",
  needsAnswer: "Vykstančiai veiklai negalima pridėti užduoties be atsakymo. Įrašykite teisingą atsakymą.",
  prerequisites: "Vykstančios veiklos užduočių atrakinimo sąlygų keisti negalima.",
  finishedWithAnswers:
    "Šios užduoties atsakymai yra baigtos veiklos ataskaitoje, todėl jos ištrinti negalima. Norėdami keisti užduotis, nukopijuokite veiklą.",
} as const

/** Two prerequisite lists name the same tasks (order does not matter). */
export function samePrerequisites(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const left = new Set(a ?? [])
  const right = new Set(b ?? [])
  if (left.size !== right.size) return false
  for (const id of left) if (!right.has(id)) return false
  return true
}

/**
 * Said to the facilitator when a change to how a task is scored is saved
 * while the activity runs and the task already has answers: those answers
 * are not checked again and no points are recalculated.
 */
export const LIVE_SCORING_NOTICE =
  "Veikla vyksta, o į šią užduotį jau atsakyta. Jau pateikti atsakymai iš naujo nevertinami: komandų taškai ir išspręstos užduotys lieka tokie, kokie buvo. Pakeitimas galioja tik naujiems atsakymams."

/**
 * Whether a saved change alters how answers to the task are scored: a new
 * correct answer or other accepted answers, another type, or other points
 * or hint penalty than the stored ones. The editor sends points and the
 * penalty on every save, so only an actual difference counts.
 */
export function changesScoring(
  change: {
    correct_answer?: string
    accepted_answers?: readonly string[]
    type?: string
    points?: number
    hint_penalty?: number
  },
  stored: { type: string | null; points: number | null; hint_penalty: number | null }
): boolean {
  if (change.correct_answer !== undefined || change.accepted_answers !== undefined) return true
  if (change.type !== undefined && change.type !== stored.type) return true
  if (change.points !== undefined && change.points !== stored.points) return true
  if (change.hint_penalty !== undefined && change.hint_penalty !== (stored.hint_penalty ?? 0)) return true
  return false
}
