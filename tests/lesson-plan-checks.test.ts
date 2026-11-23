import { describe, expect, it } from "vitest"
import { lessonPlanWarnings, stageHintWarnings, stageMinutesWarning } from "@/lib/lesson-plans/checks"

const stage = (overrides: Record<string, unknown> = {}) => ({
  activity_type: "challenge",
  title: "Vidurkis",
  description: "Apskaičiuok penkių skaičių vidurkį.",
  type: "number",
  correct_answer: "143",
  options: null,
  hints: ["Sudėk visus skaičius.", "Padalink iš to, kiek jų yra."],
  duration_minutes: 15,
  ...overrides,
})

describe("stageMinutesWarning", () => {
  it("is silent when the stages add up to the lesson", () => {
    expect(stageMinutesWarning([stage(), stage(), stage()], 45)).toBeNull()
  })

  it("names both sums when the plan is shorter than the lesson", () => {
    const warning = stageMinutesWarning([stage(), stage({ duration_minutes: 10 })], 45)
    expect(warning).toContain("Etapų trukmė (25 min.) nesutampa su pamokos trukme (45 min.).")
  })

  it("names both sums when the plan is longer than the lesson", () => {
    expect(stageMinutesWarning([stage(), stage(), stage(), stage()], 45)).toContain("(60 min.)")
  })

  it("ignores minutes that are missing or not a number", () => {
    const stages = [stage({ duration_minutes: 45 }), stage({ duration_minutes: undefined }), stage({ duration_minutes: "5" })]
    expect(stageMinutesWarning(stages, 45)).toBeNull()
  })

  it("has nothing to say about an empty plan or an unknown lesson length", () => {
    expect(stageMinutesWarning([], 45)).toBeNull()
    expect(stageMinutesWarning([stage()], Number.NaN)).toBeNull()
  })
})

describe("stageHintWarnings", () => {
  it("is silent for hints that only point the way", () => {
    expect(stageHintWarnings([stage()])).toEqual([])
  })

  it("flags the hint with the answer number, by stage and hint, without quoting the answer", () => {
    const warnings = stageHintWarnings([
      stage(),
      stage({ correct_answer: 1584, hints: ["Tai didžiausia lagūna.", "Tikslus skaičius artimas 1584 km²"] }),
    ])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/^2 etapas\. Užuomina nr\. 2 atskleidžia atsakymą/)
    expect(warnings[0]).not.toContain("1584")
  })

  it("flags another form of a text answer and a named choice", () => {
    const warnings = stageHintWarnings([
      stage({ type: "text", correct_answer: "Nemunas", hints: ["Miestas stovi prie Nemuno."] }),
      stage({
        type: "multiple_choice",
        correct_answer: "Personifikacija",
        options: ["Personifikacija", "Palyginimas", "Hiperbolė"],
        hints: ["Tai personifikacija."],
      }),
    ])
    expect(warnings.map((w) => w.slice(0, 9))).toEqual(["1 etapas.", "2 etapas."])
  })

  it("does not treat a number the task text gives as a leak", () => {
    const given = stage({
      description: "Stačiakampio plotas 143 cm². Koks jo plotas kvadratiniais centimetrais?",
      hints: ["Sąlygoje parašyta 143."],
    })
    expect(stageHintWarnings([given])).toEqual([])
  })

  it("skips stages without an answer or with malformed hints", () => {
    expect(stageHintWarnings([stage({ correct_answer: "" }), stage({ hints: "143" }), stage({ hints: [143, null] })])).toEqual([])
  })
})

describe("lessonPlanWarnings", () => {
  it("puts the minutes note first and leaves the plan untouched", () => {
    const stages = [stage({ hints: ["Atsakymas yra 143."] }), stage()]
    const before = JSON.stringify(stages)
    const warnings = lessonPlanWarnings(stages, 45)
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toContain("nesutampa su pamokos trukme")
    expect(warnings[1]).toContain("1 etapas.")
    expect(JSON.stringify(stages)).toBe(before)
  })

  it("is empty for a plan with nothing to fix", () => {
    expect(lessonPlanWarnings([stage(), stage(), stage()], 45)).toEqual([])
  })

  it("the generate route returns the notes with the plan as generated", async () => {
    const { readFileSync } = await import("node:fs")
    const route = readFileSync("app/api/lesson-plans/generate/route.ts", "utf8")
    expect(route).toContain("lessonPlanWarnings(lessonPlan.stages, parsed.data.duration)")
    expect(route).toContain("NextResponse.json({ lesson_plan: lessonPlan, warnings })")
  })
})
