import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { FLOW_COOKIE, teamAppUrl } from "@/lib/team-sso/config"
import { openFlow, pkceChallenge, sealFlow } from "@/lib/team-sso/crypto"
import { safeNextPath } from "@/lib/team-sso/next-path"
import { startTeamSignIn } from "@/lib/team-sso/start"

// KU STEAM TEAM sign-in, GET /auth/team/start (contract 3.1).

const ENV = { ...process.env }
beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
  delete process.env.TEAM_SSO_FLOW_SECRET
  delete process.env.TEAM_SSO_URL
  delete process.env.TEAM_APP_URL
})
afterEach(() => {
  process.env = { ...ENV }
})

function start(path = "/auth/team/start", host = "pamokos.kusteam.app", protocol = "https") {
  return startTeamSignIn(new NextRequest(`${protocol}://${host}${path}`, { headers: { host } }))
}

function flowCookie(res: Response): { header: string; value: string } {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${FLOW_COOKIE}=`))
  if (!header) throw new Error("no flow cookie")
  return { header, value: header.slice(FLOW_COOKIE.length + 1).split(";")[0] }
}

describe("GET /auth/team/start", () => {
  it("redirects (303) to TEAM's authorize page with client, state and an S256 challenge", () => {
    const res = start()
    expect(res.status).toBe(303)
    const location = new URL(res.headers.get("location")!)
    expect(location.origin).toBe("https://komanda.kusteam.app")
    expect(location.pathname).toBe("/sso/authorize")
    expect(location.searchParams.get("client_id")).toBe("classroom")
    expect(location.searchParams.get("code_challenge_method")).toBe("S256")
    expect(location.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(location.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(location.searchParams.has("redirect_uri")).toBe(false)
  })

  it("keeps state and verifier in a sealed cookie; the challenge is S256 of that verifier", () => {
    const res = start()
    const location = new URL(res.headers.get("location")!)
    const flow = openFlow(flowCookie(res).value)!
    expect(flow).not.toBeNull()
    expect(flow.state).toBe(location.searchParams.get("state"))
    expect(flow.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(location.searchParams.get("code_challenge")).toBe(pkceChallenge(flow.verifier))
    // The verifier is never in the URL, and not readable in the cookie.
    expect(res.headers.get("location")).not.toContain(flow.verifier)
    expect(flowCookie(res).value).not.toContain(flow.verifier)
    expect(Buffer.from(flowCookie(res).value, "base64url").toString("latin1")).not.toContain(flow.verifier)
  })

  it("sets the flow cookie HttpOnly, Secure, SameSite=Lax, Path=/auth/team, 10 minutes", () => {
    const { header } = flowCookie(start())
    expect(header).toMatch(/; HttpOnly/i)
    expect(header).toMatch(/; Secure/i)
    expect(header).toMatch(/; SameSite=lax/i)
    expect(header).toMatch(/; Path=\/auth\/team(;|$)/)
    expect(header).toMatch(/; Max-Age=600(;|$)/)
  })

  it("drops Secure only for plain http on a loopback host (local tests)", () => {
    expect(flowCookie(start("/auth/team/start", "127.0.0.1:3000", "http")).header).not.toMatch(/; Secure/i)
    expect(flowCookie(start("/auth/team/start", "pamokos.kusteam.app", "http")).header).toMatch(/; Secure/i)
  })

  it("is never cached and sends no referrer", () => {
    const res = start()
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("referrer-policy")).toBe("no-referrer")
  })

  it("uses a fresh state and verifier on every start", () => {
    const a = openFlow(flowCookie(start()).value)!
    const b = openFlow(flowCookie(start()).value)!
    expect(a.state).not.toBe(b.state)
    expect(a.verifier).not.toBe(b.verifier)
  })

  it("stores a safe next and replaces anything else with /dashboard", () => {
    const nextOf = (raw: string) => openFlow(flowCookie(start(`/auth/team/start?next=${encodeURIComponent(raw)}`)).value)!.next
    expect(nextOf("/games/abc/live?tab=1")).toBe("/games/abc/live?tab=1")
    expect(nextOf("/lesson-plans")).toBe("/lesson-plans")
    for (const bad of [
      "//evil.example",
      "//evil.example/dashboard",
      "/\\evil.example",
      "\\\\evil.example",
      "https://evil.example",
      "http://evil.example/dashboard",
      "javascript:alert(1)",
      "evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/..//evil.example",
      "/auth/team/start",
      "",
    ]) {
      expect(nextOf(bad), bad).toBe("/dashboard")
    }
    expect(openFlow(flowCookie(start()).value)!.next).toBe("/dashboard")
  })

  it("goes to TEAM_SSO_URL / TEAM_APP_URL in tests, never to an arbitrary http host", () => {
    process.env.TEAM_APP_URL = "http://127.0.0.1:3100"
    expect(new URL(start().headers.get("location")!).origin).toBe("http://127.0.0.1:3100")
    process.env.TEAM_SSO_URL = "http://127.0.0.1:3200/"
    expect(teamAppUrl()).toBe("http://127.0.0.1:3200")
    process.env.TEAM_SSO_URL = "http://evil.example"
    expect(teamAppUrl()).toBe("https://komanda.kusteam.app")
    process.env.TEAM_SSO_URL = "not a url"
    expect(teamAppUrl()).toBe("https://komanda.kusteam.app")
  })
})

describe("PKCE and flow cookie", () => {
  it("matches the RFC 7636 test vector (as the database computes it)", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
  })

  it("refuses an altered, foreign-key or expired flow cookie", () => {
    const now = Date.now()
    const sealed = sealFlow({ state: "s".repeat(43), verifier: "v".repeat(43), next: "/dashboard", created: now })
    expect(openFlow(sealed, now)?.state).toBe("s".repeat(43))
    const bytes = Buffer.from(sealed, "base64url")
    bytes[20] ^= 1
    expect(openFlow(bytes.toString("base64url"), now)).toBeNull()
    expect(openFlow(sealed, now + 601_000)).toBeNull()
    expect(openFlow("garbage", now)).toBeNull()
    process.env.TEAM_SSO_FLOW_SECRET = "another-secret-another-secret-another"
    expect(openFlow(sealed, now)).toBeNull()
  })

  it("prefers TEAM_SSO_FLOW_SECRET over the service role key", () => {
    process.env.TEAM_SSO_FLOW_SECRET = "flow-secret-flow-secret-flow-secret"
    const sealed = sealFlow({ state: "a", verifier: "b", next: "/", created: Date.now() })
    process.env.SUPABASE_SERVICE_ROLE_KEY = "rotated"
    expect(openFlow(sealed)?.state).toBe("a")
  })
})

describe("safeNextPath", () => {
  it("keeps same-origin paths only", () => {
    const o = "https://pamokos.kusteam.app"
    expect(safeNextPath("/dashboard", o)).toBe("/dashboard")
    expect(safeNextPath("/%2F%2Fevil.example", o)).toBe("/%2F%2Fevil.example")
    expect(safeNextPath(null, o)).toBe("/dashboard")
    expect(safeNextPath("/" + "a".repeat(3000), o)).toBe("/dashboard")
  })
})
