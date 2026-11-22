import { describe, expect, it } from "vitest"
import { dropLeakingHints, findHintLeaks, hintLeakIssue } from "@/lib/ai/hint-leak"
import { validateDeterministic } from "@/lib/ai/deterministic-validator"
import { reviewTask, stageToTask } from "@/lib/lesson-plans/convert"
import type { AiSuggestion } from "@/lib/ai/types"

// The task a live production test produced: the third hint states the answer.
const lagoon: AiSuggestion = {
  title: "Kuršių marių plotas",
  description: "Koks yra Kuršių marių plotas kvadratiniais kilometrais? Atsakymą rašyk sveikuoju skaičiumi.",
  type: "number",
  points: 150,
  correct_answer: "1584",
  hints: [
    "Tai didžiausia Baltijos jūros lagūna.",
    "Jos plotas didesnis nei tūkstantis kvadratinių kilometrų.",
    "Tikslus skaičius artimas 1584 km²",
  ],
  options: null,
}

const reasons = (task: Parameters<typeof findHintLeaks>[0]) => findHintLeaks(task).map((l) => `${l.index}:${l.reason}`)

describe("findHintLeaks: number answers", () => {
  it("flags the hint that contains the answer number (1584)", () => {
    expect(reasons(lagoon)).toEqual(["2:number"])
  })

  it("reads Lithuanian number spellings in the hint", () => {
    for (const hint of ["Apie 1 584 km²", "Lygiai 1584,0 kvadratinio kilometro", "Atsakymas: 1584."]) {
      expect(reasons({ ...lagoon, hints: [hint] })).toEqual(["0:number"])
    }
    expect(reasons({ ...lagoon, correct_answer: "2,5", hints: ["Gausi 2.50 metro."] })).toEqual(["0:number"])
  })

  it("does not flag other numbers or a number that only contains the answer", () => {
    expect(reasons({ ...lagoon, hints: ["Plotas didesnis nei 1000 km².", "Tai ne 15840 ir ne 158."] })).toEqual([])
  })

  it("flags a range too narrow to leave a choice", () => {
    expect(reasons({ ...lagoon, hints: ["Atsakymas yra tarp 1580 ir 1590."] })).toEqual(["0:range"])
    expect(reasons({ ...lagoon, hints: ["Nuo 1550 iki 1600 km²."] })).toEqual(["0:range"])
    expect(reasons({ ...lagoon, correct_answer: "7", hints: ["Skaičius yra tarp 6 ir 8."] })).toEqual(["0:range"])
  })

  it("accepts a wide range", () => {
    expect(reasons({ ...lagoon, hints: ["Plotas yra tarp 1000 ir 2000 km²."] })).toEqual([])
    expect(reasons({ ...lagoon, correct_answer: "7", hints: ["Skaičius yra tarp 1 ir 10."] })).toEqual([])
  })

  it("does not treat a number given in the task text as a leak", () => {
    const task = {
      type: "number",
      correct_answer: "12",
      description: "Stačiakampio ilgis 12 cm, plotis 1 cm. Koks jo plotas kvadratiniais centimetrais?",
      hints: ["Plotas yra ilgio (12 cm) ir pločio sandauga."],
      options: null,
    }
    expect(reasons(task)).toEqual([])
  })

  it("flags the worked result of a calculation", () => {
    const task = {
      type: "number",
      correct_answer: "143",
      description: "Ūgiai: 142, 138, 145, 140, 150. Apskaičiuok vidurkį.",
      hints: ["Sudėk visus ūgius: 142+138+145+140+150.", "715 : 5 = 143"],
      options: null,
    }
    expect(reasons(task)).toEqual(["1:number"])
  })
})

