import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "fs"
import { createRejoinToken } from "@/lib/game/rejoin-token"

// Audit R-13, scenario P10: the facilitator's "Grąžinti į komandą" link works
// once and moves the team's session. The new device gets a new session
// token, the old device is signed out and told the team continues elsewhere.
// No migration is involved: it works on the database as it is.

type Result = { data?: unknown; error?: { code?: string; message?: string } | null }
type Filter = [column: string, value: unknown]

const TEAM = "30000000-0000-4000-8000-0000000000a1"
const OLD_SESSION = "old-session-token"

const db = {
  /** The team's row as the database has it; the update below changes it. */
  team: null as { id: string; name: string; session_token: string; game_id: string } | null,
  game: { id: "g1", game_code: "ABC123", status: "active" },
  failRead: false,
  failUpdate: false,
  updates: [] as { values: Record<string, unknown>; filters: Filter[] }[],
  rpcs: {} as Record<string, Result>,
}

/** Enough of the query builder for the routes under test, over db.team. */
function teams() {
  const filters: Filter[] = []
  let update: Record<string, unknown> | null = null
  const matches = () => db.team !== null && filters.every(([col, value]) => (db.team as Record<string, unknown>)[col] === value)
  const run = async () => {
    if (update) {
      db.updates.push({ values: update, filters: [...filters] })
      if (db.failUpdate) return { data: null, error: { code: "57014", message: "timeout" } }
      if (!matches()) return { data: [], error: null }
      Object.assign(db.team!, update)
      return { data: [{ id: db.team!.id }], error: null }
    }
    if (db.failRead) return { data: null, error: { code: "57014", message: "timeout" } }
    return { data: matches() ? { ...db.team, games: { game_code: db.game.game_code, status: db.game.status } } : null, error: null }
  }
  const c: Record<string, unknown> = {}
  c.select = () => c
  c.eq = (col: string, value: unknown) => {
    filters.push([col, value])
    return c
  }
  c.update = (values: Record<string, unknown>) => {
    update = values
    return c
  }
  c.maybeSingle = run
  c.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => run().then(ok, ko)
  return c
}

function other(table: string) {
  const c: Record<string, unknown> = {}
  const result = async () => ({ data: table === "hint_reveals" ? [] : null, error: null })
  for (const m of ["select", "eq", "in", "order", "limit"]) c[m] = () => c
  c.maybeSingle = result
  c.single = result
  c.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => result().then(ok, ko)
  return c
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => (table === "teams" ? teams() : other(table)),
    rpc: async (fn: string) => ({ data: null, error: null, ...(db.rpcs[fn] ?? {}) }),
  }),
}))
vi.mock("@/lib/ai/rate-limit", () => ({ checkAiRateLimitAsync: async () => true }))

const post = (token: string) =>
  new Request("https://pamokos.kusteam.app/api/play/rejoin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ game_code: "ABC123", token }),
  })

