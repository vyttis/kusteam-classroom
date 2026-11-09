import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { finishTeamSignIn } from "@/lib/team-sso/callback"
import { FLOW_COOKIE, FLOW_COOKIE_HOST } from "@/lib/team-sso/config"
import type { CookieJar } from "@/lib/team-sso/session-client"
import {
  CLIENT_SESSION,
  OTHER_USER,
  SSO_SESSION,
  USER,
  callbackRequest,
  fakeAccessToken,
  queryDouble,
  silenceConsole,
  startedFlow,
  withFlowCookie,
} from "./helpers/team-sso"

// KU STEAM TEAM sign-in, GET /auth/team/callback (contract 3.3 and 5).

const CODE = "C0de".repeat(10) + "abc" // 43 characters
const HASHED_TOKEN = "hashed-one-time-token-0123456789abcdef"
const SESSION_COOKIE = "sb-menmndjyfeuwfweubwnl-auth-token"
const ACCESS_TOKEN = fakeAccessToken({ sub: USER, session_id: CLIENT_SESSION, role: "authenticated" })

const OK_ROW = {
  status: "ok",
  session_id: SSO_SESSION,
  user_id: USER,
  email: "Darbuotoja@ku.lt",
  full_name: "Ona Darbuotoja",
  team_role: "staff",
  activity: "classroom",
  expires_at: "2026-11-10T02:00:00Z",
}

interface Options {
  redeem?: { data: unknown; error: { code: string } | null }
  profile?: { role: string; status: string } | null
  linked?: boolean
  existingSession?: boolean
  verifyUser?: string
  linkUser?: string
}

function setup(opts: Options = {}) {
  const calls: string[] = []
  const writes: { op: string; values: unknown }[] = []
  let jar: CookieJar | null = null

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push(`rpc:${fn}`)
    if (fn === "team_sso_redeem_code") return opts.redeem ?? { data: [OK_ROW], error: null }
    if (fn === "team_sso_link_client_session") return { data: opts.linked ?? true, error: null }
    if (fn === "team_sso_revoke") return { data: 1, error: null }
    throw new Error(`unexpected rpc ${fn} ${JSON.stringify(args)}`)
  })
  const from = vi.fn((table: string) => {
    calls.push(`from:${table}`)
    if (table !== "profiles") throw new Error(`unexpected table ${table}`)
    return queryDouble({ data: opts.profile === undefined ? null : opts.profile, error: null }, writes)
  })
  const getUserById = vi.fn(async (id: string) => {
    calls.push("getUserById")
    return { data: { user: { id, email: "darbuotoja@ku.lt" } }, error: null }
  })
  const generateLink = vi.fn(async (params: { type: string; email: string }) => {
    calls.push(`generateLink:${params.type}`)
    return {
      data: { properties: { hashed_token: HASHED_TOKEN }, user: { id: opts.linkUser ?? USER } },
      error: null,
    }
  })
  const admin = { rpc, from, auth: { admin: { getUserById, generateLink } } } as unknown as SupabaseClient

  const getSession = vi.fn(async () => ({
    data: { session: opts.existingSession ? { access_token: fakeAccessToken({ sub: OTHER_USER, session_id: OTHER_USER }) } : null },
    error: null,
  }))
  const signOut = vi.fn(async (o: { scope: string }) => {
    calls.push(`signOut:${o.scope}`)
    jar!.setAll([{ name: SESSION_COOKIE, value: "", options: { path: "/", maxAge: 0 } }])
    return { error: null }
  })
  const verifyOtp = vi.fn(async (params: { type: string; token_hash: string }) => {
    calls.push(`verifyOtp:${params.type}`)
    jar!.setAll([{ name: SESSION_COOKIE, value: "base64-new-session", options: { path: "/", sameSite: "lax" } }])
    const userId = opts.verifyUser ?? USER
    return {
      data: {
        session: { access_token: userId === USER ? ACCESS_TOKEN : fakeAccessToken({ sub: userId, session_id: CLIENT_SESSION }) },
        user: { id: userId },
      },
      error: null,
    }
  })
  const session = { auth: { getSession, signOut, verifyOtp } } as unknown as SupabaseClient
  const sessionClient = (j: CookieJar) => {
    jar = j
    return session
  }

  return { admin, sessionClient, calls, writes, rpc, signOut, verifyOtp, generateLink }
}

function messageOf(res: Response): string | null {
  // Relative: the browser stays on the host it used.
  const raw = res.headers.get("location")!
  expect(raw.startsWith("/") && !raw.startsWith("//")).toBe(true)
  const location = new URL(raw, "https://pamokos.kusteam.app")
  return location.pathname === "/auth/team/pranesimas" ? location.searchParams.get("p") : null
}

