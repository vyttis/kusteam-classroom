import { combineChunks, stringFromBase64URL } from "@supabase/ssr"

// The CLASSROOM Supabase session cookie, read and cleared without the
// Supabase client. Used where the client cannot help any more: the session
// was deleted on the server (team_sso_revoke deletes the CLASSROOM
// auth.sessions row) or signOut itself failed.

/** `sb-<project ref>-auth-token`, the default storage key of @supabase/ssr. */
export function authStorageKey(): string | null {
  try {
    return `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]}-auth-token`
  } catch {
    return null
  }
}

/** The session cookie and its chunks (`.0`, `.1`, ...). */
export function isAuthCookie(name: string): boolean {
  const key = authStorageKey()
  if (!key) return false
  return name === key || (name.startsWith(`${key}.`) && /^\d+$/.test(name.slice(key.length + 1)))
}

/**
 * The access token stored in the session cookie, or null. Not verified:
 * use it only to look up why a session ended, never to grant anything.
 */
export async function accessTokenFromCookies(cookies: { name: string; value: string }[]): Promise<string | null> {
  const key = authStorageKey()
  if (!key) return null
  const values = new Map(cookies.filter((c) => isAuthCookie(c.name)).map((c) => [c.name, c.value]))
  if (values.size === 0) return null
  try {
    const raw = await combineChunks(key, (name) => values.get(name))
    if (!raw) return null
    const json = raw.startsWith("base64-") ? stringFromBase64URL(raw.slice("base64-".length)) : raw
    const session = JSON.parse(json) as { access_token?: unknown }
    return typeof session.access_token === "string" ? session.access_token : null
  } catch {
    return null
  }
}

/** Deletion entries for every session cookie in the list (Path=/ as the Supabase client sets them). */
export function authCookieDeletions(names: string[]) {
  return names.filter(isAuthCookie).map((name) => ({ name, value: "", options: { path: "/", maxAge: 0 } }))
}
