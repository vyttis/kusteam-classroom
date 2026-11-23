import type { AiSuggestion } from "@/lib/ai/types"
import { MAX_ACCEPTED_ANSWERS, MAX_ANSWER_LENGTH } from "@/lib/game/answer-hasher"

/**
 * Other spellings the DI proposed for a text answer, within the limits of
 * POST /api/challenges (acceptedAnswersSchema). Only text tasks have them:
 * a choice task's answer is one of its options, and a number task is
 * compared by value. The facilitator sees them on the suggestion card and
 * confirms them by adding the task, like the answer itself.
 */
export function proposedAcceptedAnswers(suggestion: Pick<AiSuggestion, "type" | "accepted_answers">): string[] {
  if (suggestion.type !== "text" || !Array.isArray(suggestion.accepted_answers)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of suggestion.accepted_answers) {
    if (typeof raw !== "string") continue
    const answer = raw.trim()
    const key = answer.toLowerCase()
    if (!answer || answer.length > MAX_ANSWER_LENGTH || seen.has(key)) continue
    seen.add(key)
    out.push(answer)
    if (out.length === MAX_ACCEPTED_ANSWERS) break
  }
  return out
}

/** The body of POST /api/challenges for a DI suggestion the facilitator accepts as it is. */
export function suggestionToChallengePayload(gameId: string, suggestion: AiSuggestion) {
  return {
    game_id: gameId,
    title: suggestion.title,
    description: suggestion.description || "",
    type: suggestion.type,
    points: Number(suggestion.points) || 100,
    correct_answer: String(suggestion.correct_answer),
    accepted_answers: proposedAcceptedAnswers(suggestion),
    hints: (suggestion.hints || []).slice(0, 10),
    options: suggestion.type === "multiple_choice" ? suggestion.options : null,
    explanation: suggestion.explanation || null,
    difficulty: suggestion.difficulty || null,
    generated_by_di: true,
    verification_verdict: suggestion.verification?.verdict ?? null,
    verification_issues: suggestion.verification?.issues ?? [],
    verification_confidence: suggestion.verification?.confidence ?? null,
  }
}
