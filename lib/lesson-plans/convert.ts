import { MAX_ANSWER_LENGTH } from "@/lib/game/answer-hasher"
import { canonicalNumber } from "@/lib/game/number-answer"
import type { VerificationResult } from "@/lib/ai/types"
import { dropLeakingHints } from "@/lib/ai/hint-leak"

/** The stage fields conversion reads; old plans may miss some of them. */
export interface PlanStage {
  activity_type?: string | null
  title?: string | null
  description?: string | null
  type?: string | null
  correct_answer?: unknown
  options?: unknown
  hints?: unknown
  explanation?: string | null
  points?: unknown
  difficulty?: string | null
}

export { defaultTaskStageIndexes } from "@/lib/lesson-plans/stages"

export type TaskType = "text" | "number" | "multiple_choice"

export interface StageTask {
  title: string
  description: string
  type: TaskType
  points: number
  hints: string[]
  options: string[] | null
  explanation: string | null
  difficulty: "easy" | "medium" | "hard" | null
  /** The answer to hash, or null when the facilitator must set one. */
  answer: string | null
  /** Why the answer cannot be used as it is. Never contains the answer. */
  problem: string | null
  /** Hints removed because they gave the answer away. */
  droppedHints?: number
}

const fold = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase()

function cleanList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const text = item.trim()
    if (!text || seen.has(fold(text))) continue
    seen.add(fold(text))
    out.push(text)
    if (out.length === max) break
  }
  return out
}

/**
 * A plan stage as a task row. Fields are trimmed and brought into the ranges
 * the task editor accepts; an answer no participant could match (missing,
 * too long, not a number for a number task, not one of the choices) is left
 * out, so the builder marks the task and the activity cannot start until the
 * facilitator sets it.
 */
export function stageToTask(stage: PlanStage): StageTask {
  const type: TaskType =
    stage.type === "number" || stage.type === "multiple_choice" ? stage.type : "text"
  const rawPoints = typeof stage.points === "number" && Number.isFinite(stage.points) ? stage.points : 100
  const difficulty =
    stage.difficulty === "easy" || stage.difficulty === "medium" || stage.difficulty === "hard"
      ? stage.difficulty
      : null
  const options = type === "multiple_choice" ? cleanList(stage.options, 10) : null
  const explanation = (stage.explanation ?? "").trim()

  const task: StageTask = {
    title: (stage.title ?? "").trim().slice(0, 200) || "Užduotis",
    description: (stage.description ?? "").trim().slice(0, 5000),
    type,
    points: Math.min(1000, Math.max(1, Math.round(rawPoints))),
    hints: cleanList(stage.hints, 10),
    options,
    explanation: explanation ? explanation.slice(0, 5000) : null,
    difficulty,
    answer: null,
    problem: null,
  }

  const answer = typeof stage.correct_answer === "string" || typeof stage.correct_answer === "number"
    ? String(stage.correct_answer).trim()
    : ""

  if (!answer) return { ...task, problem: "Plane šiai užduočiai nėra atsakymo." }
  if (answer.length > MAX_ANSWER_LENGTH) {
    return { ...task, problem: `Atsakymas ilgesnis nei ${MAX_ANSWER_LENGTH} ženklų.` }
  }
  if (type === "number" && canonicalNumber(answer) === null) {
    return { ...task, problem: "Skaičiaus užduoties atsakymas nėra skaičius." }
  }
  if (type === "multiple_choice") {
    if (!options || options.length < 2) {
      return { ...task, problem: "Pasirinkimo užduočiai reikia bent dviejų variantų." }
    }
    // The stored answer takes the exact spelling of its choice.
    const match = options.find((o) => fold(o) === fold(answer))
    if (!match) return { ...task, problem: "Teisingo atsakymo nėra tarp variantų." }
    return withoutLeakingHints({ ...task, answer: match })
  }
  return withoutLeakingHints({ ...task, answer })
}

/**
 * Participants open hints one by one, so a hint that states the answer (the
 * word, the number, the right choice) is removed here and the task is marked
 * for the facilitator to look at.
 */
function withoutLeakingHints(task: StageTask): StageTask {
  if (task.answer === null) return task
  const { hints, dropped } = dropLeakingHints({
    type: task.type,
    correct_answer: task.answer,
    hints: task.hints,
    options: task.options,
    description: task.description,
  })
  return dropped > 0 ? { ...task, hints, droppedHints: dropped } : task
}

const DROPPED_HINT_NOTE = "Pašalinta užuomina, kuri atskleidė atsakymą. Peržiūrėkite likusias užuominas."

/**
 * Verification notes as stored on the task. Participants of a running
 * activity can read them, so a note that quotes the answer is replaced by a
 * plain request to check it, and the list stays short.
 */
export function safeIssues(issues: readonly string[], answer: string | null): string[] {
  const needle = answer ? fold(answer) : ""
  let hidden = false
  const out: string[] = []
  for (const issue of issues) {
    const text = issue.trim()
    if (!text) continue
    if (needle && fold(text).includes(needle)) {
      hidden = true
      continue
    }
    out.push(text.slice(0, 300))
  }
  if (hidden) out.unshift("DI abejoja atsakymu. Patikrinkite jį.")
  return out.slice(0, 5)
}

export interface TaskReview {
  /** Store the answer (false: the task needs one from the facilitator). */
  keepAnswer: boolean
  verdict: VerificationResult["verdict"]
  issues: string[]
  confidence: number | null
}

/**
 * Combines the structural check with the DI verdict. Only an answer no
 * participant could match is left out (the facilitator must set it before
 * the activity starts). A DI "fail" may be about the wording, the hints or
 * the choices as much as the answer, so the answer stays and the task is
 * marked for review together with an "uncertain" one.
 */
export function reviewTask(task: StageTask, verification: VerificationResult | null): TaskReview {
  if (task.answer === null) {
    return { keepAnswer: false, verdict: "fail", issues: [task.problem ?? "Trūksta atsakymo."], confidence: 1 }
  }
  const droppedNote = task.droppedHints ? [DROPPED_HINT_NOTE] : []
  if (!verification) {
    return {
      keepAnswer: true,
      verdict: "uncertain",
      issues: ["DI patikra neatlikta.", ...droppedNote],
      confidence: null,
    }
  }
  const issues = [...droppedNote, ...safeIssues(verification.issues, task.answer)].slice(0, 5)
  if (verification.verdict === "fail" && issues.length === 0) issues.push("DI patikra rado galimą klaidą.")
  // A removed hint is worth a look even when the answer itself checks out.
  const verdict = task.droppedHints && verification.verdict === "pass" ? "uncertain" : verification.verdict
  return { keepAnswer: true, verdict, issues, confidence: verification.confidence }
}
