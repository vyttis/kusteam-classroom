import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"
import { STARTER_ACTIVITIES } from "@/lib/content/starter-activities"
import { verifyAcceptedAnswers, verifyAnswer } from "@/lib/game/answer-hasher"
import {
  starterChallengeRows,
  starterCreatedResponse,
  starterGameFields,
} from "@/lib/starter-catalogue/rows"
import { findCatalogueDetail, listCatalogueEntries } from "@/lib/starter-catalogue/entries"
import { relevance, sortByRelevance } from "@/lib/starter-catalogue/types"

const root = path.join(__dirname, "..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

function filesUnder(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const file = path.join(dir, name)
    return statSync(path.join(root, file)).isDirectory() ? filesUnder(file) : [file]
  })
}

const GAME_ID = "00000000-0000-4000-8000-000000000000"

describe("starter activity to database rows", () => {
  it("every catalogue activity maps without error, tasks in catalogue order", async () => {
    for (const activity of STARTER_ACTIVITIES) {
      const rows = await starterChallengeRows(activity, GAME_ID)
      expect(rows.map((r) => r.title), activity.slug).toEqual(activity.challenges.map((c) => c.title))
      expect(rows.map((r) => r.order_index), activity.slug).toEqual(rows.map((_, i) => i))
      for (const row of rows) {
        expect(row.game_id).toBe(GAME_ID)
        expect(row.generated_by_di).toBe(false)
        expect(row.needs_answer).toBe(false)
        expect(row.answer_hash).toMatch(/^\$2[aby]\$/)
        // Same keys in every row: a bulk insert must not null a missing one.
        expect(Object.keys(row).sort()).toEqual(Object.keys(rows[0]).sort())
        expect(Object.keys(row)).not.toContain("correct_answer")
        expect(Object.keys(row)).not.toContain("accepted_answers")
      }
    }
  }, 120_000)

  it("stores answers only as hashes that accept the written answers", async () => {
    const activity =
      STARTER_ACTIVITIES.find((a) => a.challenges.some((c) => c.accepted_answers.length > 0)) ?? STARTER_ACTIVITIES[0]
    const rows = await starterChallengeRows(activity, GAME_ID)
    for (const [i, c] of activity.challenges.entries()) {
      const row = rows[i]
      expect(await verifyAnswer(c.correct_answer, row.answer_hash, { type: c.type }), c.title).toBeTruthy()
      expect(row.accepted_answer_hashes.length, c.title).toBeLessThanOrEqual(c.accepted_answers.length)
      for (const extra of c.accepted_answers) {
        const viaMain = await verifyAnswer(extra, row.answer_hash, { type: c.type })
        const viaExtra = await verifyAcceptedAnswers(extra, row.accepted_answer_hashes, c.type)
        expect(Boolean(viaMain) || Boolean(viaExtra), `${c.title}: ${extra}`).toBe(true)
      }
      if (c.type === "multiple_choice") expect(row.accepted_answer_hashes).toEqual([])
      const serialised = JSON.stringify({ ...row, options: null, explanation: "", description: "", hints: [] })
      expect(serialised, c.title).not.toContain(JSON.stringify(c.correct_answer))
    }
  }, 60_000)

  it("the activity is a draft-ready shell: time limit from the duration, leaderboard on", () => {
    for (const activity of STARTER_ACTIVITIES) {
      const fields = starterGameFields(activity)
      expect(fields.title).toBe(activity.title)
      // Participants see the description when joining: no facilitator notes.
      expect(fields.description).toBe(activity.description)
      expect(fields.settings.time_limit_minutes).toBe(activity.duration_minutes)
      expect(fields.settings.show_leaderboard).toBe(true)
      expect(fields.settings.max_teams).toBeGreaterThan(0)
    }
  })

  it("the response carries ids only", () => {
    const body = starterCreatedResponse({ id: GAME_ID, game_code: "ABC123" }, "slug")
    expect(Object.keys(body).sort()).toEqual(["game_code", "game_id", "slug"])
  })
})

describe("catalogue entries", () => {
  it("list and detail carry no answers, hints or post-solve texts", () => {
    const entries = listCatalogueEntries()
    expect(entries).toHaveLength(STARTER_ACTIVITIES.length)
    for (const activity of STARTER_ACTIVITIES) {
      const detail = findCatalogueDetail(activity.slug)!
      expect(detail.tasks.map((t) => Object.keys(t).sort())).toEqual(
        activity.challenges.map(() => ["points", "title", "type"]),
      )
      const sent = JSON.stringify([detail, entries.find((e) => e.slug === activity.slug)])
      for (const key of ["correct_answer", "accepted_answers", "explanation", "hints", "options", "sources"]) {
        expect(sent, `${activity.slug}: ${key}`).not.toContain(`"${key}"`)
      }
      for (const c of activity.challenges) {
        expect(sent, `${activity.slug}: ${c.title}`).not.toContain(JSON.stringify(c.explanation))
        for (const hint of c.hints) expect(sent).not.toContain(JSON.stringify(hint))
      }
    }
    expect(findCatalogueDetail("no-such-activity")).toBeUndefined()
  })

  it("puts activities for the facilitator's subjects and classes first, keeping catalogue order", () => {
    const entries = [
      { slug: "a", subject: "Fizika", grade_band: "7-8 kl." },
      { slug: "b", subject: "Matematika", grade_band: "5-6 kl." },
      { slug: "c", subject: "Matematika", grade_band: "7-8 kl." },
      { slug: "d", subject: "Chemija", grade_band: "9-10 kl." },
    ]
    expect(relevance(entries[2], ["Matematika"], ["7-8 kl."])).toBe(2)
    expect(sortByRelevance(entries, ["Matematika"], ["7-8 kl."]).map((e) => e.slug)).toEqual(["c", "a", "b", "d"])
    expect(sortByRelevance(entries, [], []).map((e) => e.slug)).toEqual(["a", "b", "c", "d"])
  })
})

// The catalogue shows an activity before the facilitator owns a copy, so its
// UI must never get hold of the answers.
describe("catalogue UI never touches answers", () => {
  const uiFiles = [
    ...filesUnder("app/(teacher)/paruostos-veiklos"),
    "components/teacher/starter-catalogue.tsx",
    "components/teacher/use-starter-activity-button.tsx",
  ]

  it("covers the pages and components", () => {
    expect(uiFiles.length).toBeGreaterThanOrEqual(4)
  })

  for (const file of uiFiles) {
    it(file, () => {
      const source = read(file)
      for (const word of ["correct_answer", "accepted_answers", "explanation", "answer_hash", "hints"]) {
        expect(source, word).not.toContain(word)
      }
      // The full content is reachable only through the server-side mapping.
      expect(source).not.toContain("lib/content/starter-activities")
      expect(source).not.toContain("starter-catalogue/rows")
      if (/^\s*["']use client["']/.test(source)) {
        expect(source).not.toContain("starter-catalogue/entries")
      }
    })
  }

  it("the client-safe module imports no content", () => {
    expect(read("lib/starter-catalogue/types.ts")).not.toMatch(/^import /m)
  })

  it("the route answers with the id-only response and rolls back a failed copy", () => {
    const route = read("app/api/games/starter/route.ts")
    expect(route).toContain("starterCreatedResponse(game, activity.slug)")
    expect(route).toContain('.select("id, game_code")')
    expect(route).toContain("defaultToNull: false")
    expect(route.match(/await rollBack\(\)/g)).toHaveLength(2)
  })

  it("the proxy protects the catalogue", () => {
    expect(read("proxy.ts")).toContain('url.pathname.startsWith("/paruostos-veiklos")')
  })
})
