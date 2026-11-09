import { vi } from "vitest"
import { NextRequest } from "next/server"
import { FLOW_COOKIE_HOST } from "@/lib/team-sso/config"
import { pkceChallenge, randomToken, sealFlow } from "@/lib/team-sso/crypto"

export const USER = "00000000-0000-4000-8000-0000000000d1"
export const OTHER_USER = "00000000-0000-4000-8000-0000000000d9"
export const SSO_SESSION = "00000000-0000-4000-8000-0000000000f1"
export const CLIENT_SESSION = "00000000-0000-4000-8000-0000000000e2"

/** An unsigned JWT-shaped access token with the given claims (signature is not checked by our code). */
export function fakeAccessToken(claims: Record<string, unknown>): string {
  const part = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url")
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(claims)}.c2lnbmF0dXJl`
}

export interface QueryResult {
  data: unknown
  error: { code?: string; message?: string } | null
}

/**
 * A chainable PostgREST query double: every builder method returns the
 * chain, maybeSingle/single/await resolve to the result. Writes are
 * recorded in `writes`.
 */
export function queryDouble(result: QueryResult | (() => QueryResult), writes: { op: string; values: unknown }[] = []) {
  const resolve = () => (typeof result === "function" ? result() : result)
  const chain: Record<string, unknown> = {}
  for (const m of ["select", "eq", "in", "order", "limit", "neq", "is"]) chain[m] = () => chain
  chain.maybeSingle = async () => resolve()
  chain.single = async () => resolve()
  chain.then = (ok: (v: QueryResult) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolve()).then(ok, ko)
  chain.insert = (values: unknown) => {
    writes.push({ op: "insert", values })
    return { ...chain, then: (ok: (v: QueryResult) => unknown) => Promise.resolve({ data: null, error: null }).then(ok) }
  }
  chain.update = (values: unknown) => {
    writes.push({ op: "update", values })
    return chain
  }
  return chain
}

/** A started flow: the sealed cookie and what is inside it. */
export function startedFlow(next = "/dashboard", created = Date.now()) {
  const state = randomToken()
  const verifier = randomToken()
  return { state, verifier, next, challenge: pkceChallenge(verifier), cookie: sealFlow({ state, verifier, next, created }) }
}

export function callbackRequest(params: Record<string, string>, cookies: Record<string, string> = {}) {
  const url = new URL("https://pamokos.kusteam.app/auth/team/callback")
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
  return new NextRequest(url, { headers: { host: "pamokos.kusteam.app", ...(cookie ? { cookie } : {}) } })
}

/** The flow cookie as the browser sends it back on https (`__Host-` name). */
export function withFlowCookie(cookie: string, extra: Record<string, string> = {}) {
  return { [FLOW_COOKIE_HOST]: cookie, ...extra }
}

/** The CLASSROOM Supabase session cookie as @supabase/ssr writes it (one chunk). */
export function sessionCookie(claims: Record<string, unknown>): string {
  const session = { access_token: fakeAccessToken(claims), token_type: "bearer", refresh_token: "r" }
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`
}

export function silenceConsole() {
  const lines: string[] = []
  const record = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
  }
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(record),
  )
  return { lines, restore: () => spies.forEach((s) => s.mockRestore()) }
}
