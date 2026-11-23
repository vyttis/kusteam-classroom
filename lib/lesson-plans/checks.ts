import { findHintLeaks, hintLeakIssue } from "@/lib/ai/hint-leak"

/**
 * Rule-based checks of a generated lesson plan, the same kind DI task
 * suggestions get (lib/ai/deterministic-validator.ts). They only produce
 * notes for the facilitator: the plan itself is never rewritten here. A hint
 * that gives the answer away is removed later, when the plan becomes an
 * activity (lib/lesson-plans/convert.ts).
 */

/** The stage fields the checks read; plans restored from a draft may miss some. */
export interface CheckedStage {
  title?: string | null
  description?: string | null
  type?: string | null
  correct_answer?: unknown
  options?: unknown
  hints?: unknown
  duration_minutes?: unknown
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []

/**
 * A note when the stage minutes do not add up to the lesson, or null. The
 * prompt asks for an exact sum, so any difference is worth the facilitator's
 * look: a shorter plan leaves the class idle, a longer one does not fit.
 */
export function stageMinutesWarning(stages: readonly CheckedStage[], lessonMinutes: number): string | null {
  if (!Number.isFinite(lessonMinutes) || lessonMinutes <= 0 || stages.length === 0) return null
  const total = stages.reduce((sum, stage) => {
    const minutes = typeof stage.duration_minutes === "number" ? stage.duration_minutes : Number.NaN
    return Number.isFinite(minutes) && minutes > 0 ? sum + minutes : sum
  }, 0)
  if (Math.round(total) === Math.round(lessonMinutes)) return null
  return `Etapų trukmė (${Math.round(total)} min.) nesutampa su pamokos trukme (${Math.round(lessonMinutes)} min.). Pakoreguokite etapų laiką.`
}

/**
 * Notes about hints that give a stage's answer away. They name the stage by
 * its number and never quote the answer.
 */
export function stageHintWarnings(stages: readonly CheckedStage[]): string[] {
  const warnings: string[] = []
  stages.forEach((stage, index) => {
    const answer =
      typeof stage.correct_answer === "string" || typeof stage.correct_answer === "number"
        ? String(stage.correct_answer).trim()
        : ""
    const hints = strings(stage.hints)
    if (!answer || hints.length === 0) return
    const leaks = findHintLeaks({
      type: typeof stage.type === "string" ? stage.type : "text",
      correct_answer: answer,
      hints,
      options: Array.isArray(stage.options) ? strings(stage.options) : null,
      description: stage.description ?? null,
    })
    for (const leak of leaks) warnings.push(`${index + 1} etapas. ${hintLeakIssue(leak)}`)
  })
  return warnings
}

/** Everything the facilitator should look at before saving the plan. */
export function lessonPlanWarnings(stages: readonly CheckedStage[], lessonMinutes: number): string[] {
  const minutes = stageMinutesWarning(stages, lessonMinutes)
  return [...(minutes ? [minutes] : []), ...stageHintWarnings(stages)]
}
