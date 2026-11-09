import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { NextRequest } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { TEAM_SSO_MESSAGES, messageKindFor, parseMessageKind } from "@/lib/team-sso/messages"
import type { CookieJar } from "@/lib/team-sso/session-client"
import { signOutStaff } from "@/lib/team-sso/sign-out"
import { CLIENT_SESSION, SSO_SESSION, USER, fakeAccessToken, queryDouble, sessionCookie, silenceConsole } from "./helpers/team-sso"

const ENV = { ...process.env }
let consoleCapture: ReturnType<typeof silenceConsole>
beforeEach(() => {
  consoleCapture = silenceConsole()
})
afterEach(() => {
  consoleCapture.restore()
  process.env = { ...ENV }
})

const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }

describe("TEAM_SSO_ENABLED", () => {
  const get = (path: string, host = "pamokos.kusteam.app") => new NextRequest(`https://${host}${path}`, { headers: { host } })

  it("unset: every /auth/team route is 404", async () => {
    delete process.env.TEAM_SSO_ENABLED
    const start = await import("@/app/auth/team/start/route")
    const callback = await import("@/app/auth/team/callback/route")
    const signOut = await import("@/app/auth/team/sign-out/route")
    const page = (await import("@/app/auth/team/pranesimas/page")).default
    await expect(start.GET(get("/auth/team/start"))).rejects.toMatchObject(NOT_FOUND)
    await expect(callback.GET(get("/auth/team/callback?code=x&state=y"))).rejects.toMatchObject(NOT_FOUND)
    await expect(signOut.POST(get("/auth/team/sign-out"))).rejects.toMatchObject(NOT_FOUND)
    await expect(page({ searchParams: Promise.resolve({ p: "negalioja" }) })).rejects.toMatchObject(NOT_FOUND)
  })

  it("any value but 1 keeps it off", async () => {
    process.env.TEAM_SSO_ENABLED = "true"
    const start = await import("@/app/auth/team/start/route")
    await expect(start.GET(get("/auth/team/start"))).rejects.toMatchObject(NOT_FOUND)
  })

  it("on: start works on pamokos and the bare domain, not on the legacy hosts", async () => {
    process.env.TEAM_SSO_ENABLED = "1"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
    const start = await import("@/app/auth/team/start/route")
    expect((await start.GET(get("/auth/team/start"))).status).toBe(303)
    expect((await start.GET(get("/auth/team/start", "kusteam.app"))).status).toBe(303)
    await expect(start.GET(get("/auth/team/start", "app.kusteam.app"))).rejects.toMatchObject(NOT_FOUND)
    await expect(start.GET(get("/auth/team/start", "play.kusteam.app"))).rejects.toMatchObject(NOT_FOUND)
  })
})

