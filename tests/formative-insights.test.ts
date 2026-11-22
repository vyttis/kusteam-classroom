import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildDigest,
  challengeStatsCsv,
  countHardestTasks,
  formatAverageTime,
  interpretTask,
  summarizeClass,
  type TaskSignals,
} from "@/lib/game/formative-insights"
import type { DetailedChallengeStat } from "@/lib/game/detailed-stats"
import { exportCsv } from "@/lib/csv"

const signals = (over: Partial<TaskSignals>): TaskSignals => ({
  total_teams: 6,
  attempted_teams: 6,
  solved_teams: 6,
  first_try_solves: 6,
  hint_teams: 0,
  avg_attempts_to_solve: 1,
  ...over,
})

describe("interpretTask", () => {
  it("nobody tried: says nothing about difficulty", () => {
    const i = interpretTask(signals({ attempted_teams: 0, solved_teams: 0, first_try_solves: 0 }))
    expect(i.kind).toBe("no_attempts")
    expect(i.tentative).toBe(false)
  })

  it("few teams reached it: time, not difficulty", () => {
    const i = interpretTask(signals({ attempted_teams: 2, solved_teams: 0, first_try_solves: 0 }))
    expect(i.kind).toBe("few_reached")
    expect(i.text).toContain("Užduotį bandė 2 iš 6 komandų.")
    expect(i.text).toContain("pritrūko laiko")
  })

  it("most who tried did not solve it", () => {
    const i = interpretTask(signals({ solved_teams: 2, first_try_solves: 1, avg_attempts_to_solve: 2 }))
    expect(i.kind).toBe("unsolved")
    expect(i.text).toContain("2 iš 6 bandžiusių komandų")
  })

  it("most teams used hints", () => {
    const i = interpretTask(signals({ hint_teams: 3 }))
    expect(i.kind).toBe("hints")
    expect(i.label).toBe("Grįžti prie sąvokos")
  })

  it("most solved it with the first answer", () => {
    const i = interpretTask(signals({ first_try_solves: 5, avg_attempts_to_solve: 1.2 }))
    expect(i.kind).toBe("mastered")
    expect(i.text).toBe("Iš pirmo karto išsprendė 5 iš 6 bandžiusių komandų. Klasė šią temą įvaldė.")
  })

  it("many answers before the right one", () => {
    const i = interpretTask(signals({ first_try_solves: 3, avg_attempts_to_solve: 3.25 }))
    expect(i.kind).toBe("many_attempts")
    expect(i.text).toContain("vidutiniškai 3,3")
  })

  it("few first-try solves even when the average is low", () => {
    const i = interpretTask(signals({ first_try_solves: 2, avg_attempts_to_solve: 2 }))
    expect(i.kind).toBe("many_attempts")
    expect(i.text).toContain("tik 2 iš 6")
  })

  it("otherwise uneven", () => {
    expect(interpretTask(signals({ first_try_solves: 3, avg_attempts_to_solve: 1.8 })).kind).toBe("mixed")
  })

  it("flags a reading that rests on fewer than three teams", () => {
    const i = interpretTask(signals({ total_teams: 2, attempted_teams: 2, solved_teams: 2, first_try_solves: 2 }))
    expect(i.kind).toBe("mastered")
    expect(i.tentative).toBe(true)
    expect(i.text.endsWith("Duomenų nedaug, vertinkite atsargiai.")).toBe(true)
  })

  it("uses the singular after 'iš' for one team in the activity", () => {
    const i = interpretTask(signals({ total_teams: 21, attempted_teams: 1, solved_teams: 1, first_try_solves: 1 }))
    expect(i.text).toContain("1 iš 21 komandos")
  })

  it("has no long dashes in any sentence", () => {
    const all = [
      signals({ attempted_teams: 0 }),
      signals({ attempted_teams: 2 }),
      signals({ solved_teams: 1 }),
      signals({ hint_teams: 6 }),
      signals({}),
      signals({ first_try_solves: 3, avg_attempts_to_solve: 4 }),
      signals({ first_try_solves: 3, avg_attempts_to_solve: 1.5 }),
    ].map((s) => interpretTask(s).text)
    for (const text of all) expect(text).not.toMatch(/[—–]/)
  })
})

