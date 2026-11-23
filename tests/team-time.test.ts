import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "fs"
import { joiningTimeOver, type GameClock } from "@/lib/game/clock"
import { formatClock, latestTeamSecondsLeft, teamTime, teamTimeLabel } from "@/lib/game/team-time"

// Audit R-12: the time limit belongs to each team (from its own "Pradėti"),
// the class screen counted from the start of the activity without saying
// so, and a forgotten timed activity kept taking new teams.

const START = Date.parse("2026-11-23T08:00:00.000Z")
const iso = (ms: number) => new Date(ms).toISOString()
const MIN = 60_000
const limit = (minutes: number | null, pausedMs = 0, pausedAt: string | null = null): GameClock => ({
  limitMinutes: minutes,
  pausedMs,
  pausedAt,
})

describe("a team's own time", () => {
  it("runs from the team's start, not from the start of the activity", () => {
    const clock = limit(30)
    // Started 10 minutes into the activity; now minute 25 of the activity.
    const late = { startedAt: iso(START + 10 * MIN), pauseOffsetMs: 0 }
    expect(teamTime(clock, late, START + 25 * MIN)).toEqual({ kind: "running", secondsLeft: 15 * 60 })
    // At minute 35 the class clock is long at zero; this team has 5 minutes.
    expect(teamTime(clock, late, START + 35 * MIN)).toEqual({ kind: "running", secondsLeft: 5 * 60 })
    expect(teamTime(clock, late, START + 40 * MIN)).toEqual({ kind: "over" })
  })

  it("is not running before 'Pradėti', and there is none without a limit", () => {
    expect(teamTime(limit(30), { startedAt: null, pauseOffsetMs: 0 }, START)).toEqual({ kind: "not-started" })
    expect(teamTime(limit(null), { startedAt: iso(START), pauseOffsetMs: 0 }, START)).toBeNull()
  })

  it("gets back only the pause time that fell inside its own run", () => {
    // 4 minutes of pauses in all, 3 of them before this team started.
    const clock = limit(30, 4 * MIN)
    const team = { startedAt: iso(START + 10 * MIN), pauseOffsetMs: 3 * MIN }
    expect(teamTime(clock, team, START + 40 * MIN)).toEqual({ kind: "running", secondsLeft: 60 })
    // A pause in progress holds the time still.
    const paused = limit(30, 0, iso(START + 20 * MIN))
    const early = { startedAt: iso(START), pauseOffsetMs: 0 }
    expect(teamTime(paused, early, START + 21 * MIN)).toEqual({ kind: "running", secondsLeft: 10 * 60 })
    expect(teamTime(paused, early, START + 50 * MIN)).toEqual({ kind: "running", secondsLeft: 10 * 60 })
  })

  it("the last deadline among started teams is when the whole class is done", () => {
    const clock = limit(30)
    const teams = [
      { startedAt: iso(START + 1 * MIN), pauseOffsetMs: 0 },
      { startedAt: iso(START + 12 * MIN), pauseOffsetMs: 0 },
      { startedAt: null, pauseOffsetMs: 0 },
    ]
    expect(latestTeamSecondsLeft(clock, teams, START + 32 * MIN)).toBe(10 * 60)
    expect(latestTeamSecondsLeft(clock, teams, START + 60 * MIN)).toBe(0)
    expect(latestTeamSecondsLeft(clock, [{ startedAt: null, pauseOffsetMs: 0 }], START)).toBeNull()
    expect(latestTeamSecondsLeft(limit(null), teams, START)).toBeNull()
  })

  it("is said in Lithuanian, without an em dash", () => {
    const labels = [
      teamTimeLabel({ kind: "not-started" }),
      teamTimeLabel({ kind: "over" }),
      teamTimeLabel({ kind: "running", secondsLeft: 425 }),
    ]
    expect(labels).toEqual([
      "Laikas dar neskaičiuojamas: komanda nepradėjo",
      "Komandos laikas baigėsi",
      "Komandai liko 07:05",
    ])
    for (const label of labels) expect(label).not.toMatch(/[—–]/)
    expect(formatClock(3723)).toBe("1:02:03")
    expect(formatClock(-5)).toBe("00:00")
  })
})