beforeAll(() => {
  process.env.REJOIN_SECRET = "test-secret-for-rejoin"
})
beforeEach(() => {
  db.team = { id: TEAM, name: "Ąžuolai", session_token: OLD_SESSION, game_id: "g1" }
  db.game = { id: "g1", game_code: "ABC123", status: "active" }
  db.failRead = false
  db.failUpdate = false
  db.updates = []
  db.rpcs = {}
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe("/api/play/rejoin: the link works once and moves the session", () => {
  it("gives the new device a new session token and takes the old one away", async () => {
    const { POST } = await import("@/app/api/play/rejoin/route")
    const { token } = createRejoinToken(TEAM, OLD_SESSION)
    const res = await POST(post(token))
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    const body = await res.json()
    expect(body.team_id).toBe(TEAM)
    expect(body.team_name).toBe("Ąžuolai")
    expect(body.session_token).toMatch(/^[a-z0-9]{32}$/)
    expect(body.session_token).not.toBe(OLD_SESSION)
    // The database now knows only the new token: the old device is out.
    expect(db.team?.session_token).toBe(body.session_token)
    // The swap is conditional on the token the link was made for.
    expect(db.updates).toEqual([
      {
        values: { session_token: body.session_token },
        filters: [
          ["id", TEAM],
          ["session_token", OLD_SESSION],
        ],
      },
    ])
  })

  it("refuses the same link a second time, and every older link with it", async () => {
    const { POST } = await import("@/app/api/play/rejoin/route")
    const first = createRejoinToken(TEAM, OLD_SESSION).token
    const sibling = createRejoinToken(TEAM, OLD_SESSION, Date.now() - 60_000).token
    expect((await POST(post(first))).status).toBe(200)
    const moved = db.team?.session_token
    for (const link of [first, sibling]) {
      const again = await POST(post(link))
      expect(again.status).toBe(410)
      const body = await again.json()
      expect(body).toEqual({ error: "Ši nuoroda jau panaudota. Paprašykite vedėjo naujos.", code: "used" })
      expect(body.session_token).toBeUndefined()
    }
    // The second device did not take the session from the first.
    expect(db.team?.session_token).toBe(moved)
    expect(db.updates).toHaveLength(1)
  })

  it("a link made after the move works, once", async () => {
    const { POST } = await import("@/app/api/play/rejoin/route")
    expect((await POST(post(createRejoinToken(TEAM, OLD_SESSION).token))).status).toBe(200)
    const fresh = createRejoinToken(TEAM, db.team!.session_token).token
    expect((await POST(post(fresh))).status).toBe(200)
    expect((await POST(post(fresh))).status).toBe(410)
  })

  it("of two devices opening the link at the same moment only one gets the session", async () => {
    const { POST } = await import("@/app/api/play/rejoin/route")
    const { token } = createRejoinToken(TEAM, OLD_SESSION)
    // Both read the team before either writes.
    const results = await Promise.all([POST(post(token)), POST(post(token))])
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([200, 410])
    const winner = await results.find((r) => r.status === 200)!.json()
    expect(db.team?.session_token).toBe(winner.session_token)
  })

  it("a failed swap changes nothing and may be tried again with the same link", async () => {
    const { POST } = await import("@/app/api/play/rejoin/route")
    const { token } = createRejoinToken(TEAM, OLD_SESSION)
    db.failUpdate = true
    const failed = await POST(post(token))
    expect(failed.status).toBe(503)
    expect(db.team?.session_token).toBe(OLD_SESSION)
    db.failUpdate = false
    expect((await POST(post(token))).status).toBe(200)
  })

  it("keeps the earlier refusals: forged, expired, removed team, finished activity", async () => {
    const { POST } = await import("@/app/api/play/rejoin/route")
    const { token } = createRejoinToken(TEAM, OLD_SESSION)
    const forged = await POST(post(token.slice(0, -2) + "xx"))
    expect([forged.status, (await forged.json()).code]).toEqual([400, "invalid"])
    const expired = await POST(post(createRejoinToken(TEAM, OLD_SESSION, Date.now() - 11 * 60_000).token))
    expect([expired.status, (await expired.json()).code]).toEqual([400, "expired"])
    db.game.status = "finished"
    const over = await POST(post(token))
    expect([over.status, (await over.json()).code]).toEqual([409, "not_live"])
    db.game.status = "active"
    db.team = null
    const gone = await POST(post(token))
    expect([gone.status, (await gone.json()).code]).toEqual([404, "not_found"])
    expect(db.updates).toEqual([])
  })
})

describe("/api/play/state: the old device learns that the team moved", () => {
  const get = (headers: Record<string, string>) =>
    new Request("https://pamokos.kusteam.app/api/play/state?game_code=ABC123", { headers })
  const stateWithoutTeam = { game: { id: "g1", title: "Veikla", status: "active", settings: {} }, challenges: [], team: null, solved: [] }

  it("a session without a team, whose team is still in the activity, is 'moved'", async () => {
    const { GET } = await import("@/app/api/play/state/route")
    db.team!.session_token = "the-new-session-token"
    db.rpcs.get_player_game_state = { data: stateWithoutTeam }
    const res = await GET(get({ "x-session-token": OLD_SESSION, "x-team-id": TEAM }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.team).toBeNull()
    expect(body.session_moved).toBe(true)
    // Nothing of the team or its tasks comes with it.
    expect(body.challenges).toEqual([])
    expect(JSON.stringify(body)).not.toContain("the-new-session-token")
  })

  it("a removed team, another activity's team or no team id is not 'moved'", async () => {
    const { GET } = await import("@/app/api/play/state/route")
    db.rpcs.get_player_game_state = { data: stateWithoutTeam }
    // No team id sent (an older page).
    expect((await (await GET(get({ "x-session-token": OLD_SESSION }))).json()).session_moved).toBeUndefined()
    // Not a team id at all.
    expect(
      (await (await GET(get({ "x-session-token": OLD_SESSION, "x-team-id": "x" }))).json()).session_moved
    ).toBeUndefined()
    // The team belongs to another activity.
    db.team!.game_id = "g2"
    expect(
      (await (await GET(get({ "x-session-token": OLD_SESSION, "x-team-id": TEAM }))).json()).session_moved
    ).toBeUndefined()
    // The team was removed.
    db.team = null
    expect(
      (await (await GET(get({ "x-session-token": OLD_SESSION, "x-team-id": TEAM }))).json()).session_moved
    ).toBeUndefined()
  })

  it("a session that has its team, and a visitor without a session, are never 'moved'", async () => {
    const { GET } = await import("@/app/api/play/state/route")
    db.rpcs.get_player_game_state = { data: { ...stateWithoutTeam, team: { id: TEAM, name: "Ąžuolai" } } }
    expect(
      (await (await GET(get({ "x-session-token": OLD_SESSION, "x-team-id": TEAM }))).json()).session_moved
    ).toBeUndefined()
    db.rpcs.get_player_game_state = { data: stateWithoutTeam }
    expect((await (await GET(get({ "x-team-id": TEAM }))).json()).session_moved).toBeUndefined()
  })
})

describe("the pages around the move", () => {
  const read = (file: string) => readFileSync(file, "utf8")

  it("the old device shows 'the team continues on another device', not the join form or an error loop", () => {
    const page = read("app/play/[gameCode]/play/page.tsx")
    // Asked twice, as for a removed team; then the session is dropped and
    // the moved screen is shown instead of the redirect.
    expect(page).toMatch(
      /clearPlayerSession\(gameCode\)[\s\S]{0,300}if \(again\.session_moved\) setMovedTeamName\(s\.team_name \|\| ""\)\s+else router\.replace\(`\/play\/\$\{gameCode\}`\)/
    )
    expect(page).toMatch(/if \(movedTeamName !== null\) \{\s+return <PlaySessionMoved teamName=\{movedTeamName\} gameCode=\{gameCode\} \/>/)
    // The moved screen comes before the load-error screen, which retries.
    expect(page.indexOf("<PlaySessionMoved")).toBeLessThan(page.indexOf("<PlayLoadError"))
    // Every state read names the team, so the server can tell.
    expect(page.match(/"x-team-id": s(?:ession)?\.team_id/g)).toHaveLength(3)
    // A refused answer, hint or start re-reads the state instead of looping.
    expect(page).toMatch(/if \(res\.status === 401\) setSessionCheck/)
    expect(page).toMatch(/if \(server === "no-team"\) setSessionCheck/)

    const screens = read("components/player/play-screens.tsx")
    const moved = screens.slice(screens.indexOf("export function PlaySessionMoved"), screens.indexOf("export function PlayPreparing"))
    expect(moved).toContain("Komanda tęsia kitame įrenginyje")
    expect(moved).toContain("paprašykite vedėjo naujos nuorodos arba QR kodo")
    expect(moved).not.toMatch(/[—–]/)
    // Nothing to retry on it.
    expect(moved).not.toContain("onRetry")
  })

  it("the rejoin page sends the link once even when its effect runs twice", () => {
    const page = read("app/play/[gameCode]/grizti/page.tsx")
    expect(page).toMatch(/exchangeRef\.current \?\?= fetch\("\/api\/play\/rejoin"/)
    expect(page.match(/fetch\("\/api\/play\/rejoin"/g)).toHaveLength(1)
  })

  it("the facilitator is told the code works once and signs the old device out", () => {
    const dialog = read("components/teacher/team-rejoin-dialog.tsx")
    expect(dialog).toContain("tinka vieną kartą")
    expect(dialog).toContain("ankstesnis komandos įrenginys")
    expect(dialog).not.toMatch(/[—–]/)
  })

  it("the link is made for the team's current session, read on the server only", () => {
    const route = read("app/api/games/[gameId]/teams/[teamId]/rejoin/route.ts")
    expect(route).toMatch(/createRejoinToken\(team\.id, session\.session_token as string\)/)
    // Ownership is checked under the facilitator's own session first.
    expect(route.indexOf('.eq("teacher_id", user.id)')).toBeLessThan(route.indexOf("createAdminClient()"))
    // The answer carries the link, never the token.
    expect(route).not.toMatch(/NextResponse\.json\([^)]*session_token/)
  })
})
