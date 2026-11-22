import { acceptedAnswerKey, normalizeAnswer, normalizeAnswerLegacy } from "@/lib/game/answer-hasher"

// What the wrong answers of a task tell the facilitator. Server only: the
// rows come from submissions.answer, which no browser role can read, and the
// result goes to the owner of the activity alone (see the analytics route
// and the report page). Never import this from a participant route.

/** Longest wrong answer shown; the rest is cut with an ellipsis. */
export const WRONG_ANSWER_MAX_LENGTH = 80
/** How many wrong answers a task lists. */
export const WRONG_ANSWER_LIMIT = 3

export interface WrongAnswer {
  /** The most frequent spelling of the answer, cleaned and capped. */
  text: string
  /** Teams that gave it at least once. */
  teams: number
  /** Times it was given (a team may repeat it). */
  attempts: number
}

export interface ChoiceStat {
  option: string
  /** Teams that picked the option at least once. */
  teams: number
  /** The option was accepted as the right answer for some team. */
  correct: boolean
}

export interface AnswerRow {
  team_id: string
  answer: string | null
  is_correct: boolean
}

/**
 * The form two answers are the same by: what the answer checker compares
 * (text folded and without trailing punctuation, a number by its value).
 * A number task answered with something that is not a number is grouped as
 * text.
 */
export function wrongAnswerKey(answer: string, type: string | null | undefined): string {
  if (type === "number") return acceptedAnswerKey(answer, "number") ?? normalizeAnswer(answer)
  return acceptedAnswerKey(answer, "text") ?? ""
}

/** A typed answer made safe to show in a table cell: one line, no control characters, capped. */
export function displayAnswer(answer: string): string {
  const oneLine = answer
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const chars = Array.from(oneLine)
  if (chars.length <= WRONG_ANSWER_MAX_LENGTH) return oneLine
  return `${chars.slice(0, WRONG_ANSWER_MAX_LENGTH - 1).join("").trimEnd()}…`
}

/**
 * The most common wrong answers of a typed (text or number) task, by how
 * many teams gave them. Other task types return nothing: a choice task is
 * described by choiceDistribution.
 */
export function groupWrongAnswers(
  rows: readonly AnswerRow[],
  type: string | null | undefined,
  limit = WRONG_ANSWER_LIMIT,
): WrongAnswer[] {
  if (type !== "text" && type !== "number") return []
  const groups = new Map<string, { teams: Set<string>; attempts: number; spellings: Map<string, number> }>()
  for (const row of rows) {
    if (row.is_correct || typeof row.answer !== "string") continue
    const key = wrongAnswerKey(row.answer, type)
    const shown = displayAnswer(row.answer)
    if (!key || !shown) continue
    let group = groups.get(key)
    if (!group) {
      group = { teams: new Set(), attempts: 0, spellings: new Map() }
      groups.set(key, group)
    }
    group.teams.add(row.team_id)
    group.attempts += 1
    group.spellings.set(shown, (group.spellings.get(shown) ?? 0) + 1)
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      // The most frequent spelling; of equally frequent ones, the first given.
      let text = ""
      let best = 0
      for (const [spelling, count] of group.spellings) {
        if (count > best) {
          text = spelling
          best = count
        }
      }
      return { key, text, teams: group.teams.size, attempts: group.attempts }
    })
    .sort((a, b) => b.teams - a.teams || b.attempts - a.attempts || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, limit)
    .map(({ text, teams, attempts }) => ({ text, teams, attempts }))
}

/** How many teams picked each option of a multiple-choice task, in the order of the options. */
export function choiceDistribution(
  rows: readonly AnswerRow[],
  options: readonly string[] | null | undefined,
): ChoiceStat[] {
  if (!options || options.length === 0) return []
  const picked = new Map<string, { teams: Set<string>; correct: boolean }>()
  for (const row of rows) {
    if (typeof row.answer !== "string") continue
    const key = normalizeAnswerLegacy(row.answer)
    let entry = picked.get(key)
    if (!entry) {
      entry = { teams: new Set(), correct: false }
      picked.set(key, entry)
    }
    entry.teams.add(row.team_id)
    if (row.is_correct) entry.correct = true
  }
  return options.map((option) => {
    const entry = picked.get(normalizeAnswerLegacy(option))
    return { option: displayAnswer(option), teams: entry?.teams.size ?? 0, correct: entry?.correct ?? false }
  })
}
