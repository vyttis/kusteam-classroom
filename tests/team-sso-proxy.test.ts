import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { CLIENT_SESSION, SSO_SESSION, fakeAccessToken, queryDouble, silenceConsole } from "./helpers/team-sso"

// proxy.ts: KU STEAM TEAM staff are checked on every facilitator page and
// API request (team_staff_access_ok, no cache); teachers are not touched.

type Role = "teacher" | "admin" | "super_admin" | "staff"

interface UserState {
  role: Role
  status?: string
  accessOk?: boolean | "error"
  endReason?: string | null
}

const users = new Map<string, UserState>()
let currentUserId: string | null = null
const counters = { profileReads: 0, accessChecks: 0, signOuts: [] as string[], adminCalls: 0 }
let lastCookieMethods: { setAll: (c: { name: string; value: string; options: Record<string, unknown> }[]) => void } | null = null

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, options: { cookies: typeof lastCookieMethods }) => {
    lastCookieMethods = options.cookies
    const id = currentUserId
    return {
      auth: {
        getUser: async () => ({ data: { user: id ? { id } : null }, error: null }),
        getSession: async () => ({
          data: { session: id ? { access_token: fakeAccessToken({ sub: id, session_id: CLIENT_SESSION }) } : null },
          error: null,
        }),
        signOut: async (o: { scope: string }) => {
          counters.signOuts.push(o.scope)
          lastCookieMethods!.setAll([{ name: "sb-test-auth-token", value: "", options: { path: "/", maxAge: 0 } }])
          return { error: null }
        },
      },
      from: (table: string) => {
        if (table !== "profiles") throw new Error(`unexpected table ${table}`)
        counters.profileReads++
        const u = id ? users.get(id) : undefined
        return queryDouble({
          data: u ? { onboarding_completed: true, status: u.status ?? "active", role: u.role } : null,
          error: null,
        })
      },
      rpc: async (fn: string) => {
        if (fn !== "team_staff_access_ok") throw new Error(`unexpected rpc ${fn}`)
        counters.accessChecks++
        const u = users.get(id!)!
        if (u.accessOk === "error") return { data: null, error: { code: "57P01" } }
        // The real function is true for everyone who is not staff.
        return { data: u.role !== "staff" || u.accessOk !== false, error: null }
      },
    }
  }),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    counters.adminCalls++
    const u = users.get(currentUserId!)
    return {
      from: () => queryDouble({ data: u?.endReason === null ? null : { id: SSO_SESSION }, error: null }),
      rpc: async (fn: string) => {
        if (fn !== "team_sso_session_status") throw new Error(`unexpected admin rpc ${fn}`)
        return { data: [{ active: false, reason: u?.endReason ?? "unknown", user_id: currentUserId, expires_at: null }], error: null }
      },
    }
  },
}))

const { proxy } = await import("@/proxy")

let n = 0
function signIn(state: UserState): string {
  // A new id per test: the proxy's 30 s gate cache is module-level.
  const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  users.set(id, state)
  currentUserId = id
  return id
}

function request(path: string, init: { method?: string; host?: string } = {}) {
  const host = init.host ?? "pamokos.kusteam.app"
  return new NextRequest(`https://${host}${path}`, { method: init.method ?? "GET", headers: { host } })
}

const passes = (res: Response) => res.headers.get("x-middleware-next") === "1"

let consoleCapture: ReturnType<typeof silenceConsole>
const ENV = { ...process.env }
beforeEach(() => {
  process.env.TEAM_SSO_ENABLED = "1"
  delete process.env.CANONICAL_CLASSROOM_HOST
  counters.profileReads = 0
  counters.accessChecks = 0
  counters.signOuts = []
  counters.adminCalls = 0
  consoleCapture = silenceConsole()
})
afterEach(() => {
  consoleCapture.restore()
  process.env = { ...ENV }
  currentUserId = null
})

