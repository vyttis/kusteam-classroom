import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "fs"
import type { SupabaseClient } from "@supabase/supabase-js"
import { recordSubmission } from "@/lib/game/record-submission"

// Audit R-13: an answer and the team's points are written in one database
// transaction (record_submission, migration 20261123130000). Production gets
// the code before the migration, so both sides are covered here: with the
// function, and without it (the two calls used before).

type Result = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null }

const db = {
  tables: {} as Record<string, Result>,
  rpcs: {} as Record<string, Result>,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  inserts: [] as { table: string; row: Record<string, unknown> }[],
}

function chain(table: string) {
  const result = async () => ({ data: null, error: null, count: null, ...(db.tables[table] ?? {}) })
  const c: Record<string, unknown> = {}
  for (const m of ["eq", "in", "is", "gte", "order", "limit", "select", "update", "delete"]) c[m] = () => c
  c.insert = (row: Record<string, unknown>) => {
    db.inserts.push({ table, row })
    return { then: (ok: (v: unknown) => unknown) => Promise.resolve({ error: db.tables[`${table}:insert`]?.error ?? null }).then(ok) }
  }
  c.maybeSingle = result
  c.single = result
  c.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => result().then(ok, ko)
  return c
}

const client = {
  from: (table: string) => chain(table),
  rpc: async (fn: string, args: Record<string, unknown>) => {
    db.rpcCalls.push({ fn, args })
    return { data: null, error: null, ...(db.rpcs[fn] ?? {}) }
  },
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }))
vi.mock("@/lib/ai/rate-limit", () => ({ checkAiRateLimitAsync: async () => true }))
vi.mock("@/lib/game/achievements", () => ({ evaluateAchievements: async () => [], saveAchievements: async () => {} }))
const answerIs = { correct: true }
vi.mock("@/lib/game/answer-hasher", () => ({
  MAX_ANSWER_LENGTH: 500,
  verifyAnswer: async () => answerIs.correct,
  verifyAcceptedAnswers: async () => false,
}))

const TEAM = "30000000-0000-4000-8000-0000000000a1"
const TASK = "20000000-0000-4000-8000-0000000000c1"
const NOT_DEPLOYED = [
  { code: "PGRST202", message: "Could not find the function public.record_submission in the schema cache" },
  { code: "42883", message: "function public.record_submission does not exist" },
]

const submission = { teamId: TEAM, challengeId: TASK, answer: "42", isCorrect: true, pointsAwarded: 80, hintsUsed: 1 }
const names = () => db.rpcCalls.map((c) => c.fn)