describe("messages (contract section 7)", () => {
  it("uses the contract's texts exactly, without long dashes", () => {
    expect(TEAM_SSO_MESSAGES).toEqual({
      nesuteikta: {
        text: "Ši veikla jums nesuteikta. Jei manote, kad tai klaida, rašykite steam@ku.lt.",
        button: "Grįžti į KU STEAM TEAM",
      },
      sustabdyta: {
        text: "Jūsų KU STEAM TEAM prieiga sustabdyta. Kreipkitės į KU STEAM centrą: steam@ku.lt.",
        button: null,
      },
      negalioja: {
        text: "Prisijungimo nuoroda nebegalioja. Atidarykite veiklą iš KU STEAM TEAM dar kartą.",
        button: "Atidaryti KU STEAM TEAM",
      },
      atsijungta: {
        text: "Atsijungėte nuo KU STEAM TEAM. Norėdami tęsti, prisijunkite iš naujo.",
        button: "Atidaryti KU STEAM TEAM",
      },
      nepasiekiamas: {
        text: "KU STEAM TEAM šiuo metu nepasiekiamas. Pabandykite po kelių minučių.",
        button: "Bandyti dar kartą",
      },
    })
    expect(JSON.stringify(TEAM_SSO_MESSAGES)).not.toMatch(/[–—]/)
  })

  it("maps every contract code", () => {
    const expected: Record<string, string> = {
      access_denied: "nesuteikta",
      grant_revoked: "nesuteikta",
      not_member: "nesuteikta",
      blocked: "sustabdyta",
      invalid_state: "negalioja",
      invalid_grant: "negalioja",
      invalid_request: "negalioja",
      expired: "negalioja",
      unknown: "negalioja",
      logged_out: "atsijungta",
      temporarily_unavailable: "nepasiekiamas",
      slow_down: "nepasiekiamas",
      network: "nepasiekiamas",
    }
    for (const [code, kind] of Object.entries(expected)) expect(messageKindFor(code), code).toBe(kind)
    expect(parseMessageKind("<script>")).toBe("negalioja")
    expect(parseMessageKind(["sustabdyta", "x"])).toBe("sustabdyta")
  })

  it("shows the message and the TEAM button on the page", async () => {
    process.env.TEAM_SSO_ENABLED = "1"
    process.env.TEAM_APP_URL = "http://127.0.0.1:3100"
    const page = (await import("@/app/auth/team/pranesimas/page")).default
    const html = JSON.stringify(await page({ searchParams: Promise.resolve({ p: "nesuteikta" }) }))
    expect(html).toContain(TEAM_SSO_MESSAGES.nesuteikta.text)
    expect(html).toContain("Grįžti į KU STEAM TEAM")
    expect(html).toContain("http://127.0.0.1:3100/")
    const blocked = JSON.stringify(await page({ searchParams: Promise.resolve({ p: "sustabdyta" }) }))
    expect(blocked).not.toContain("127.0.0.1")
  })
})

