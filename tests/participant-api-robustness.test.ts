import { readFileSync } from "fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { serverNowMs } from "@/lib/game/clock"
import { RETRY_LATER_MESSAGE } from "@/lib/api/retry-later"
import { AccessDeniedError, requireRole } from "@/lib/auth/roles"
import type { SupabaseClient } from "@supabase/supabase-js"

// A failed database read must never look like "not found" to a participant
// (that ends the team's session), expected denials must not be logged as
// errors (N-5), and the status poll may be shared by the CDN only because
// it is the same for every team (N-2).

const read = (file: string) => readFileSync(file, "utf8")

type Result = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null }
const FAILED: Result = { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }
const NO_ROW: Result = { data: null, error: null }

const db = {
  tables: {} as Record<string, Result>,
  rpcs: {} as Record<string, Result>,
  selects: [] as string[],
}

/** Every builder method returns the chain; awaiting it gives the table's scripted result. */
function chain(table: string) {
  const result = async () => ({ data: null, error: null, count: null, ...(db.tables[table] ?? NO_ROW) })
  const c: Record<string, unknown> = {}
  for (const m of ["eq", "in", "is", "gte", "order", "limit", "insert", "update", "delete"]) c[m] = () => c
  c.select = (columns: string) => {
    db.selects.push(`${table}: ${columns}`)
    return c
  }
  c.maybeSingle = result
  c.single = result
  c.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => result().then(ok, ko)
  return c
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => chain(table),
    rpc: async (fn: string) => ({ data: null, error: null, ...(db.rpcs[fn] ?? {}) }),
  }),
}))
vi.mock("@/lib/ai/rate-limit", () => ({ checkAiRateLimitAsync: async () => true }))
vi.mock("@/lib/game/rejoin-token", () => ({
  verifyRejoinToken: () => ({ ok: true, teamId: "00000000-0000-4000-8000-0000000000a1" }),
}))

const TOKEN = "team-session-token"
const TASK = "00000000-0000-4000-8000-0000000000c1"
const ORIGIN = "https://pamokos.kusteam.app"