beforeEach(() => {
  db.tables = {}
  db.rpcs = {}
  db.rpcCalls = []
  db.inserts = []
  answerIs.correct = true
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe("recordSubmission: with the function (after the migration)", () => {
  it("writes the answer and the points with one call and returns the database total", async () => {
    db.rpcs.record_submission = { data: { already_solved: false, total_points: 180 } }
    const res = await recordSubmission(client as unknown as SupabaseClient, submission)
    expect(res).toEqual({ ok: true, alreadySolved: false, totalPoints: 180, path: "atomic" })
    expect(db.rpcCalls).toEqual([
      {
        fn: "record_submission",
        args: {
          p_team_id: TEAM,
          p_challenge_id: TASK,
          p_answer: "42",
          p_is_correct: true,
          p_points_awarded: 80,
          p_hints_used: 1,
        },
      },
    ])
    // Nothing is written outside the function.
    expect(db.inserts).toEqual([])
  })

  it("answers 'already solved' from the function without a second award", async () => {
    db.rpcs.record_submission = { data: { already_solved: true, total_points: 100 } }
    const res = await recordSubmission(client as unknown as SupabaseClient, submission)
    expect(res).toEqual({ ok: true, alreadySolved: true, totalPoints: 100, path: "atomic" })
    expect(names()).toEqual(["record_submission"])
    expect(db.inserts).toEqual([])
  })

  it("never follows another failure of the function with the two-step write", async () => {
    // The transaction may or may not have been committed: writing again
    // could store the answer twice.
    for (const error of [
      { code: "57014", message: "canceling statement due to statement timeout" },
      { code: "P0002", message: "team not found" },
      { message: "fetch failed" },
    ]) {
      db.rpcCalls = []
      db.rpcs.record_submission = { error }
      const res = await recordSubmission(client as unknown as SupabaseClient, submission)
      expect(res.ok).toBe(false)
      expect(names()).toEqual(["record_submission"])
      expect(db.inserts).toEqual([])
    }
  })
})

describe("recordSubmission: without the function (before the migration)", () => {
  it.each(NOT_DEPLOYED)("falls back to insert and increment_team_score on $code", async (error) => {
    db.rpcs.record_submission = { error }
    const res = await recordSubmission(client as unknown as SupabaseClient, submission)
    expect(res).toEqual({ ok: true, alreadySolved: false, totalPoints: null, path: "two-step" })
    expect(db.inserts).toEqual([
      {
        table: "submissions",
        row: { team_id: TEAM, challenge_id: TASK, answer: "42", is_correct: true, points_awarded: 80, hints_used: 1 },
      },
    ])
    expect(db.rpcCalls[1]).toEqual({ fn: "increment_team_score", args: { p_team_id: TEAM, p_points: 80 } })
  })

  it("keeps the unique-index answer: 23505 is 'already solved', no points added", async () => {
    db.rpcs.record_submission = { error: NOT_DEPLOYED[0] }
    db.tables["submissions:insert"] = { error: { code: "23505", message: "duplicate key" } }
    const res = await recordSubmission(client as unknown as SupabaseClient, submission)
    expect(res).toEqual({ ok: true, alreadySolved: true, totalPoints: null, path: "two-step" })
    expect(names()).toEqual(["record_submission"])
  })

  it("a wrong answer is stored without touching the score", async () => {
    db.rpcs.record_submission = { error: NOT_DEPLOYED[0] }
    const res = await recordSubmission(client as unknown as SupabaseClient, { ...submission, isCorrect: false, pointsAwarded: 0 })
    expect(res.ok).toBe(true)
    expect(db.inserts).toHaveLength(1)
    expect(names()).toEqual(["record_submission"])
  })

  it("a failed insert is an error and adds no points", async () => {
    db.rpcs.record_submission = { error: NOT_DEPLOYED[1] }
    db.tables["submissions:insert"] = { error: { code: "23503", message: "fk" } }
    const res = await recordSubmission(client as unknown as SupabaseClient, submission)
    expect(res).toEqual({ ok: false, code: "23503", message: "fk" })
    expect(names()).toEqual(["record_submission"])
  })

  it("logs a failed score update, as before", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    db.rpcs.record_submission = { error: NOT_DEPLOYED[0] }
    db.rpcs.increment_team_score = { error: { code: "57014", message: "timeout" } }
    const res = await recordSubmission(client as unknown as SupabaseClient, submission)
    expect(res.ok).toBe(true)
    expect(errors.mock.calls.some((call) => String(call[0]).includes("team_score_update_failed"))).toBe(true)
  })
})

describe("/api/submissions uses it on both sides of the migration", () => {
  const post = (body: unknown) =>
    new Request("https://pamokos.kusteam.app/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  const body = { session_token: "team-session-token", challenge_id: TASK, answer: "42", hints_used: 0 }

  function activity() {
    db.tables.teams = { data: { id: TEAM, game_id: "g1", total_points: 100, current_challenge_index: 0 } }
    db.tables.games = { data: { id: "g1", status: "active", settings: {} } }
    db.tables.submissions = { data: null, count: 0 }
    // Two of three hints opened on a 100-point task with a 20-point penalty.
    db.tables.challenges = {
      data: { id: TASK, type: "text", options: null, points: 100, game_id: "g1", explanation: "Nes taip.", hint_penalty: 20, hints: ["a", "b", "c"], answer_hash: "$2a$10$x" },
      count: 3,
    }
    db.tables.hint_reveals = { count: 2 }
  }

  it("after the migration: one call, scoring rules unchanged, the total comes from the database", async () => {
    const { POST } = await import("@/app/api/submissions/route")
    activity()
    db.rpcs.record_submission = { data: { already_solved: false, total_points: 160 } }
    const res = await POST(post(body))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      is_correct: true,
      points_awarded: 60,
      total_points: 160,
      message: "Teisingai! +60 taškų",
      explanation: "Nes taip.",
    })
    const call = db.rpcCalls.find((c) => c.fn === "record_submission")
    expect(call?.args).toMatchObject({ p_is_correct: true, p_points_awarded: 60, p_hints_used: 2 })
    expect(names()).not.toContain("increment_team_score")
    expect(db.inserts).toEqual([])
  })

  it("before the migration: the same answer through the two calls", async () => {
    const { POST } = await import("@/app/api/submissions/route")
    activity()
    db.rpcs.record_submission = { error: NOT_DEPLOYED[0] }
    const res = await POST(post(body))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ is_correct: true, points_awarded: 60, total_points: 160 })
    expect(db.inserts).toEqual([
      {
        table: "submissions",
        row: { team_id: TEAM, challenge_id: TASK, answer: "42", is_correct: true, points_awarded: 60, hints_used: 2 },
      },
    ])
    expect(db.rpcCalls.find((c) => c.fn === "increment_team_score")?.args).toEqual({ p_team_id: TEAM, p_points: 60 })
  })

  it.each([
    ["after", { data: { already_solved: true, total_points: 100 } }],
    ["before", { error: NOT_DEPLOYED[0] }],
  ] as const)("%s the migration: a concurrent second solve is 'already solved' with 0 points", async (side, rpc) => {
    const { POST } = await import("@/app/api/submissions/route")
    activity()
    db.rpcs.record_submission = rpc as Result
    if (side === "before") db.tables["submissions:insert"] = { error: { code: "23505", message: "duplicate key" } }
    const res = await POST(post(body))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      is_correct: true,
      points_awarded: 0,
      message: "Ši užduotis jau išspręsta!",
      already_solved: true,
    })
    expect(names()).not.toContain("increment_team_score")
  })

  it("a wrong answer is stored with 0 points on both sides", async () => {
    const { POST } = await import("@/app/api/submissions/route")
    for (const rpc of [{ data: { already_solved: false, total_points: 100 } }, { error: NOT_DEPLOYED[1] }]) {
      activity()
      db.rpcCalls = []
      db.inserts = []
      answerIs.correct = false
      db.rpcs.record_submission = rpc
      const res = await POST(post(body))
      expect(await res.json()).toMatchObject({ is_correct: false, points_awarded: 0, total_points: 100, explanation: null })
      expect(db.rpcCalls.find((c) => c.fn === "record_submission")?.args).toMatchObject({
        p_is_correct: false,
        p_points_awarded: 0,
      })
      expect(names()).not.toContain("increment_team_score")
    }
  })

  it("a failed write is a 500 with a Lithuanian message, and nothing is written twice", async () => {
    const { POST } = await import("@/app/api/submissions/route")
    activity()
    db.rpcs.record_submission = { error: { code: "57014", message: "timeout" } }
    const res = await POST(post(body))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe("Nepavyko išsaugoti atsakymo. Bandykite dar kartą.")
    expect(db.inserts).toEqual([])
  })

  it("the route writes answers and points only through recordSubmission", () => {
    const route = readFileSync("app/api/submissions/route.ts", "utf8")
    expect(route).toContain("await recordSubmission(supabase, {")
    expect(route).not.toContain('from("submissions").insert')
    expect(route).not.toContain("increment_team_score")
  })
})

describe("the migration", () => {
  const up = readFileSync("supabase/migrations/20261123130000_record_submission.sql", "utf8")
  const down = readFileSync("supabase/rollback/20261123130000_record_submission.sql", "utf8")

  it("gives the function to the service role only, with a fixed search_path", () => {
    expect(up).toMatch(/REVOKE ALL ON FUNCTION public\.record_submission\([^)]*\)\s+FROM PUBLIC, anon, authenticated;/)
    expect(up).toMatch(/GRANT EXECUTE ON FUNCTION public\.record_submission\([^)]*\)\s+TO service_role;/)
    expect(up).toContain("SET search_path = ''")
    expect(up).not.toMatch(/SECURITY DEFINER\s*\n/)
  })

  it("has a rollback that only removes the function", () => {
    expect(down).toContain("DROP FUNCTION IF EXISTS public.record_submission(uuid, uuid, text, boolean, integer, integer);")
    expect(down).not.toMatch(/DROP TABLE|DELETE FROM|ALTER TABLE/)
  })
})
