import { describe, expect, it } from "vitest"
import {
  WRONG_ANSWER_MAX_LENGTH,
  choiceDistribution,
  displayAnswer,
  groupWrongAnswers,
  wrongAnswerKey,
} from "@/lib/game/wrong-answers"

const row = (team_id: string, answer: string | null, is_correct = false) => ({ team_id, answer, is_correct })

describe("groupWrongAnswers", () => {
  it("counts spellings the answer checker treats as one answer together", () => {
    const top = groupWrongAnswers(
      [row("t1", "septyni"), row("t2", " Septyni "), row("t3", "SEPTYNI."), row("t4", "aštuoni"), row("t5", "astuoni")],
      "text"
    )
    expect(top).toEqual([
      { text: "septyni", teams: 3, attempts: 3 },
      { text: "aštuoni", teams: 2, attempts: 2 },
    ])
  })

  it("shows the most frequent original spelling", () => {
    const top = groupWrongAnswers([row("t1", "vilnius"), row("t2", "Vilnius"), row("t3", "Vilnius")], "text")
    expect(top[0].text).toBe("Vilnius")
  })

  it("counts teams, not repeats of the same team", () => {
    const top = groupWrongAnswers(
      [row("t1", "5"), row("t1", "5"), row("t1", "5"), row("t2", "6"), row("t3", "6")],
      "number"
    )
    expect(top[0]).toEqual({ text: "6", teams: 2, attempts: 2 })
    expect(top[1]).toEqual({ text: "5", teams: 1, attempts: 3 })
  })

  it("groups numbers by value", () => {
    const top = groupWrongAnswers([row("t1", "2,5"), row("t2", "2.50"), row("t3", " 2.5 ")], "number")
    expect(top).toHaveLength(1)
    expect(top[0].teams).toBe(3)
  })

  it("keeps a number task's answer that is not a number", () => {
    expect(groupWrongAnswers([row("t1", "nežinau"), row("t2", "Nežinau")], "number")[0].teams).toBe(2)
  })

  it("returns the top three, ignores right and empty answers", () => {
    const rows = [
      row("t1", "a"), row("t2", "a"), row("t3", "a"),
      row("t1", "b"), row("t2", "b"),
      row("t1", "c"), row("t1", "d"),
      row("t4", "teisingai", true), row("t5", "   "), row("t6", null),
    ]
    const top = groupWrongAnswers(rows, "text")
    expect(top.map((w) => w.text)).toEqual(["a", "b", "c"])
  })

  it("lists nothing for tasks that are not typed", () => {
    expect(groupWrongAnswers([row("t1", "A")], "multiple_choice")).toEqual([])
    expect(groupWrongAnswers([row("t1", "A")], "location")).toEqual([])
  })

  it("caps a long answer and removes line breaks and control characters", () => {
    const long = "x".repeat(300)
    const top = groupWrongAnswers([row("t1", long)], "text")
    expect(Array.from(top[0].text).length).toBe(WRONG_ANSWER_MAX_LENGTH)
    expect(top[0].text.endsWith("…")).toBe(true)
    expect(displayAnswer("pirma\neilutė\u0000‮ antra")).toBe("pirma eilutė antra")
  })

  it("leaves markup as plain text for the page to escape", () => {
    const top = groupWrongAnswers([row("t1", "<img src=x onerror=alert(1)>")], "text")
    expect(top[0].text).toBe("<img src=x onerror=alert(1)>")
  })
})

describe("wrongAnswerKey", () => {
  it("matches the checker's folded text form", () => {
    expect(wrongAnswerKey(" Šaltinį! ", "text")).toBe("saltini")
    expect(wrongAnswerKey("1 000", "number")).toBe("1000")
  })
})

describe("choiceDistribution", () => {
  it("counts teams per option in the order of the options", () => {
    const stats = choiceDistribution(
      [row("t1", "Kasti"), row("t1", "kąsti", true), row("t2", "kąsti", true), row("t3", "kasti")],
      ["kasti", "kąsti", "kosti"]
    )
    expect(stats).toEqual([
      { option: "kasti", teams: 2, correct: false },
      { option: "kąsti", teams: 2, correct: true },
      { option: "kosti", teams: 0, correct: false },
    ])
  })

  it("returns nothing without options", () => {
    expect(choiceDistribution([row("t1", "a")], null)).toEqual([])
  })
})

describe("participant code", () => {
  it("never imports the wrong-answer statistics", async () => {
    const { readdirSync, readFileSync, statSync } = await import("fs")
    const { join } = await import("path")
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(name)) files.push(full)
      }
    }
    for (const dir of ["app/play", "app/api/play", "components/player"]) walk(join(process.cwd(), dir))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/wrong-answers|detailed-stats|answerReader/)
    }
  })
})