function task(over: Partial<DetailedChallengeStat> & { title: string }): DetailedChallengeStat {
  const base = {
    challenge_id: over.title,
    order_index: 0,
    points: 100,
    type: "text",
    difficulty: null,
    total_attempts: 6,
    solves: 6,
    accuracy: 100,
    completion_rate: 100,
    avg_attempts_to_solve: 1,
    auto_difficulty: "easy" as const,
    correct_attempts: 6,
    attempted_teams: 6,
    first_try_solves: 6,
    first_try_rate: 100,
    hint_teams: 0,
    wrong_answers: [],
    choice_stats: null,
    ...over,
  }
  return {
    ...base,
    insight:
      over.insight ??
      interpretTask({
        total_teams: 6,
        attempted_teams: base.attempted_teams,
        solved_teams: base.solves,
        first_try_solves: base.first_try_solves,
        hint_teams: base.hint_teams,
        avg_attempts_to_solve: base.avg_attempts_to_solve,
      }),
  }
}

describe("buildDigest", () => {
  const easy = task({ title: "Lengva" })
  const hard = task({
    title: "Sunki",
    solves: 2,
    first_try_solves: 1,
    wrong_answers: [
      { text: "septyni", teams: 3, attempts: 4 },
      { text: "šeši", teams: 1, attempts: 1 },
    ],
  })
  const middling = task({
    title: "Vidutinė",
    solves: 5,
    first_try_solves: 3,
    wrong_answers: [{ text: "12", teams: 2, attempts: 2 }],
  })

  it("names the hardest task, the most common wrong answer and what went well", () => {
    const lines = buildDigest([easy, hard, middling], true)!
    expect(lines.map((l) => l.label)).toEqual(["Sunkiausia užduotis", "Dažniausia klaida", "Kas pavyko"])
    expect(lines[0].text).toBe("2. „Sunki“: išsprendė 2 iš 6 bandžiusių komandų, iš pirmo karto 1.")
    expect(lines[1].text).toBe("„septyni“ (2. „Sunki“): taip atsakė 3 komandos.")
    expect(lines[2].text).toBe("1. „Lengva“: iš pirmo karto išsprendė 6 iš 6 bandžiusių komandų.")
  })

  it("is empty while nobody has answered", () => {
    expect(buildDigest([task({ title: "A", attempted_teams: 0, solves: 0, first_try_solves: 0 })], true)).toBeNull()
    expect(buildDigest([], true)).toBeNull()
  })

  it("does not call a mastered task hard", () => {
    const lines = buildDigest([easy], true)!
    expect(lines[0].text).toContain("Sunkių užduočių nebuvo")
    expect(lines[2].text).toContain("„Lengva“")
  })

  it("does not call an answer given by one team a common mistake", () => {
    const lonely = task({ title: "A", solves: 5, first_try_solves: 5, wrong_answers: [{ text: "x", teams: 1, attempts: 3 }] })
    expect(buildDigest([lonely], true)![1].text).toContain("Pasikartojančių klaidingų atsakymų nebuvo")
  })

  it("says so when the answers are not shown to the reader", () => {
    expect(buildDigest([hard], false)![1].text).toBe("Klaidingų atsakymų tekstus mato tik veiklos vedėjas.")
  })

  it("prefers a task the class reached over one where time ran out", () => {
    const unreached = task({ title: "Paskutinė", attempted_teams: 1, solves: 0, first_try_solves: 0 })
    const lines = buildDigest([middling, unreached], true)!
    expect(lines[0].text).toContain("„Vidutinė“")
  })

  it("does not praise the task it just called the hardest", () => {
    const lines = buildDigest([middling], true)!
    expect(lines[0].text).toContain("„Vidutinė“")
    expect(lines[2].text).toContain("Kol kas nėra kitos užduoties")
  })
})

