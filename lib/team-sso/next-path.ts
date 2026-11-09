import { DEFAULT_NEXT } from "@/lib/team-sso/config"

/**
 * `next` after the TEAM sign-in: only a path on this site (contract 3.1).
 * Refused, so the default is used instead:
 * - anything not starting with a single "/" ("//evil", "https://evil", "evil")
 * - any backslash ("/\evil" is "//evil" to a browser)
 * - control characters or spaces (the URL parser drops tabs and newlines,
 *   so "/\t/evil" would become "//evil")
 * - a path that resolves to another origin, whatever the trick
 * - the sign-in routes themselves (no loops)
 */
export function safeNextPath(raw: string | null | undefined, origin: string): string {
  if (!raw || raw.length > 2048) return DEFAULT_NEXT
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_NEXT
  if (raw.includes("\\")) return DEFAULT_NEXT
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i)
    if (c <= 0x20 || c === 0x7f) return DEFAULT_NEXT
  }
  let resolved: URL
  try {
    resolved = new URL(raw, origin)
  } catch {
    return DEFAULT_NEXT
  }
  if (resolved.origin !== new URL(origin).origin) return DEFAULT_NEXT
  // "/..//evil" normalises to "//evil": as a Location that is another host.
  if (resolved.pathname.startsWith("//")) return DEFAULT_NEXT
  if (resolved.pathname === "/auth/team" || resolved.pathname.startsWith("/auth/team/")) return DEFAULT_NEXT
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}