function deletesFlowCookie(res: Response): boolean {
  return res.headers
    .getSetCookie()
    .some((c) => c.startsWith(`${FLOW_COOKIE_HOST}=;`) && /Max-Age=0/.test(c) && /Path=\/(;|$)/.test(c) && /Secure/.test(c))
}

const INVALID_GRANT = { data: [{ ...OK_ROW, status: "invalid_grant", session_id: null, user_id: null }], error: null }

/** Exactly one redeem, of this code with a fresh 43-character verifier, and no session work. */
function expectBurnt(m: ReturnType<typeof setup>) {
  expect(m.calls).toEqual(["rpc:team_sso_redeem_code"])
  const [, args] = m.rpc.mock.calls[0]
  expect(args.p_client).toBe("classroom")
  expect(args.p_code_hash).toBe(createHash("sha256").update(CODE).digest("hex"))
  expect(args.p_code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(m.generateLink).not.toHaveBeenCalled()
  expect(m.verifyOtp).not.toHaveBeenCalled()
  expect(m.signOut).not.toHaveBeenCalled()
}

/** The redeem calls made to burn a code (anything but the cookie's verifier). */
function burnCalls(m: ReturnType<typeof setup>, verifier?: string) {
  return m.rpc.mock.calls.filter(([fn, args]) => fn === "team_sso_redeem_code" && args.p_code_verifier !== verifier)
}

let consoleCapture: ReturnType<typeof silenceConsole>
const ENV = { ...process.env }
beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
  consoleCapture = silenceConsole()
})
afterEach(() => {
  consoleCapture.restore()
  process.env = { ...ENV }
})

describe("GET /auth/team/callback: refusals before the code is used", () => {
  it("refuses without the flow cookie (invalid_state) and burns the code", async () => {
    const m = setup({ redeem: INVALID_GRANT })
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }), m)
    expect(res.status).toBe(303)
    expect(messageOf(res)).toBe("negalioja")
    expect(deletesFlowCookie(res)).toBe(true)
    expectBurnt(m)
  })

  it("refuses a wrong state (another browser's code), burns the code with a verifier that is not the cookie's", async () => {
    const m = setup({ redeem: INVALID_GRANT })
    const flow = startedFlow()
    const other = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: other.state }, withFlowCookie(flow.cookie)), m)
    expect(messageOf(res)).toBe("negalioja")
    expect(deletesFlowCookie(res)).toBe(true)
    expectBurnt(m)
    const [, args] = m.rpc.mock.calls[0]
    expect(args.p_code_verifier).not.toBe(flow.verifier)
    expect(args.p_code_verifier).not.toBe(other.verifier)
  })

  it("burns the code even when the redeem answer is ignored or fails, and ends a session it should never make", async () => {
    const collision = setup()
    const flow = startedFlow()
    await finishTeamSignIn(callbackRequest({ code: CODE, state: "wrong" }, withFlowCookie(flow.cookie)), collision)
    expect(collision.calls).toEqual(["rpc:team_sso_redeem_code", "rpc:team_sso_revoke"])
    const failing = setup({ redeem: { data: null, error: { code: "57P01" } } })
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: "wrong" }, withFlowCookie(flow.cookie)), failing)
    expect(messageOf(res)).toBe("negalioja")
  })

  it("does not call the database for a missing or malformed code on a failed state", async () => {
    const flow = startedFlow()
    const cases: Record<string, string>[] = [{ state: "wrong" }, { state: "wrong", code: "short" }, { state: "wrong", code: CODE + "x" }]
    for (const params of cases) {
      const m = setup()
      const res = await finishTeamSignIn(callbackRequest(params, withFlowCookie(flow.cookie)), m)
      expect(messageOf(res)).toBe("negalioja")
      expect(m.rpc).not.toHaveBeenCalled()
    }
  })

  it("refuses an edited flow cookie and an expired one", async () => {
    const m = setup({ redeem: INVALID_GRANT })
    const flow = startedFlow()
    const edited = flow.cookie.slice(0, -2) + (flow.cookie.endsWith("A") ? "BB" : "AA")
    expect(messageOf(await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(edited)), m))).toBe("negalioja")
    const old = startedFlow("/dashboard", Date.now() - 11 * 60 * 1000)
    expect(messageOf(await finishTeamSignIn(callbackRequest({ code: CODE, state: old.state }, withFlowCookie(old.cookie)), m))).toBe("negalioja")
    expect(burnCalls(m, flow.verifier)).toHaveLength(2)
    expect(m.generateLink).not.toHaveBeenCalled()
  })

  it("on https ignores a flow cookie without the __Host- prefix (could be planted by a sibling site)", async () => {
    const m = setup({ redeem: INVALID_GRANT })
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, { [FLOW_COOKIE]: flow.cookie }), m)
    expect(messageOf(res)).toBe("negalioja")
    expectBurnt(m)
  })

  it("shows TEAM's error with the contract message", async () => {
    const flow = startedFlow()
    const cases: [string, string][] = [
      ["access_denied", "nesuteikta"],
      ["temporarily_unavailable", "nepasiekiamas"],
      ["invalid_request", "negalioja"],
      ["something_new", "negalioja"],
    ]
    for (const [error, kind] of cases) {
      const m = setup()
      const res = await finishTeamSignIn(callbackRequest({ error, state: flow.state }, withFlowCookie(flow.cookie)), m)
      expect(messageOf(res), error).toBe(kind)
      expect(m.rpc).not.toHaveBeenCalled()
      expect(deletesFlowCookie(res)).toBe(true)
    }
  })

  it("refuses a malformed code without calling the database", async () => {
    const m = setup()
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: "short", state: flow.state }, withFlowCookie(flow.cookie)), m)
    expect(messageOf(res)).toBe("negalioja")
    expect(m.rpc).not.toHaveBeenCalled()
  })
})