describe("proxy: TEAM staff gate", () => {
  it("lets staff with an active TEAM sign-in through", async () => {
    signIn({ role: "staff", accessOk: true })
    expect(passes(await proxy(request("/dashboard")))).toBe(true)
    expect(passes(await proxy(request("/api/games")))).toBe(true)
    expect(counters.signOuts).toEqual([])
  })

  it("signs staff out (local) and shows the message page when access has ended", async () => {
    signIn({ role: "staff", accessOk: false, endReason: "grant_revoked" })
    const res = await proxy(request("/games/abc/live"))
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("https://pamokos.kusteam.app/auth/team/pranesimas?p=nesuteikta")
    expect(counters.signOuts).toEqual(["local"])
    expect(res.headers.getSetCookie().some((c) => c.startsWith("sb-test-auth-token=;") && /Max-Age=0/.test(c))).toBe(true)
  })

  it("answers 401 on facilitator APIs when access has ended", async () => {
    signIn({ role: "staff", accessOk: false, endReason: "logged_out" })
    const res = await proxy(request("/api/games/abc", { method: "PATCH" }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Atsijungėte nuo KU STEAM TEAM. Norėdami tęsti, prisijunkite iš naujo." })
    expect(counters.signOuts).toEqual(["local"])
  })

  it("maps the reason to the contract message", async () => {
    const cases: [string | null, string][] = [
      ["blocked", "sustabdyta"],
      ["not_member", "nesuteikta"],
      ["logged_out", "atsijungta"],
      ["unknown", "negalioja"],
      // A session not opened through TEAM (direct sign-in at /vedejui).
      [null, "negalioja"],
    ]
    for (const [reason, kind] of cases) {
      signIn({ role: "staff", accessOk: false, endReason: reason })
      const res = await proxy(request("/dashboard"))
      expect(new URL(res.headers.get("location")!).searchParams.get("p"), String(reason)).toBe(kind)
    }
  })

  it("sends an expired (8 h) page request through TEAM again, keeping the page", async () => {
    signIn({ role: "staff", accessOk: false, endReason: "expired" })
    const res = await proxy(request("/games/abc?tab=2"))
    const location = new URL(res.headers.get("location")!)
    expect(location.pathname).toBe("/auth/team/start")
    expect(location.searchParams.get("next")).toBe("/games/abc?tab=2")
    expect(counters.signOuts).toEqual(["local"])
  })

  it("ends a staff session whose CLASSROOM profile an admin blocked, without asking TEAM", async () => {
    signIn({ role: "staff", status: "blocked", accessOk: true })
    const res = await proxy(request("/dashboard"))
    expect(new URL(res.headers.get("location")!).searchParams.get("p")).toBe("sustabdyta")
    expect(counters.accessChecks).toBe(0)
    expect(counters.signOuts).toEqual(["local"])
  })

  it("does not sign out when the check itself fails: 503 for APIs, the 'unavailable' page otherwise", async () => {
    signIn({ role: "staff", accessOk: "error" })
    expect((await proxy(request("/api/games"))).status).toBe(503)
    const page = await proxy(request("/dashboard"))
    expect(new URL(page.headers.get("location")!).searchParams.get("p")).toBe("nepasiekiamas")
    expect(counters.signOuts).toEqual([])
  })

  it("checks staff on every request (no 30 s cache)", async () => {
    signIn({ role: "staff", accessOk: true })
    for (let i = 0; i < 3; i++) await proxy(request("/dashboard"))
    expect(counters.profileReads).toBe(3)
    expect(counters.accessChecks).toBe(3)
  })

  it("keeps staff out of onboarding and the waiting page", async () => {
    signIn({ role: "staff", accessOk: true })
    expect(new URL((await proxy(request("/onboarding"))).headers.get("location")!).pathname).toBe("/dashboard")
    expect(new URL((await proxy(request("/laukia"))).headers.get("location")!).pathname).toBe("/dashboard")
    expect((await proxy(request("/api/onboarding", { method: "POST" }))).status).toBe(403)
  })

  it("never checks participant routes", async () => {
    signIn({ role: "staff", accessOk: false })
    for (const path of ["/play/ABC123", "/prisijungti", "/api/play/state", "/api/teams", "/api/submissions"]) {
      expect(passes(await proxy(request(path))), path).toBe(true)
    }
    expect(counters.accessChecks).toBe(0)
    expect(counters.signOuts).toEqual([])
  })

  it("goes to TEAM itself when the sign-in is turned off", async () => {
    delete process.env.TEAM_SSO_ENABLED
    signIn({ role: "staff", accessOk: false, endReason: "expired" })
    const res = await proxy(request("/dashboard"))
    expect(res.headers.get("location")).toBe("https://komanda.kusteam.app/")
    expect(counters.signOuts).toEqual(["local"])
  })

  it("applies on the legacy app. host too", async () => {
    signIn({ role: "staff", accessOk: false, endReason: "blocked" })
    const res = await proxy(request("/dashboard", { host: "app.kusteam.app" }))
    expect(new URL(res.headers.get("location")!).searchParams.get("p")).toBe("sustabdyta")
    expect(counters.signOuts).toEqual(["local"])
  })
})

describe("proxy: teachers and admins are unaffected", () => {
  it("never calls the staff check or signs out a teacher or admin", async () => {
    for (const role of ["teacher", "admin", "super_admin"] as const) {
      signIn({ role, accessOk: false })
      expect(passes(await proxy(request("/dashboard"))), role).toBe(true)
      expect(passes(await proxy(request("/api/games"))), role).toBe(true)
    }
    expect(counters.accessChecks).toBe(0)
    expect(counters.adminCalls).toBe(0)
    expect(counters.signOuts).toEqual([])
  })

  it("still caches an active teacher for 30 s (one profile read)", async () => {
    signIn({ role: "teacher" })
    for (let i = 0; i < 3; i++) await proxy(request("/dashboard"))
    expect(counters.profileReads).toBe(1)
  })
})

describe("proxy: /auth/team/*", () => {
  it("passes signed in or not, without touching the session or the ?code= safety net", async () => {
    const { createServerClient } = await import("@supabase/ssr")
    vi.mocked(createServerClient).mockClear()
    for (const signedIn of [false, true]) {
      if (signedIn) signIn({ role: "teacher" })
      else currentUserId = null
      for (const path of ["/auth/team/start?next=/dashboard", "/auth/team/callback?code=abc&state=def", "/auth/team/pranesimas?p=negalioja"]) {
        expect(passes(await proxy(request(path))), path).toBe(true)
      }
    }
    expect(createServerClient).not.toHaveBeenCalled()
  })
})