const post = (path: string, body: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
const get = (path: string, headers: Record<string, string> = {}) => new Request(`${ORIGIN}${path}`, { headers })

let errors: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  db.tables = {}
  db.rpcs = {}
  db.selects = []
  errors = vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

async function expectRetry(res: Response) {
  expect(res.status).toBe(503)
  expect(res.headers.get("cache-control")).toBe("no-store")
  expect(res.headers.get("retry-after")).toBe("2")
  const body = await res.json()
  expect(body).toEqual({ error: RETRY_LATER_MESSAGE, code: "retry" })
  // A real failure stays in the server log.
  expect(errors.mock.calls.some((call: unknown[]) => String(call[0]).includes("participant_read_failed"))).toBe(true)
}

describe("a failed team read is not 'team not found'", () => {
  it("retry message is Lithuanian, without an em dash", () => {
    expect(RETRY_LATER_MESSAGE).toMatch(/Bandykite dar kartą/)
    expect(RETRY_LATER_MESSAGE).not.toMatch(/[—–]/)
  })

  it("/api/play/state: a failed state read answers 503, never a state without the team", async () => {
    const { GET } = await import("@/app/api/play/state/route")
    db.rpcs.get_player_game_state = FAILED
    await expectRetry(await GET(get("/api/play/state?game_code=ABC123", { "x-session-token": TOKEN })))
  })

  it("/api/play/state fallback: a failed team read answers 503", async () => {
    const { GET } = await import("@/app/api/play/state/route")
    db.rpcs.get_player_game_state = { data: null, error: { code: "PGRST202", message: "not deployed" } }
    db.tables.games = { data: { id: "g1", title: "Veikla", description: null, status: "active", settings: {} } }
    db.tables.challenges = { data: [] }
    db.tables.teams = FAILED
    await expectRetry(await GET(get("/api/play/state?game_code=ABC123", { "x-session-token": TOKEN })))
  })

  it("/api/play/state fallback: a failed activity read answers 503, not 'no such activity'", async () => {
    const { GET } = await import("@/app/api/play/state/route")
    db.rpcs.get_player_game_state = { data: null, error: { code: "42883", message: "not deployed" } }
    db.tables.games = FAILED
    await expectRetry(await GET(get("/api/play/state?game_code=ABC123")))
  })

  it("/api/play/state fallback: a team that is really gone is still answered as team: null", async () => {
    const { GET } = await import("@/app/api/play/state/route")
    db.rpcs.get_player_game_state = { data: null, error: { code: "PGRST202", message: "not deployed" } }
    db.tables.games = { data: { id: "g1", title: "Veikla", description: null, status: "active", settings: {} } }
    db.tables.challenges = { data: [] }
    db.tables.teams = NO_ROW
    db.tables.hint_reveals = { data: [] }
    const res = await GET(get("/api/play/state?game_code=ABC123", { "x-session-token": TOKEN }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.team).toBeNull()
    expect(body.game.status).toBe("active")
  })

  it("/api/submissions: failed read 503, missing team 401", async () => {
    const { POST } = await import("@/app/api/submissions/route")
    const body = { session_token: TOKEN, challenge_id: TASK, answer: "42" }
    db.tables.teams = FAILED
    await expectRetry(await POST(post("/api/submissions", body)))

    errors.mockClear()
    db.tables.teams = NO_ROW
    const res = await POST(post("/api/submissions", body))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe("Sesija nerasta. Prisijunkite iš naujo.")
    expect(errors).not.toHaveBeenCalled()
  })

  it("/api/submissions: a failed activity or task read is 503, not 'unavailable' or 'not found'", async () => {
    const { POST } = await import("@/app/api/submissions/route")
    db.tables.teams = { data: { id: "t1", game_id: "g1", total_points: 0, current_challenge_index: 0 } }
    db.tables.games = FAILED
    await expectRetry(await POST(post("/api/submissions", { session_token: TOKEN, challenge_id: TASK, answer: "42" })))
  })

  it("/api/play/hint: failed read 503, missing team 401", async () => {
    const { POST } = await import("@/app/api/play/hint/route")
    const body = { session_token: TOKEN, challenge_id: TASK, hint_index: 0 }
    db.tables.teams = FAILED
    await expectRetry(await POST(post("/api/play/hint", body)))
    db.tables.teams = NO_ROW
    expect((await POST(post("/api/play/hint", body))).status).toBe(401)
  })

  it("/api/play/start: failed read 503, missing team 404", async () => {
    const { POST } = await import("@/app/api/play/start/route")
    db.tables.teams = FAILED
    await expectRetry(await POST(post("/api/play/start", { session_token: TOKEN })))
    db.tables.teams = NO_ROW
    expect((await POST(post("/api/play/start", { session_token: TOKEN }))).status).toBe(404)
  })

  it("/api/play/rejoin: failed read 503, removed team 404", async () => {
    const { POST } = await import("@/app/api/play/rejoin/route")
    const body = { game_code: "ABC123", token: "signed" }
    db.tables.teams = FAILED
    await expectRetry(await POST(post("/api/play/rejoin", body)))
    db.tables.teams = NO_ROW
    const res = await POST(post("/api/play/rejoin", body))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe("not_found")
  })

  it("the play page drops the session only after two answers without the team", () => {
    const page = read("app/play/[gameCode]/play/page.tsx")
    // Any non-200 (so also 503) is "no answer": the error screen retries.
    expect(page).toMatch(/const fetchState = async[\s\S]*?if \(!res\.ok\) return null/)
    expect(page).toMatch(
      /if \(state\.team === null && state\.game\.status !== "draft"\) \{\s+const again = await fetchState\(\)\s+if \(!again \|\| !again\.game\) \{\s+setLoadError\(true\)\s+return\s+\}\s+if \(again\.team === null && again\.game\.status !== "draft"\) \{\s+clearPlayerSession\(gameCode\)/
    )
    // Only 401 from an answer sends the page to check its session.
    expect(page.match(/if \(res\.status === 401\) void loadChallenges\(session, true\)/g)).toHaveLength(2)
    // The session is cleared there and when the team leaves on purpose.
    expect(page.match(/clearPlayerSession\(gameCode\)/g)).toHaveLength(2)
  })

  it("the join page says 'try again', not 'not found', for a server failure", () => {
    const page = read("app/play/[gameCode]/page.tsx")
    expect(page).toMatch(
      /if \(res\.status === 404 \|\| res\.status === 400\) \{\s+setGameState\(\{ status: "not_found" \}\)\s+return\s+\}\s+if \(!res\.ok\) \{\s+setGameState\(\{ status: "error" \}\)/
    )
  })
})

describe("expected denials are not logged as errors (N-5)", () => {
  const join = { game_code: "ABC123", team_name: "Ąžuolai" }

  it("/api/teams: an unknown or closed code is a quiet 404", async () => {
    const { POST } = await import("@/app/api/teams/route")
    db.tables.games = NO_ROW
    const res = await POST(post("/api/teams", join))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("Veikla nerasta arba dar neprasidėjo. Patikrinkite kodą.")
    expect(errors).not.toHaveBeenCalled()
  })

  it("/api/teams: a failed activity read is logged and asks to try again", async () => {
    const { POST } = await import("@/app/api/teams/route")
    db.tables.games = FAILED
    await expectRetry(await POST(post("/api/teams", join)))
  })

  it("/api/teams does not use .single() for the activity (no row would be an error)", () => {
    const route = read("app/api/teams/route.ts")
    expect(route).not.toContain('console.error("Game lookup failed')
    expect(route).toMatch(/\.eq\("status", "active"\)\s+\.maybeSingle\(\)/)
  })

  it("requireRole throws a denial that callers can tell from a failure", async () => {
    const teacher = {
      rpc: async () => ({ data: "teacher", error: null }),
    } as unknown as SupabaseClient
    await expect(requireRole(teacher, "admin", "super_admin")).rejects.toBeInstanceOf(AccessDeniedError)
    await expect(requireRole(teacher, "admin", "super_admin")).rejects.toThrow(/Prieiga uždrausta/)
  })

  it("/admin/veiklos redirects a facilitator instead of throwing", () => {
    const page = read("app/(teacher)/admin/veiklos/page.tsx")
    expect(page).toMatch(
      /try \{\s+await requireRole\(supabase, "admin", "super_admin"\)\s+\} catch \(e\) \{\s+if \(e instanceof AccessDeniedError\) redirect\("\/dashboard"\)\s+throw e\s+\}/
    )
    // The role check still comes before the service-role read.
    expect(page.indexOf("await requireRole(")).toBeLessThan(page.indexOf("createAdminClient()"))
  })
})

describe("/api/play/status is shared by the CDN for 2 s (N-2)", () => {
  const game = {
    status: "paused",
    settings: { time_limit_minutes: 30, allow_access_requests: true },
    paused_ms: 1000,
    paused_at: "2026-11-23T10:00:00.000Z",
    resumed_at: null,
    challenges: [{ id: TASK, updated_at: "2026-11-23T09:00:00.000Z" }],
    announcements: [],
  }

  it("answers the same for every team and tells only the CDN to keep it", async () => {
    const { GET } = await import("@/app/api/play/status/route")
    db.tables.games = { data: game }
    const a = await GET(get("/api/play/status?game_code=abc123", { "x-session-token": "team-a" }))
    const b = await GET(get("/api/play/status?game_code=abc123", { "x-session-token": "team-b" }))
    expect(a.status).toBe(200)
    expect(a.headers.get("cache-control")).toBe("private, no-store")
    expect(a.headers.get("cdn-cache-control")).toBe("public, s-maxage=2")
    expect(a.headers.get("vercel-cdn-cache-control")).toBe("public, s-maxage=2")
    expect(a.headers.get("set-cookie")).toBeNull()
    const strip = ({ now, ...rest }: Record<string, unknown>) => (expect(typeof now).toBe("string"), rest)
    const bodyA = strip(await a.json())
    expect(bodyA).toEqual(strip(await b.json()))
    expect(Object.keys(bodyA).sort()).toEqual([
      "allow_access_requests",
      "announcement",
      "paused_at",
      "paused_ms",
      "resumed_at",
      "status",
      "tasks_version",
      "time_limit_minutes",
    ])
    expect(bodyA.status).toBe("paused")
  })

  it("reads nothing about the caller and no answers, hashes or hints", async () => {
    const { GET } = await import("@/app/api/play/status/route")
    db.tables.games = { data: game }
    await GET(get("/api/play/status?game_code=ABC123"))
    expect(db.selects).toHaveLength(1)
    expect(db.selects[0]).toMatch(/^games: /)
    expect(db.selects[0]).not.toMatch(/answer|hash|hint|session_token|teams|submissions|explanation/)

    const route = read("app/api/play/status/route.ts")
    expect(route).not.toMatch(/request\.headers|cookies\(|x-session-token"\)|session_token=/)
    // A late pause must not be served from a stale copy (one phone polling
    // every 5 s would always get the previous answer).
    expect(route).not.toMatch(/stale-while-revalidate=/)
    expect(route).toContain("const STATUS_CDN_SECONDS = 2")
  })

  it("never shares a failure or 'no such activity'", async () => {
    const { GET } = await import("@/app/api/play/status/route")
    db.tables.games = NO_ROW
    const missing = await GET(get("/api/play/status?game_code=ABC123"))
    expect(missing.status).toBe(200)
    expect(await missing.json()).toEqual({ status: null })
    expect(missing.headers.get("cache-control")).toBe("no-store")
    expect(missing.headers.get("cdn-cache-control")).toBeNull()

    // A failed read is a failed poll (503), not "the activity was deleted".
    db.tables.games = FAILED
    const failed = await GET(get("/api/play/status?game_code=ABC123"))
    expect(failed.headers.get("cdn-cache-control")).toBeNull()
    await expectRetry(failed)
  })

  it("the page adds the CDN's Age back to the server time", () => {
    const now = "2026-11-23T10:00:00.000Z"
    const ms = Date.parse(now)
    expect(serverNowMs(now, null)).toBe(ms)
    expect(serverNowMs(now, "0")).toBe(ms)
    expect(serverNowMs(now, "2")).toBe(ms + 2000)
    // A broken or implausible header is ignored.
    expect(serverNowMs(now, "abc")).toBe(ms)
    expect(serverNowMs(now, "-3")).toBe(ms)
    expect(serverNowMs(now, "86400")).toBe(ms)
    expect(Number.isNaN(serverNowMs(undefined, "2"))).toBe(true)
    expect(read("app/play/[gameCode]/play/page.tsx")).toContain('serverNowMs(data.now, res.headers.get("age"))')
  })
})