describe("GET /auth/team/callback: redeem", () => {
  it("redeems with the service role: client, sha256 hex of the code, the cookie's verifier", async () => {
    const m = setup()
    const flow = startedFlow()
    await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
    const { createHash } = await import("node:crypto")
    expect(m.rpc).toHaveBeenCalledWith("team_sso_redeem_code", {
      p_client: "classroom",
      p_code_hash: createHash("sha256").update(CODE).digest("hex"),
      p_code_verifier: flow.verifier,
    })
  })

  it("maps every redeem status to the contract message, with no session created", async () => {
    const cases: [string, string][] = [
      ["invalid_grant", "negalioja"],
      ["access_denied:blocked", "sustabdyta"],
      ["access_denied:grant_revoked", "nesuteikta"],
      ["access_denied:not_member", "nesuteikta"],
      ["access_denied:logged_out", "atsijungta"],
    ]
    for (const [status, kind] of cases) {
      const m = setup({ redeem: { data: [{ ...OK_ROW, status, session_id: null, user_id: null }], error: null } })
      const flow = startedFlow()
      const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
      expect(messageOf(res), status).toBe(kind)
      expect(m.generateLink).not.toHaveBeenCalled()
      expect(m.verifyOtp).not.toHaveBeenCalled()
    }
  })

  it("shows 'unavailable' when the database fails", async () => {
    const m = setup({ redeem: { data: null, error: { code: "57P01" } } })
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
    expect(messageOf(res)).toBe("nepasiekiamas")
  })
})