describe("POST /auth/team/sign-out", () => {
  const AUTH_COOKIE = "sb-menmndjyfeuwfweubwnl-auth-token"
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://menmndjyfeuwfweubwnl.supabase.co"
  })

  function setup(role: string | null, opts: { signOutFails?: boolean; endedReason?: string } = {}) {
    const rpc = vi.fn(async (fn: string) =>
      fn === "team_sso_session_status"
        ? { data: [{ active: false, reason: opts.endedReason ?? "logged_out", user_id: USER, expires_at: null }], error: null }
        : { data: 1, error: null },
    )
    const signOut = vi.fn(async () => {
      // As after team_sso_revoke: Supabase no longer knows the session.
      if (opts.signOutFails) return { error: { name: "AuthApiError", status: 500, message: "boom" } }
      jar!.setAll([{ name: AUTH_COOKIE, value: "", options: { path: "/", maxAge: 0 } }])
      return { error: null }
    })
    let jar: CookieJar | null = null
    const admin = {
      from: (table: string) =>
        queryDouble({
          data: table === "profiles" ? (role ? { role } : null) : opts.endedReason === undefined && !role ? null : { id: SSO_SESSION },
          error: null,
        }),
      rpc,
    } as unknown as SupabaseClient
    const session = {
      auth: {
        getUser: async () => ({ data: { user: role ? { id: USER } : null }, error: null }),
        getSession: async () => ({ data: { session: { access_token: fakeAccessToken({ sub: USER, session_id: CLIENT_SESSION }) } } }),
        signOut,
      },
    } as unknown as SupabaseClient
    return {
      deps: {
        admin,
        sessionClient: (j: CookieJar) => {
          jar = j
          return session
        },
      },
      rpc,
      signOut,
    }
  }
  const post = (headers: Record<string, string> = {}) =>
    new NextRequest("https://pamokos.kusteam.app/auth/team/sign-out", {
      method: "POST",
      headers: {
        host: "pamokos.kusteam.app",
        origin: "https://pamokos.kusteam.app",
        cookie: `${AUTH_COOKIE}=${sessionCookie({ sub: USER, session_id: CLIENT_SESSION })}`,
        ...headers,
      },
    })
  const clears = (res: Response) => res.headers.getSetCookie().some((c) => c.startsWith(`${AUTH_COOKIE}=;`) && /Max-Age=0/.test(c))

  it("staff: ends this CLASSROOM session (local) and its SSO session, back to TEAM", async () => {
    const m = setup("staff")
    const res = await signOutStaff(post(), m.deps)
    expect(await res.json()).toEqual({ ok: true, redirect: "https://komanda.kusteam.app/" })
    expect(m.rpc).toHaveBeenCalledWith("team_sso_revoke", {
      p_user: USER,
      p_reason: "client_signed_out",
      p_team_session: null,
      p_client: "classroom",
      p_session_id: SSO_SESSION,
    })
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(m.rpc.mock.invocationCallOrder[0]).toBeLessThan(m.signOut.mock.invocationCallOrder[0])
    expect(clears(res)).toBe(true)
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("staff: still succeeds and clears the cookies when the revoke already deleted the session", async () => {
    const m = setup("staff", { signOutFails: true })
    const res = await signOutStaff(post(), m.deps)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, redirect: "https://komanda.kusteam.app/" })
    expect(clears(res)).toBe(true)
  })

  it("a staff session TEAM had already revoked goes back to TEAM, cookies cleared", async () => {
    const m = setup(null, { endedReason: "grant_revoked" })
    const res = await signOutStaff(post(), m.deps)
    expect(await res.json()).toEqual({ ok: true, redirect: "https://komanda.kusteam.app/" })
    expect(clears(res)).toBe(true)
  })

  it("no session at all: /vedejui, nothing revoked", async () => {
    const m = setup(null)
    const res = await signOutStaff(post(), m.deps)
    expect(await res.json()).toEqual({ ok: true, redirect: "/vedejui" })
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it("teacher: no SSO revoke, local sign-out only", async () => {
    const m = setup("teacher")
    const res = await signOutStaff(post(), m.deps)
    expect(await res.json()).toEqual({ ok: true, redirect: "/vedejui" })
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" })
  })

  it("refuses a cross-site request", async () => {
    const m = setup("staff")
    const res = await signOutStaff(post({ origin: "https://evil.example" }), m.deps)
    expect(res.status).toBe(403)
    expect(m.signOut).not.toHaveBeenCalled()
  })
})

describe("no TEAM sign-in secret is ever logged", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name)
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : []
    })
  }

  it("logs only a fixed message and a database or HTTP status code", () => {
    const sources = [...files("lib/team-sso"), ...files("app/auth/team"), "proxy.ts"]
    const calls: string[] = []
    for (const file of sources) {
      const text = readFileSync(file, "utf8")
      for (const m of text.matchAll(/console\.(log|info|warn|error|debug|trace)\(([^\n]*)\)/g)) {
        calls.push(`${file}: ${m[2]}`)
        // One string literal, optionally { pg: <x>.code } or { status: <x>?.status }.
        expect(m[2], `${file}: ${m[0]}`).toMatch(
          /^"[^"]*"(, \{ (pg: [A-Za-z]+\??\.code|status: [A-Za-z]+\??\.status) \})?$/,
        )
      }
      // No multi-line console calls that the pattern above would miss.
      expect(text.match(/console\.\w+\([^)\n]*$/gm) ?? [], file).toEqual([])
    }
    expect(calls.length).toBeGreaterThan(0)
  })

  it("puts no code, verifier or token into a URL other than TEAM's authorize link", () => {
    for (const file of [...files("lib/team-sso"), ...files("app/auth/team")]) {
      const text = readFileSync(file, "utf8")
      expect(text, file).not.toMatch(/searchParams\.set\(\s*"(code|code_verifier|token|token_hash|access_token)"/)
    }
  })
})
