import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextResponse } from "next/server"
import { authCookieDeletions } from "@/lib/team-sso/auth-cookies"

export interface CookieWrite {
  name: string
  value: string
  options: CookieOptions
}

/**
 * The CLASSROOM session cookies of one request, as the Supabase server
 * client sees them while it signs out and signs in. Starts from the
 * request's cookies; every write updates the jar (so a later read sees the
 * new state) and is kept, in order, for the response.
 */
export interface CookieJar {
  getAll(): { name: string; value: string }[]
  setAll(cookies: CookieWrite[]): void
  readonly writes: CookieWrite[]
}

export function cookieJar(initial: { name: string; value: string }[]): CookieJar {
  const jar = new Map(initial.map((c) => [c.name, c.value]))
  const writes: CookieWrite[] = []
  return {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll(cookies) {
      for (const c of cookies) {
        writes.push(c)
        if (c.value === "" || c.options?.maxAge === 0) jar.delete(c.name)
        else jar.set(c.name, c.value)
      }
    },
    writes,
  }
}

/** The CLASSROOM Supabase client (anon key, user session) on top of a jar. */
export function createSessionClient(jar: CookieJar): SupabaseClient {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: (cookies) => jar.setAll(cookies) },
    global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) },
  })
}

/**
 * Ends this CLASSROOM session only (scope local: TEAM's session in the same
 * project stays). It may already be gone on the server: team_sso_revoke
 * deletes the CLASSROOM session of a revoked SSO session, and Supabase then
 * answers the sign-out with an error or the refresh fails. Either way the
 * session cookies leave the jar; this never throws.
 */
export async function signOutLocal(client: SupabaseClient, jar: CookieJar): Promise<void> {
  try {
    await client.auth.signOut({ scope: "local" })
  } catch {
    // cleared below
  }
  const left = authCookieDeletions(jar.getAll().map((c) => c.name))
  if (left.length > 0) jar.setAll(left)
}

/** Puts the jar's writes on the response, last write per cookie wins. */
export function applyCookieWrites(response: NextResponse, writes: CookieWrite[]): void {
  for (const w of writes) response.cookies.set(w.name, w.value, w.options)
}
