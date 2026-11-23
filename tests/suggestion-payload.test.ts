import { describe, expect, it } from "vitest"
import {
  proposedAcceptedAnswers,
  suggestionToChallengePayload,
} from "@/components/teacher/game-builder/suggestion-payload"
import { acceptedAnswersSchema } from "@/lib/game/accepted-answers"
import { MAX_ACCEPTED_ANSWERS, MAX_ANSWER_LENGTH } from "@/lib/game/answer-hasher"
import { aiSuggestionSchema } from "@/lib/ai/schemas"
import type { AiSuggestion } from "@/lib/ai/types"

const suggestion = (overrides: Partial<AiSuggestion> = {}): AiSuggestion => ({
  title: "Lietuvos sostinė",
  description: "Koks miestas yra Lietuvos sostinė? Atsakymą rašyk vienu žodžiu.",
  type: "text",
  points: 100,
  correct_answer: "Vilnius",
  accepted_answers: ["Vilniaus miestas", "Vilnius miestas"],
  hints: ["Jis stovi prie Neries."],
  options: null,
  ...overrides,
})

describe("proposedAcceptedAnswers", () => {
  it("keeps the spellings the DI proposed for a text task", () => {
    expect(proposedAcceptedAnswers(suggestion())).toEqual(["Vilniaus miestas", "Vilnius miestas"])
  })

  it("has none for number and choice tasks, or when the DI proposed none", () => {
    expect(proposedAcceptedAnswers(suggestion({ type: "number", correct_answer: "7", accepted_answers: ["septyni"] }))).toEqual([])
    expect(
      proposedAcceptedAnswers(
        suggestion({ type: "multiple_choice", options: ["Vilnius", "Kaunas"], accepted_answers: ["Vilniaus miestas"] }),
      ),
    ).toEqual([])
    expect(proposedAcceptedAnswers(suggestion({ accepted_answers: undefined }))).toEqual([])
  })

  it("stays within what POST /api/challenges accepts", () => {
    const many = [" Vilnius miestas ", "vilnius miestas", "", "x".repeat(MAX_ANSWER_LENGTH + 1), "a", "b", "c", "d", "e", "f"]
    const kept = proposedAcceptedAnswers(suggestion({ accepted_answers: many }))
    expect(kept).toHaveLength(MAX_ACCEPTED_ANSWERS)
    expect(kept[0]).toBe("Vilnius miestas")
    expect(kept).not.toContain("vilnius miestas")
    expect(acceptedAnswersSchema.safeParse(kept).success).toBe(true)
  })

  it("survives a suggestion restored from the browser with a malformed list", () => {
    const restored = suggestion({ accepted_answers: [5, null, "Vilniaus miestas"] as unknown as string[] })
    expect(proposedAcceptedAnswers(restored)).toEqual(["Vilniaus miestas"])
    expect(proposedAcceptedAnswers(suggestion({ accepted_answers: "Vilnius" as unknown as string[] }))).toEqual([])
  })
})

describe("suggestionToChallengePayload", () => {
  it("passes the proposed spellings on as accepted_answers", () => {
    const payload = suggestionToChallengePayload("game-1", suggestion())
    expect(payload.accepted_answers).toEqual(["Vilniaus miestas", "Vilnius miestas"])
    expect(payload).toMatchObject({
      game_id: "game-1",
      title: "Lietuvos sostinė",
      type: "text",
      points: 100,
      correct_answer: "Vilnius",
      options: null,
      generated_by_di: true,
      verification_verdict: null,
      verification_issues: [],
    })
  })

  it("carries what the model sent through the response schema", () => {
    const parsed = aiSuggestionSchema.parse({
      title: "Vandens formulė",
      description: "Kokia vandens cheminė formulė?",
      type: "text",
      points: 100,
      correct_answer: "H2O",
      accepted_answers: ["H₂O", "  ", 7],
      hints: [],
    })
    expect(suggestionToChallengePayload("g", parsed as AiSuggestion).accepted_answers).toEqual(["H₂O"])
  })

  it("sends an empty list for a choice task and keeps its options", () => {
    const payload = suggestionToChallengePayload(
      "g",
      suggestion({ type: "multiple_choice", options: ["Vilnius", "Kaunas"], accepted_answers: ["Vilniaus miestas"] }),
    )
    expect(payload.accepted_answers).toEqual([])
    expect(payload.options).toEqual(["Vilnius", "Kaunas"])
  })

  it("the builder uses it when a suggestion is added, and the card shows the spellings", async () => {
    const { readFileSync } = await import("node:fs")
    const builder = readFileSync("components/teacher/game-builder/game-builder.tsx", "utf8")
    expect(builder).toContain("JSON.stringify(suggestionToChallengePayload(game.id, suggestion))")
    const card = readFileSync("components/teacher/ai-suggestion-card.tsx", "utf8")
    expect(card).toContain("Taip pat tinka:")
  })
})
