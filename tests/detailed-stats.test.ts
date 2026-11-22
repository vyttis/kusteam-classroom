import { describe, it, expect } from "vitest"
import { computeDetailedStats } from "@/lib/game/detailed-stats"
import type { SupabaseClient } from "@supabase/supabase-js"

// Minimal chainable mock of the supabase query builder: from(table) returns a
// thenable that resolves to { data } for that table regardless of filters,
// except the keyset paging calls on id (order, gt, limit) behave like
// PostgREST. Rows without an id get one in their listed order.
function mockSupabase(tables: Record<string, unknown[]>, failing: string[] = []): SupabaseClient {
  function builder(table: string) {
    let rows = (tables[table] ?? []).map((r, i) => ({
      id: `row-${String(i).padStart(6, "0")}`,
      ...(r as Record<string, unknown>),
    }))
    const chain: Record<string, unknown> = {}
    for (const method of ["select", "eq", "in"]) {
      chain[method] = () => chain
    }
    chain.order = (column: string) => {
      if (column === "id") rows = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      return chain
    }
    chain.gt = (column: string, value: string) => {
      if (column === "id") rows = rows.filter((r) => r.id > value)
      return chain
    }
    chain.limit = (n: number) => {
      rows = rows.slice(0, n)
      return chain
    }
    chain.then = (resolve: (value: { data: unknown[] | null; error: unknown }) => unknown) =>
      Promise.resolve(
        failing.includes(table) ? { data: null, error: { message: "unavailable" } } : { data: rows, error: null }
      ).then(resolve)
    return chain
  }
  return { from: builder } as unknown as SupabaseClient
}

const CHALLENGE_A = "aaaaaaaa-0000-0000-0000-000000000001"
const CHALLENGE_B = "aaaaaaaa-0000-0000-0000-000000000002"
const TEAM_1 = "bbbbbbbb-0000-0000-0000-000000000001"
const TEAM_2 = "bbbbbbbb-0000-0000-0000-000000000002"

const challenges = [
  { id: CHALLENGE_A, title: "Užduotis A", points: 100, order_index: 0, difficulty: null, type: "text" },
  { id: CHALLENGE_B, title: "Užduotis B", points: 150, order_index: 1, difficulty: "hard", type: "number" },
]

const teams = [
  { id: TEAM_1, name: "Liūtai", total_points: 250, joined_at: "2026-07-07T09:00:00Z" },
  { id: TEAM_2, name: "Ereliai", total_points: 100, joined_at: "2026-07-07T09:05:00Z" },
]

// Ordered by attempted_at ascending, as the real query requests
const submissions = [
  // Team 1: solves A on 1st attempt, solves B on 3rd attempt
  { challenge_id: CHALLENGE_A, is_correct: true, points_awarded: 100, team_id: TEAM_1, hints_used: 0, attempted_at: "2026-07-07T09:10:00Z" },
  { challenge_id: CHALLENGE_B, is_correct: false, points_awarded: 0, team_id: TEAM_1, hints_used: 1, attempted_at: "2026-07-07T09:12:00Z" },
  { challenge_id: CHALLENGE_B, is_correct: false, points_awarded: 0, team_id: TEAM_1, hints_used: 0, attempted_at: "2026-07-07T09:13:00Z" },
  { challenge_id: CHALLENGE_B, is_correct: true, points_awarded: 150, team_id: TEAM_1, hints_used: 0, attempted_at: "2026-07-07T09:14:00Z" },
  // Team 2: solves A on 2nd attempt, never solves B
  { challenge_id: CHALLENGE_A, is_correct: false, points_awarded: 0, team_id: TEAM_2, hints_used: 2, attempted_at: "2026-07-07T09:11:00Z" },
  { challenge_id: CHALLENGE_A, is_correct: true, points_awarded: 100, team_id: TEAM_2, hints_used: 0, attempted_at: "2026-07-07T09:15:00Z" },
  { challenge_id: CHALLENGE_B, is_correct: false, points_awarded: 0, team_id: TEAM_2, hints_used: 0, attempted_at: "2026-07-07T09:16:00Z" },
]

