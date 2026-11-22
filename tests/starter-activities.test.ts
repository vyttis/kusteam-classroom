import { describe, expect, it } from "vitest"
import { STARTER_ACTIVITIES } from "@/lib/content/starter-activities"
import { normalizeAnswer } from "@/lib/game/answer-hasher"

const foldAnswer = (value: string) => normalizeAnswer(value)

// Ready-made activities are run in real lessons as they are: every one must
// be internally consistent, playable and written to the house rules.
describe("starter activities", () => {
  it("slugs are unique", () => {
    const slugs = STARTER_ACTIVITIES.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  for (const activity of STARTER_ACTIVITIES) {
    describe(activity.slug, () => {
      it("multiple choice answers are one of four distinct options; other types have none", () => {
        for (const c of activity.challenges) {
          if (c.type === "multiple_choice") {
            expect(c.options, c.title).not.toBeNull()
            expect(new Set(c.options!.map(foldAnswer)).size, c.title).toBe(4)
            expect(c.options!.map(foldAnswer), c.title).toContain(foldAnswer(c.correct_answer))
            expect(c.accepted_answers, c.title).toEqual([])
          } else {
            expect(c.options, c.title).toBeNull()
          }
        }
      })

      it("number answers are numbers", () => {
        for (const c of activity.challenges.filter((x) => x.type === "number")) {
          for (const answer of [c.correct_answer, ...c.accepted_answers]) {
            expect(answer.replace(",", "."), c.title).toMatch(/^-?\d+(\.\d+)?$/)
          }
        }
      })

      it("text answers are short", () => {
        for (const c of activity.challenges.filter((x) => x.type === "text")) {
          expect(c.correct_answer.split(/\s+/).length, c.title).toBeLessThanOrEqual(3)
        }
      })

      it("no hint gives the answer away", () => {
        for (const c of activity.challenges) {
          const answers = [c.correct_answer, ...c.accepted_answers].map(foldAnswer)
          for (const hint of c.hints) {
            const folded = foldAnswer(hint)
            for (const answer of answers) {
              if (c.type === "number") {
                expect(folded.split(/[^0-9.,-]+/), `${c.title}: ${hint}`).not.toContain(answer)
              } else if (answer.length >= 3) {
                expect(folded, `${c.title}: ${hint}`).not.toContain(answer)
              }
            }
          }
        }
      })

      it("mixes task types and thinking levels, and the time fits", () => {
        expect(new Set(activity.challenges.map((c) => c.type)).size).toBeGreaterThanOrEqual(2)
        expect(new Set(activity.challenges.map((c) => c.cognitive_level)).size).toBeGreaterThanOrEqual(2)
        // About 3 to 8 minutes of team work per task.
        const perTask = activity.duration_minutes / activity.challenges.length
        expect(perTask).toBeGreaterThanOrEqual(2.5)
        expect(perTask).toBeLessThanOrEqual(8)
      })

      it("has no long dashes and uses Lithuanian quotation marks", () => {
        const all = JSON.stringify(activity)
        expect(all).not.toMatch(/[—–]/)
        expect(all).not.toMatch(/\\"[^\\]/) // straight double quotes inside the text
      })
    })
  }
})
