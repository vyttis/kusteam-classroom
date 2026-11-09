import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { accessTokenFromCookies, authCookieDeletions, isAuthCookie } from "@/lib/team-sso/auth-cookies"
import { cookieJar, createSessionClient, signOutLocal } from "@/lib/team-sso/session-client"
import { accessTokenClaims } from "@/lib/team-sso/jwt"
import { CLIENT_SESSION, OTHER_USER, USER, fakeAccessToken } from "./helpers/team-sso"

// The real @supabase/ssr server client on top of our cookie jar, against a
// minimal stand-in for Supabase Auth (/verify, /logout): the old session
// is signed out with scope local, the new one lands in the jar's writes.

const requests: { method: string; url: string; body: string }[] = []
// When true, the stand-in behaves as after team_sso_revoke: the session is gone.
let sessionDeleted = false
let bigUser = false
let server: Server
let base = ""
const ENV = { ...process.env }

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ""
    req.on("data", (c) => (body += c))
    req.on("end", () => {
      requests.push({ method: req.method!, url: req.url!, body })
      if (req.url?.startsWith("/auth/v1/logout")) {
        if (sessionDeleted) {
          res.writeHead(403, { "content-type": "application/json" }).end(
            JSON.stringify({ code: 403, error_code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" }),
          )
          return
        }
        res.writeHead(204).end()
        return
      }
      if (req.url?.startsWith("/auth/v1/verify")) {
        const now = Math.floor(Date.now() / 1000)
        res.writeHead(200, { "content-type": "application/json" }).end(
          JSON.stringify({
            access_token: fakeAccessToken({ sub: USER, session_id: CLIENT_SESSION, exp: now + 3600, role: "authenticated" }),
            token_type: "bearer",
            expires_in: 3600,
            expires_at: now + 3600,
            refresh_token: "new-refresh",
            user: {
              id: USER,
              aud: "authenticated",
              role: "authenticated",
              email: "darbuotoja@ku.lt",
              ...(bigUser ? { user_metadata: { padding: "x".repeat(5000) } } : {}),
            },
          }),
        )
        return
      }
      res.writeHead(404).end()
    })
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.NEXT_PUBLIC_SUPABASE_URL = base
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key"
})

afterAll(async () => {
  process.env = { ...ENV }
  await new Promise((r) => server.close(r))
})

/** The cookie the browser would hold for an existing session of OTHER_USER. */
function existingSessionCookie(): { name: string; value: string } {
  const now = Math.floor(Date.now() / 1000)
  const session = {
    access_token: fakeAccessToken({ sub: OTHER_USER, session_id: OTHER_USER, exp: now + 3600 }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "old-refresh",
    user: { id: OTHER_USER, aud: "authenticated", role: "authenticated" },
  }
  const ref = new URL(base).hostname.split(".")[0]
  return { name: `sb-${ref}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` }
}

describe("CLASSROOM session client on a cookie jar", () => {
  it("signs out the old session (scope local) and writes the new one", async () => {
    const old = existingSessionCookie()
    const jar = cookieJar([old, { name: "unrelated", value: "keep" }])
    const client = createSessionClient(jar)

    const { data: before } = await client.auth.getSession()
    expect(before.session?.user.id).toBe(OTHER_USER)
    await client.auth.signOut({ scope: "local" })
    const logout = requests.find((r) => r.url.startsWith("/auth/v1/logout"))
    expect(logout?.url).toBe("/auth/v1/logout?scope=local")

    const { data, error } = await client.auth.verifyOtp({ type: "magiclink", token_hash: "hashed" })
    expect(error).toBeNull()
    expect(accessTokenClaims(data.session?.access_token)).toEqual({ sub: USER, sessionId: CLIENT_SESSION })
    const verify = requests.find((r) => r.url.startsWith("/auth/v1/verify"))
    expect(JSON.parse(verify!.body)).toMatchObject({ type: "magiclink", token_hash: "hashed" })

    // The jar now holds the new session; the last write for the session
    // cookie is the new value, after the deletion of the old one.
    const sessionWrites = jar.writes.filter((w) => w.name.startsWith(old.name))
    expect(sessionWrites.some((w) => w.value === "" || w.options.maxAge === 0)).toBe(true)
    const last = sessionWrites.at(-1)!
    expect(last.value).not.toBe("")
    expect(last.options.path).toBe("/")
    const stored = JSON.parse(Buffer.from(last.value.replace(/^base64-/, ""), "base64url").toString("utf8"))
    expect(stored.user.id).toBe(USER)
    expect(jar.getAll().find((c) => c.name === "unrelated")?.value).toBe("keep")

    const { data: after } = await createSessionClient(cookieJar(jar.getAll())).auth.getSession()
    expect(after.session?.user.id).toBe(USER)
  })

  it("signOutLocal clears the cookies even when Supabase says the session is already gone", async () => {
    const old = existingSessionCookie()
    const jar = cookieJar([old])
    sessionDeleted = true
    try {
      await signOutLocal(createSessionClient(jar), jar)
    } finally {
      sessionDeleted = false
    }
    expect(jar.getAll().filter((c) => isAuthCookie(c.name))).toEqual([])
    expect(jar.writes.some((w) => w.name === old.name && w.options.maxAge === 0)).toBe(true)
  })

  it("signOutLocal never throws and still clears the cookies when the sign-out itself throws", async () => {
    const old = existingSessionCookie()
    const jar = cookieJar([old, { name: `${old.name}.0`, value: "chunk" }])
    const client = { auth: { signOut: async () => Promise.reject(new Error("network")) } }
    await signOutLocal(client as never, jar)
    expect(jar.getAll()).toEqual([])
  })

  it("reads the access token back from the cookies @supabase/ssr wrote, chunked or not", async () => {
    for (const big of [false, true]) {
      bigUser = big
      const jar = cookieJar([])
      await createSessionClient(jar).auth.verifyOtp({ type: "magiclink", token_hash: "hashed" })
      const cookies = jar.getAll()
      if (big) expect(cookies.length).toBeGreaterThan(1)
      else expect(cookies.length).toBe(1)
      expect(accessTokenClaims(await accessTokenFromCookies(cookies))).toEqual({ sub: USER, sessionId: CLIENT_SESSION })
    }
    bigUser = false
    expect(await accessTokenFromCookies([])).toBeNull()
    expect(await accessTokenFromCookies([{ name: existingSessionCookie().name, value: "garbage" }])).toBeNull()
    expect(authCookieDeletions(["other", existingSessionCookie().name]).map((d) => d.name)).toEqual([existingSessionCookie().name])
  })
})