describe("GET /auth/team/callback: sign-in", () => {
  it("creates a staff profile, then generateLink, verifyOtp and link, in that order, and goes to next", async () => {
    const m = setup({ profile: null })
    const flow = startedFlow("/games/abc?tab=live")
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)

    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("/games/abc?tab=live")
    expect(res.headers.get("referrer-policy")).toBe("no-referrer")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(deletesFlowCookie(res)).toBe(true)
    expect(res.headers.getSetCookie().some((c) => c.startsWith(`${SESSION_COOKIE}=base64-new-session`))).toBe(true)

    expect(m.calls).toEqual([
      "rpc:team_sso_redeem_code",
      "getUserById",
      "from:profiles",
      "from:profiles",
      "generateLink:magiclink",
      "verifyOtp:magiclink",
      "rpc:team_sso_link_client_session",
    ])
    expect(m.writes).toEqual([
      {
        op: "insert",
        values: {
          id: USER,
          email: "darbuotoja@ku.lt",
          full_name: "Ona Darbuotoja",
          role: "staff",
          status: "active",
          onboarding_completed: true,
        },
      },
    ])
    expect(m.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "darbuotoja@ku.lt" })
    expect(m.verifyOtp).toHaveBeenCalledWith({ type: "magiclink", token_hash: HASHED_TOKEN })
    expect(m.rpc).toHaveBeenCalledWith("team_sso_link_client_session", {
      p_session_id: SSO_SESSION,
      p_client_session_id: CLIENT_SESSION,
    })
    expect(m.signOut).not.toHaveBeenCalled()
  })

  it("checks next again before using it", async () => {
    for (const next of ["//evil.example", "/..//evil.example", "https://evil.example/x"]) {
      const m = setup({ profile: { role: "staff", status: "active" } })
      const flow = startedFlow(next)
      const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
      expect(res.headers.get("location"), next).toBe("/dashboard")
    }
  })

  it("leaves a teacher or admin profile exactly as it is", async () => {
    for (const role of ["teacher", "admin", "super_admin"]) {
      const m = setup({ profile: { role, status: "active" } })
      const flow = startedFlow()
      const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
      expect(res.headers.get("location"), role).toBe("/dashboard")
      expect(m.writes, role).toEqual([])
    }
    // Even a pending or blocked teacher: TEAM does not touch CLASSROOM accounts.
    const m = setup({ profile: { role: "teacher", status: "blocked" } })
    const flow = startedFlow()
    await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
    expect(m.writes).toEqual([])
  })

  it("keeps an active staff profile as it is", async () => {
    const m = setup({ profile: { role: "staff", status: "active" } })
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
    expect(res.headers.get("location")).toBe("/dashboard")
    expect(m.writes).toEqual([])
  })

  it("refuses a staff profile a CLASSROOM admin blocked, without re-activating it, and ends the SSO session", async () => {
    const m = setup({ profile: { role: "staff", status: "blocked" } })
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
    expect(messageOf(res)).toBe("sustabdyta")
    expect(m.writes).toEqual([])
    expect(m.generateLink).not.toHaveBeenCalled()
    expect(m.verifyOtp).not.toHaveBeenCalled()
    expect(m.rpc).toHaveBeenCalledWith("team_sso_revoke", {
      p_user: USER,
      p_reason: "client_signed_out",
      p_team_session: null,
      p_client: "classroom",
      p_session_id: SSO_SESSION,
    })
  })

  it("signs out a session the browser already had (scope local) before signing in", async () => {
    const m = setup({ profile: { role: "staff", status: "active" }, existingSession: true })
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie, { [SESSION_COOKIE]: "old" })), m)
    expect(m.calls.indexOf("signOut:local")).toBeGreaterThan(-1)
    expect(m.calls.indexOf("signOut:local")).toBeLessThan(m.calls.indexOf("verifyOtp:magiclink"))
    // Last write wins: the new session cookie, not the deletion.
    const cookies = res.headers.getSetCookie().filter((c) => c.startsWith(`${SESSION_COOKIE}=`))
    expect(cookies.at(-1)).toMatch(/^sb-[^=]+=base64-new-session/)
  })

  it("signs the new session out and ends the SSO session when the link is refused", async () => {
    const m = setup({ profile: { role: "staff", status: "active" }, linked: false })
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
    expect(messageOf(res)).toBe("negalioja")
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(m.calls).toContain("rpc:team_sso_revoke")
    const cookies = res.headers.getSetCookie().filter((c) => c.startsWith(`${SESSION_COOKIE}=`))
    expect(cookies.at(-1)).toMatch(/Max-Age=0/)
  })

  it("refuses when Supabase signs in someone else than the redeemed person", async () => {
    const m = setup({ profile: { role: "staff", status: "active" }, verifyUser: OTHER_USER })
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
    expect(messageOf(res)).toBe("negalioja")
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(m.calls).not.toContain("rpc:team_sso_link_client_session")
  })

  it("ends the SSO session and the new CLASSROOM session if something throws after sign-in", async () => {
    const m = setup({ profile: { role: "staff", status: "active" } })
    m.rpc.mockImplementation(async (fn: string) => {
      if (fn === "team_sso_redeem_code") return { data: [OK_ROW], error: null }
      if (fn === "team_sso_link_client_session") throw new Error("socket hang up")
      return { data: 1, error: null }
    })
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
    expect(messageOf(res)).toBe("nepasiekiamas")
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(m.rpc).toHaveBeenCalledWith("team_sso_revoke", expect.objectContaining({ p_session_id: SSO_SESSION }))
  })

  it("does not use a one-time token issued for another user", async () => {
    const m = setup({ profile: { role: "staff", status: "active" }, linkUser: OTHER_USER })
    const flow = startedFlow()
    const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
    expect(messageOf(res)).toBe("nepasiekiamas")
    expect(m.verifyOtp).not.toHaveBeenCalled()
  })
})

describe("TEAM sign-in secrets stay out of logs and URLs", () => {
  it("never logs or redirects with the code, verifier, state, one-time token or session token", async () => {
    const scenarios: Options[] = [
      {},
      { profile: null },
      { profile: { role: "staff", status: "blocked" } },
      { linked: false },
      { verifyUser: OTHER_USER },
      { linkUser: OTHER_USER },
      { redeem: { data: null, error: { code: "57P01" } } },
      { redeem: { data: [{ ...OK_ROW, status: "invalid_grant" }], error: null } },
    ]
    const locations: string[] = []
    const secrets: string[] = [CODE, HASHED_TOKEN, ACCESS_TOKEN, "base64-new-session"]
    for (const s of scenarios) {
      const m = setup(s)
      const flow = startedFlow()
      secrets.push(flow.verifier, flow.state, flow.cookie)
      const res = await finishTeamSignIn(callbackRequest({ code: CODE, state: flow.state }, withFlowCookie(flow.cookie)), m)
      locations.push(res.headers.get("location")!)
    }
    for (const secret of secrets) {
      for (const line of consoleCapture.lines) expect(line).not.toContain(secret)
      for (const location of locations) expect(location).not.toContain(secret)
    }
  })
})