describe("computeDetailedStats", () => {
  it("computes per-challenge attempts, unique solves, accuracy and completion", async () => {
    const supabase = mockSupabase({ challenges, teams, submissions })
    const stats = await computeDetailedStats(supabase, "game-1")

    const a = stats.challenge_stats.find((c) => c.challenge_id === CHALLENGE_A)!
    expect(a.total_attempts).toBe(3)
    expect(a.solves).toBe(2) // both teams solved A
    expect(a.accuracy).toBe(67) // 2 correct of 3 attempts
    expect(a.completion_rate).toBe(100)

    const b = stats.challenge_stats.find((c) => c.challenge_id === CHALLENGE_B)!
    expect(b.total_attempts).toBe(4)
    expect(b.solves).toBe(1) // only team 1
    expect(b.completion_rate).toBe(50)
  })

  it("computes avg attempts up to each team's own first correct submission", async () => {
    const supabase = mockSupabase({ challenges, teams, submissions })
    const stats = await computeDetailedStats(supabase, "game-1")

    const a = stats.challenge_stats.find((c) => c.challenge_id === CHALLENGE_A)!
    // Team 1 solved in 1 attempt, team 2 in 2 -> avg 1.5
    expect(a.avg_attempts_to_solve).toBe(1.5)

    const b = stats.challenge_stats.find((c) => c.challenge_id === CHALLENGE_B)!
    // Team 1 solved on the 3rd attempt; team 2 never solved (excluded)
    expect(b.avg_attempts_to_solve).toBe(3)
  })

  it("computes per-team results: solved, attempts, hints, last activity", async () => {
    const supabase = mockSupabase({ challenges, teams, submissions })
    const stats = await computeDetailedStats(supabase, "game-1")

    expect(stats.total_teams).toBe(2)

    const t1 = stats.team_stats.find((t) => t.team_id === TEAM_1)!
    expect(t1.solved).toBe(2)
    expect(t1.attempts).toBe(4)
    expect(t1.hints_used).toBe(1)

    const t2 = stats.team_stats.find((t) => t.team_id === TEAM_2)!
    expect(t2.solved).toBe(1)
    expect(t2.attempts).toBe(3)
    expect(t2.hints_used).toBe(2)
    expect(t2.last_activity).toBe("2026-07-07T09:16:00Z")
  })

  it("counts a hint once even when the team answered the task several times", async () => {
    // Production 2026-11-08: one hint on a task, a wrong and then a right
    // answer (both record hints_used 1) showed "2" to the facilitator.
    const supabase = mockSupabase({
      challenges,
      teams: [teams[0]],
      submissions: [
        { challenge_id: CHALLENGE_A, is_correct: false, points_awarded: 0, team_id: TEAM_1, hints_used: 1, attempted_at: "2026-11-08T11:26:00Z" },
        { challenge_id: CHALLENGE_A, is_correct: true, points_awarded: 80, team_id: TEAM_1, hints_used: 1, attempted_at: "2026-11-08T11:27:00Z" },
        { challenge_id: CHALLENGE_B, is_correct: false, points_awarded: 0, team_id: TEAM_1, hints_used: 2, attempted_at: "2026-11-08T11:28:00Z" },
        { challenge_id: CHALLENGE_B, is_correct: true, points_awarded: 110, team_id: TEAM_1, hints_used: 2, attempted_at: "2026-11-08T11:29:00Z" },
      ],
    })
    const stats = await computeDetailedStats(supabase, "game-1")
    expect(stats.team_stats[0].hints_used).toBe(3)
  })

  it("returns empty stats for a game with no challenges", async () => {
    const supabase = mockSupabase({ challenges: [], teams })
    const stats = await computeDetailedStats(supabase, "game-1")
    expect(stats.challenge_stats).toEqual([])
    expect(stats.team_stats).toEqual([])
    expect(stats.total_teams).toBe(2)
  })

  it("marks low-accuracy challenges as hard (auto difficulty)", async () => {
    const manyWrong = [
      ...Array.from({ length: 8 }, (_, i) => ({
        challenge_id: CHALLENGE_A,
        is_correct: false,
        points_awarded: 0,
        team_id: TEAM_2,
        hints_used: 0,
        attempted_at: `2026-07-07T10:0${i}:00Z`,
      })),
      { challenge_id: CHALLENGE_A, is_correct: true, points_awarded: 100, team_id: TEAM_1, hints_used: 0, attempted_at: "2026-07-07T10:09:00Z" },
    ]
    const supabase = mockSupabase({
      challenges: [challenges[0]],
      teams,
      submissions: manyWrong,
    })
    const stats = await computeDetailedStats(supabase, "game-1")
    expect(stats.challenge_stats[0].auto_difficulty).toBe("hard")
  })

  it("counts every answer when a session has more than 1000", async () => {
    const many = Array.from({ length: 2500 }, (_, i) => ({
      challenge_id: CHALLENGE_A,
      is_correct: false,
      points_awarded: 0,
      team_id: TEAM_2,
      hints_used: 0,
      attempted_at: new Date(Date.UTC(2026, 6, 7, 9, 0, i)).toISOString(),
    }))
    const supabase = mockSupabase({ challenges, teams, submissions: many })
    const stats = await computeDetailedStats(supabase, "game-1")
    const a = stats.challenge_stats.find((c) => c.challenge_id === CHALLENGE_A)!
    expect(a.total_attempts).toBe(2500)
  })

  it("fails instead of counting part of the answers", async () => {
    const supabase = mockSupabase({ challenges, teams, submissions: [] }, ["submissions"])
    await expect(computeDetailedStats(supabase, "game-1")).rejects.toBeTruthy()
  })

  it("computes first-try solves, teams that tried and teams that used hints", async () => {
    const supabase = mockSupabase({ challenges, teams, submissions })
    const stats = await computeDetailedStats(supabase, "game-1")

    const a = stats.challenge_stats.find((c) => c.challenge_id === CHALLENGE_A)!
    expect(a.attempted_teams).toBe(2)
    expect(a.first_try_solves).toBe(1) // team 1 only
    expect(a.first_try_rate).toBe(50)
    expect(a.hint_teams).toBe(1) // team 2
    expect(a.correct_attempts).toBe(2)

    const b = stats.challenge_stats.find((c) => c.challenge_id === CHALLENGE_B)!
    expect(b.first_try_solves).toBe(0)
    expect(b.insight.kind).toBe("hints") // team 1 of 2 had a hint open
  })

  it("leaves the answer texts out unless an answer reader is given", async () => {
    const withAnswers = submissions.map((s, i) => ({ ...s, answer: s.is_correct ? "teisingai" : i % 2 ? "Septyni" : " septyni " }))
    const supabase = mockSupabase({ challenges, teams, submissions: withAnswers })

    const plain = await computeDetailedStats(supabase, "game-1")
    expect(plain.answers_included).toBe(false)
    expect(plain.challenge_stats.every((c) => c.wrong_answers.length === 0 && c.choice_stats === null)).toBe(true)

    const owner = await computeDetailedStats(supabase, "game-1", { answerReader: supabase })
    expect(owner.answers_included).toBe(true)
    const b = owner.challenge_stats.find((c) => c.challenge_id === CHALLENGE_B)!
    expect(b.wrong_answers).toHaveLength(1)
    expect(b.wrong_answers[0].teams).toBe(2)
    expect(b.wrong_answers[0].attempts).toBe(3)
  })

  it("reads the answers only for the tasks the caller can read", async () => {
    // The caller's own client returns no tasks (not their activity): the
    // answer reader must not be asked for anything.
    const caller = mockSupabase({ challenges: [], teams: [] })
    const reader = { from: () => { throw new Error("must not read answers") } } as unknown as SupabaseClient
    const stats = await computeDetailedStats(caller, "game-1", { answerReader: reader })
    expect(stats.challenge_stats).toEqual([])
  })

  it("counts picks per option of a choice task", async () => {
    const choice = { id: CHALLENGE_A, title: "Pasirink", points: 50, order_index: 0, difficulty: null, type: "multiple_choice", options: ["A", "B"] }
    const supabase = mockSupabase({
      challenges: [choice],
      teams,
      submissions: [
        { challenge_id: CHALLENGE_A, is_correct: false, points_awarded: 0, team_id: TEAM_1, hints_used: 0, attempted_at: "2026-07-07T09:10:00Z", answer: "A" },
        { challenge_id: CHALLENGE_A, is_correct: true, points_awarded: 50, team_id: TEAM_1, hints_used: 0, attempted_at: "2026-07-07T09:11:00Z", answer: "B" },
        { challenge_id: CHALLENGE_A, is_correct: true, points_awarded: 50, team_id: TEAM_2, hints_used: 0, attempted_at: "2026-07-07T09:12:00Z", answer: "B" },
      ],
    })
    const stats = await computeDetailedStats(supabase, "game-1", { answerReader: supabase })
    expect(stats.challenge_stats[0].wrong_answers).toEqual([])
    expect(stats.challenge_stats[0].choice_stats).toEqual([
      { option: "A", teams: 1, correct: false },
      { option: "B", teams: 2, correct: true },
    ])
  })
})