describe("joiningTimeOver: when a timed activity stops taking new teams", () => {
  it("is the moment the limit, counted from the activity's start, has passed", () => {
    const clock = limit(30)
    expect(joiningTimeOver(clock, iso(START), START + 29 * MIN)).toBe(false)
    expect(joiningTimeOver(clock, iso(START), START + 30 * MIN)).toBe(false)
    expect(joiningTimeOver(clock, iso(START), START + 30 * MIN + 1)).toBe(true)
  })

  it("never closes an activity without a limit or without a start", () => {
    expect(joiningTimeOver(limit(null), iso(START), START + 24 * 60 * MIN)).toBe(false)
    expect(joiningTimeOver(limit(30), null, START + 24 * 60 * MIN)).toBe(false)
    expect(joiningTimeOver(limit(30), "not a date", START + 24 * 60 * MIN)).toBe(false)
  })

  it("pauses and extensions move it", () => {
    // 10 minutes of pauses: open until minute 40.
    expect(joiningTimeOver(limit(30, 10 * MIN), iso(START), START + 39 * MIN)).toBe(false)
    expect(joiningTimeOver(limit(30, 10 * MIN), iso(START), START + 41 * MIN)).toBe(true)
    // Closed at minute 35, open again after "Pratęsti" (+10 min.).
    expect(joiningTimeOver(limit(30), iso(START), START + 35 * MIN)).toBe(true)
    expect(joiningTimeOver(limit(40), iso(START), START + 35 * MIN)).toBe(false)
  })
})

// --- routes -----------------------------------------------------------------

type Result = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null }
const db = {
  tables: {} as Record<string, Result>,
  inserts: [] as string[],
  selects: [] as string[],
  filters: [] as string[],
  user: { id: "teacher-1" } as { id: string } | null,
}
function chain(table: string, who: string) {
  // "<who>:<table>:created" is what an insert returns; reads made before it
  // (count, name check) see the plain "<who>:<table>" result.
  let inserted = false
  const result = async () => ({
    data: null,
    error: null,
    count: null,
    ...((inserted && db.tables[`${who}:${table}:created`]) || db.tables[`${who}:${table}`] || {}),
  })
  const c: Record<string, unknown> = {}
  for (const m of ["in", "is", "gte", "order", "limit", "update", "delete"]) c[m] = () => c
  c.eq = (col: string, value: unknown) => {
    db.filters.push(`${who}:${table}.${col}=${String(value)}`)
    return c
  }
  c.select = (columns: string) => {
    db.selects.push(`${who}:${table}: ${columns}`)
    return c
  }
  c.insert = () => {
    db.inserts.push(table)
    inserted = true
    return c
  }
  c.maybeSingle = result
  c.single = result
  c.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => result().then(ok, ko)
  return c
}
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => chain(table, "admin") }),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: db.user } }) },
    from: (table: string) => chain(table, "user"),
  }),
}))
vi.mock("@/lib/ai/rate-limit", () => ({ checkAiRateLimitAsync: async () => true }))