describe("findHintLeaks: text answers", () => {
  const river = {
    type: "text",
    correct_answer: "Nemunas",
    description: "Kuri upė yra ilgiausia Lietuvoje?",
    options: null,
  }

  it("flags the answer itself, whatever the case and diacritics", () => {
    expect(reasons({ ...river, hints: ["Tai, žinoma, NEMUNAS."] })).toEqual(["0:answer"])
    expect(reasons({ ...river, correct_answer: "Klaipėda", hints: ["Miestas vadinasi klaipeda."] })).toEqual(["0:answer"])
  })

  it("flags another case of the same word", () => {
    expect(reasons({ ...river, hints: ["Prie Nemuno stovi Kaunas."] })).toEqual(["0:inflected"])
    expect(reasons({ ...river, correct_answer: "Klaipėda", hints: ["Uostas veikia Klaipėdoje."] })).toEqual([
      "0:inflected",
    ])
  })

  it("accepts hints that do not name the answer", () => {
    expect(
      reasons({ ...river, hints: ["Ši upė įteka į Kuršių marias.", "Jos pavadinimas prasideda raide N."] })
    ).toEqual([])
  })

  it("ignores answers too short or too common to search for", () => {
    expect(reasons({ ...river, correct_answer: "Taip", hints: ["Taip pat pagalvok apie vandenį."] })).toEqual([])
    expect(reasons({ ...river, correct_answer: "Ne", hints: ["Ne visi paukščiai skraido."] })).toEqual([])
  })
})

describe("findHintLeaks: multiple choice", () => {
  const choice = {
    type: "multiple_choice",
    correct_answer: "Personifikacija",
    description: "Kokia meninė priemonė vyrauja ištraukoje?",
    options: ["Hiperbolė", "Personifikacija", "Anafora", "Antitezė"],
  }

  it("flags a hint that names the correct option", () => {
    expect(reasons({ ...choice, hints: ["Personifikacija yra negyvų daiktų sužmoginimas."] })).toEqual(["0:answer"])
  })

  it("flags a hint that rules out every other option", () => {
    expect(reasons({ ...choice, hints: ["Tai ne hiperbolė, ne anafora ir ne antitezė."] })).toEqual(["0:elimination"])
  })

  it("accepts a hint that rules out one option or describes the idea", () => {
    expect(
      reasons({ ...choice, hints: ["Tai tikrai ne anafora.", "Pagalvok, ar daiktas vaizduojamas kaip gyvas."] })
    ).toEqual([])
  })
})

describe("hint leaks in the checks around a task", () => {
  it("validateDeterministic fails the 1584 task and does not quote the answer", () => {
    const result = validateDeterministic(lagoon)
    expect(result?.verdict).toBe("fail")
    expect(result?.confidence).toBe(1)
    expect(result?.issues).toEqual([hintLeakIssue({ index: 2, reason: "number" })])
    expect(result?.issues.join(" ")).toContain("Užuomina nr. 3")
    expect(result?.issues.join(" ")).not.toContain("1584")
  })

  it("validateDeterministic still hands a clean task to the model check", () => {
    expect(validateDeterministic({ ...lagoon, hints: lagoon.hints.slice(0, 2) })).toBeNull()
  })

  it("a correct calculation does not pass when a hint states its result", () => {
    const result = validateDeterministic({
      ...lagoon,
      description: "Kiek bus 15 * 7?",
      correct_answer: "105",
      hints: ["Padaugink 15 iš 7.", "Gausi 105."],
    })
    expect(result?.verdict).toBe("fail")
  })

  it("reads a decimal comma in a number answer", () => {
    const result = validateDeterministic({ ...lagoon, description: "Kiek bus 5 / 2?", correct_answer: "2,5", hints: [] })
    expect(result?.verdict).toBe("pass")
  })

  it("dropLeakingHints removes only the leaking hint", () => {
    expect(dropLeakingHints(lagoon)).toEqual({ hints: lagoon.hints.slice(0, 2), dropped: 1 })
  })

  it("a plan stage loses the leaking hint and is marked for review", () => {
    const task = stageToTask({ ...lagoon, activity_type: "challenge" })
    expect(task.answer).toBe("1584")
    expect(task.hints).toEqual(lagoon.hints.slice(0, 2))
    expect(task.droppedHints).toBe(1)

    const review = reviewTask(task, { verdict: "pass", issues: [], confidence: 0.9 })
    expect(review.verdict).toBe("uncertain")
    expect(review.keepAnswer).toBe(true)
    expect(review.issues[0]).toMatch(/Pašalinta užuomina/)
    expect(review.issues.join(" ")).not.toContain("1584")
  })

  it("a plan stage with clean hints is left as it is", () => {
    const task = stageToTask({ ...lagoon, hints: lagoon.hints.slice(0, 2) })
    expect(task.droppedHints).toBeUndefined()
    expect(reviewTask(task, { verdict: "pass", issues: [], confidence: 0.9 }).verdict).toBe("pass")
  })
})