describe("challengeStatsCsv", () => {
  const stats = [
    task({
      title: "Suma",
      type: "number",
      solves: 4,
      first_try_solves: 2,
      first_try_rate: 33,
      wrong_answers: [{ text: "=1+1", teams: 2, attempts: 2 }],
    }),
    task({ title: "Nebandyta", attempted_teams: 0, solves: 0, first_try_solves: 0, first_try_rate: null, total_attempts: 0, auto_difficulty: "unknown" }),
  ]

  it("has the first-try rate and the top wrong answer", () => {
    const { headers, rows } = challengeStatsCsv(stats)
    expect(headers).toContain("Iš pirmo karto %")
    expect(headers).toContain("Dažniausias klaidingas atsakymas")
    expect(rows[0][headers.indexOf("Iš pirmo karto %")]).toBe(33)
    expect(rows[0][headers.indexOf("Dažniausias klaidingas atsakymas")]).toBe("=1+1")
    expect(rows[0][headers.indexOf("Taip atsakė (komandų)")]).toBe(2)
    expect(rows[1][headers.indexOf("Iš pirmo karto %")]).toBe("-")
    expect(rows[1][headers.indexOf("Sunkumas (pagal rezultatus)")]).toBe("Per mažai duomenų")
    expect(rows.every((r) => r.length === headers.length)).toBe(true)
  })

  describe("written as a file", () => {
    afterEach(() => vi.unstubAllGlobals())

    it("keeps the BOM and semicolons and neutralises a wrong answer that is a formula", async () => {
      let blob: Blob | null = null
      vi.stubGlobal("document", { createElement: () => ({ click() {} }) })
      vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
        blob = b as Blob
        return "blob:test"
      })
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

      const { headers, rows } = challengeStatsCsv(stats)
      exportCsv("test.csv", headers, rows)

      const bytes = new Uint8Array(await blob!.arrayBuffer())
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
      const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)
      const [headerLine, firstRow, secondRow] = text.replace(/^﻿/, "").split("\n")
      expect(headerLine.split(";")).toHaveLength(headers.length)
      expect(firstRow).toContain(`;"'=1+1";`)
      expect(firstRow).not.toContain(`;"=1+1";`)
      // A lone "-" placeholder is neutralised too, never left as a formula start.
      expect(secondRow).not.toMatch(/;"[=+\-@]/)
      vi.restoreAllMocks()
    })
  })
})

describe("countHardestTasks", () => {
  it("counts the named tasks, most named first", () => {
    const result = countHardestTasks([
      { hardest_challenge_title: "B" },
      { hardest_challenge_title: "A" },
      { hardest_challenge_title: "B" },
      { hardest_challenge_title: null },
      { hardest_challenge_title: "  " },
    ])
    expect(result).toEqual({ named: [{ title: "B", count: 2 }, { title: "A", count: 1 }], unnamed: 2 })
  })
})

describe("formatAverageTime", () => {
  it("writes units the Lithuanian way", () => {
    expect(formatAverageTime(60)).toBe("1 min.")
    expect(formatAverageTime(725)).toBe("12 min.")
    expect(formatAverageTime(45.4)).toBe("45 s")
    expect(formatAverageTime(null)).toBe("-")
    expect(formatAverageTime(0)).toBe("-")
  })
})

describe("summarizeClass", () => {
  it("counts solved tasks of all possible and right answers of all given", () => {
    // Production 2026-11-22: six teams, 19 answers, 13 right, shown as "0 iš 0".
    const totals = summarizeClass(
      [
        { solves: 6, total_attempts: 8, correct_attempts: 6 },
        { solves: 5, total_attempts: 7, correct_attempts: 5 },
        { solves: 2, total_attempts: 4, correct_attempts: 2 },
      ],
      6
    )
    expect(totals).toEqual({ solved: 13, possible: 18, completion_pct: 72, attempts: 19, correct: 13, accuracy_pct: 68 })
  })

  it("is zero, not NaN, before anything happens", () => {
    expect(summarizeClass([], 0)).toEqual({ solved: 0, possible: 0, completion_pct: 0, attempts: 0, correct: 0, accuracy_pct: 0 })
  })
})