beforeEach(() => {
  db.tables = {}
  db.inserts = []
  db.selects = []
  db.filters = []
  db.user = { id: "teacher-1" }
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("/api/teams: a timed activity past its time takes no new team", () => {
  const join = () =>
    new Request("https://pamokos.kusteam.app/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game_code: "ABC123", team_name: "Vėluojantys" }),
    })
  const game = (settings: Record<string, unknown>, more: Record<string, unknown> = {}) => ({
    data: { id: "g1", settings, starts_at: iso(START), paused_ms: 0, paused_at: null, ...more },
  })
  const newTeam = { data: { id: "t1", name: "Vėluojantys" } }

  it("refuses with a clear Lithuanian message once the limit since the activity's start has passed", async () => {
    vi.useFakeTimers({ now: START + 31 * MIN })
    const { POST } = await import("@/app/api/teams/route")
    db.tables["admin:games"] = game({ time_limit_minutes: 30 })
    const res = await POST(join())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe("time_over")
    expect(body.error).toBe(
      "Šios veiklos laikas baigėsi, todėl naujos komandos nebepriimamos. Jei veikla dar vyksta, kreipkitės į vedėją."
    )
    expect(body.error).not.toMatch(/[—–]/)
    expect(db.inserts).toEqual([])
  })

  it("a team that joins late but in time is accepted (and keeps its own full time)", async () => {
    vi.useFakeTimers({ now: START + 29 * MIN })
    const { POST } = await import("@/app/api/teams/route")
    db.tables["admin:games"] = game({ time_limit_minutes: 30 })
    db.tables["admin:teams:created"] = newTeam
    const res = await POST(join())
    expect(res.status).toBe(201)
    expect(db.inserts).toEqual(["teams"])
  })

  it("an extension or pause time opens joining again; no limit never closes it", async () => {
    vi.useFakeTimers({ now: START + 35 * MIN })
    const { POST } = await import("@/app/api/teams/route")
    for (const row of [
      game({ time_limit_minutes: 40 }),
      game({ time_limit_minutes: 30 }, { paused_ms: 6 * MIN }),
      game({ time_limit_minutes: null }),
      game({}),
    ]) {
      db.inserts = []
      db.tables["admin:games"] = row
      db.tables["admin:teams:created"] = newTeam
      expect((await POST(join())).status).toBe(201)
      expect(db.inserts).toEqual(["teams"])
    }
  })

  it("the facilitator's own 'joining closed' is still said first", async () => {
    vi.useFakeTimers({ now: START + 31 * MIN })
    const { POST } = await import("@/app/api/teams/route")
    db.tables["admin:games"] = game({ time_limit_minutes: 30, joining_closed: true })
    expect((await (await POST(join())).json()).code).toBe("joining_closed")
  })
})

describe("/api/games/[gameId]/team-clocks: team starts for the facilitator", () => {
  const call = async () => {
    const { GET } = await import("@/app/api/games/[gameId]/team-clocks/route")
    return GET(new Request("https://pamokos.kusteam.app/api/games/g1/team-clocks"), {
      params: Promise.resolve({ gameId: "g1" }),
    })
  }

  it("needs a signed-in owner: the activity is read under the facilitator's session first", async () => {
    db.user = null
    expect((await call()).status).toBe(401)
    db.user = { id: "teacher-1" }
    // Not this account's activity: RLS and the owner filter give no row.
    const res = await call()
    expect(res.status).toBe(404)
    expect(db.filters).toContain("user:games.teacher_id=teacher-1")
    // Nothing was read with the service role.
    expect(db.selects.filter((s) => s.startsWith("admin:"))).toEqual([])
  })

  it("returns ids and times only", async () => {
    db.tables["user:games"] = {
      data: { id: "g1", status: "active", settings: { time_limit_minutes: 30 }, starts_at: iso(START), paused_ms: "120000", paused_at: null },
    }
    db.tables["admin:teams"] = {
      data: [
        { id: "t1", started_at: iso(START + MIN), pause_offset_ms: "0" },
        { id: "t2", started_at: null, pause_offset_ms: 0 },
      ],
    }
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    const body = await res.json()
    expect(body).toMatchObject({
      status: "active",
      time_limit_minutes: 30,
      starts_at: iso(START),
      paused_ms: 120000,
      paused_at: null,
      teams: [
        { id: "t1", started_at: iso(START + MIN), pause_offset_ms: 0 },
        { id: "t2", started_at: null, pause_offset_ms: 0 },
      ],
    })
    expect(Number.isFinite(Date.parse(body.now))).toBe(true)
    expect(db.selects).toContain("admin:teams: id, started_at, pause_offset_ms")
    expect(db.filters).toContain("admin:teams.game_id=g1")
    expect(db.selects.join("\n")).not.toMatch(/session_token|answer|hash|hint/)
  })

  it("reads no team without a time limit", async () => {
    db.tables["user:games"] = { data: { id: "g1", status: "active", settings: {}, starts_at: iso(START), paused_ms: 0, paused_at: null } }
    const body = await (await call()).json()
    expect(body.time_limit_minutes).toBeNull()
    expect(body.teams).toEqual([])
    expect(db.selects.filter((s) => s.startsWith("admin:"))).toEqual([])
  })
})

describe("the facilitator's screens say what the time means", () => {
  const read = (file: string) => readFileSync(file, "utf8")

  it("the class screen labels its countdown and shows the last team's own deadline", () => {
    const view = read("components/teacher/live-view.tsx")
    expect(view).toContain('"Liko nuo veiklos pradžios (pauzė)" : "Liko nuo veiklos pradžios"')
    // The bare label that read as every team's time is gone.
    expect(view).not.toMatch(/"Liko laiko( \(pauzė\))?"/)
    expect(view).toContain("Vėliausiai pradėjusiai komandai liko")
    expect(view).toContain("Komandos laikas skaičiuojamas nuo jos pradžios")
    expect(view).toContain("Naujos komandos nebepriimamos")
    expect(view).toContain("latestTeamSecondsLeft(")
  })

  it("the team list shows each team's own time and explains the rule", () => {
    const progress = read("components/teacher/live-team-progress.tsx")
    expect(progress).toContain("teamTimeLabel(time)")
    expect(progress).toContain("Laiko limitas skaičiuojamas kiekvienai komandai atskirai")
    expect(progress).toContain("naujos komandos nebepriimamos")
    expect(read("components/teacher/live-control-center.tsx")).toContain("timeLimit={settings.time_limit_minutes}")
  })

  it("team starts reach the browser only through the server route", () => {
    const hook = read("hooks/use-team-clocks.ts")
    expect(hook).toContain("/api/games/${gameId}/team-clocks")
    expect(hook).not.toContain("@/lib/supabase/client")
  })
})
