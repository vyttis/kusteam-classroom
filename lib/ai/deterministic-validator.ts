import type { AiSuggestion, VerificationResult } from "./types"
import { canonicalNumber } from "@/lib/game/number-answer"
import { findHintLeaks, hintLeakIssue } from "./hint-leak"

/**
 * Attempts deterministic validation for task types that can be
 * verified without LLM. Returns null if it cannot validate
 * deterministically (fallback to LLM needed).
 */
export function validateDeterministic(
  suggestion: AiSuggestion
): VerificationResult | null {
  const issues: string[] = []

  // Rule 1: multiple_choice must have correct_answer in options
  if (suggestion.type === "multiple_choice") {
    if (!suggestion.options || suggestion.options.length < 2) {
      return {
        verdict: "fail",
        issues: ["Pasirinkimo užduotis turi turėti bent 2 variantus"],
        confidence: 1.0,
      }
    }
    const normalizedAnswer = suggestion.correct_answer.trim().toLowerCase()
    const normalizedOptions = suggestion.options.map((o) =>
      o.trim().toLowerCase()
    )
    if (!normalizedOptions.includes(normalizedAnswer)) {
      return {
        verdict: "fail",
        issues: [
          `Teisingo atsakymo „${suggestion.correct_answer}“ nėra tarp pateiktų variantų`,
        ],
        confidence: 1.0,
      }
    }
  }

  // Rule 2: number type — verify answer is numeric and try math eval
  if (suggestion.type === "number") {
    if (numberValue(suggestion.correct_answer) === null) {
      issues.push(
        `Skaičiaus užduoties atsakymas „${suggestion.correct_answer}“ nėra skaičius`
      )
      return { verdict: "fail", issues, confidence: 1.0 }
    }
  }

  // Rule 3: a hint must not give the answer away. Exact, so it does not wait
  // for (or depend on) the model check.
  const leaks = findHintLeaks(suggestion)
  if (leaks.length > 0) {
    return {
      verdict: "fail",
      issues: leaks.map(hintLeakIssue),
      confidence: leaks.every((l) => l.reason === "inflected") ? 0.8 : 1.0,
    }
  }

  if (suggestion.type === "number") {
    const parsed = numberValue(suggestion.correct_answer) as number
    // Try evaluating math expression from description
    const mathResult = tryEvaluateMathFromDescription(suggestion.description)
    if (mathResult !== null) {
      if (Math.abs(mathResult - parsed) > 0.001) {
        return {
          verdict: "fail",
          issues: [
            `Apskaičiuotas atsakymas (${mathResult}) nesutampa su pateiktu (${parsed})`,
          ],
          confidence: 0.95,
        }
      }
      return { verdict: "pass", issues: [], confidence: 0.95 }
    }
  }

  // Rule 4: basic sanity checks
  if (suggestion.title.trim().length < 3) {
    issues.push("Pavadinimas per trumpas")
  }
  if (suggestion.points < 50 || suggestion.points > 500) {
    issues.push(`Taškai (${suggestion.points}) turi būti nuo 50 iki 500`)
  }

  if (issues.length > 0) {
    return { verdict: "fail", issues, confidence: 0.9 }
  }

  // Cannot fully validate deterministically
  return null
}

/**
 * The value of a number answer as participants' answers are read (decimal
 * comma, spaces between thousands), or null when it is not a number.
 */
function numberValue(answer: string): number | null {
  const canonical = canonicalNumber(answer)
  return canonical === null ? null : Number(canonical)
}

/**
 * Conservative math evaluator for simple arithmetic.
 * Only handles single binary operations like "2 + 3", "15 * 7".
 * Returns null if cannot parse.
 */
function tryEvaluateMathFromDescription(description: string): number | null {
  const mathPattern = /(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)/g
  const matches = Array.from(description.matchAll(mathPattern))

  if (matches.length === 1) {
    const [, leftStr, op, rightStr] = matches[0]
    const left = parseFloat(leftStr)
    const right = parseFloat(rightStr)
    switch (op) {
      case "+":
        return left + right
      case "-":
        return left - right
      case "*":
        return left * right
      case "/":
        return right !== 0 ? left / right : null
    }
  }

  return null
}
