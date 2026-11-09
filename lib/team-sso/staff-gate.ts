import type { SupabaseClient } from "@supabase/supabase-js"
import { accessTokenClaims } from "@/lib/team-sso/jwt"
import { ssoEndReason } from "@/lib/team-sso/sessions"

export type StaffDecision =
  | { kind: "allow" }
  /** Access is over: sign this CLASSROOM session out, tell the person why. */
  | { kind: "end"; reason: string }
  /** The check itself failed: refuse this request, keep the session. */
  | { kind: "unavailable" }

/**
 * The proxy's check for a CLASSROOM profile with role 'staff', on every
 * facilitator page and API request (no cache, contract 4 and ADR-001):
 * the profile must be active (a CLASSROOM admin may block it) and
 * team_staff_access_ok() must be true for this Supabase session, i.e. the
 * session is linked to an SSO session that is active right now.
 *
 * `admin` is called only when access has ended, to find out why.
 */
export async function staffAccess(
  supabase: SupabaseClient,
  userId: string,
  profileStatus: string,
  admin: () => SupabaseClient,
): Promise<StaffDecision> {
  if (profileStatus !== "active") return { kind: "end", reason: "blocked" }
  const { data, error } = await supabase.rpc("team_staff_access_ok")
  if (error) {
    console.error("[team-sso] staff access check failed", { pg: error.code })
    return { kind: "unavailable" }
  }
  if (data === true) return { kind: "allow" }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const claims = accessTokenClaims(session?.access_token)
  const clientSessionId = claims && claims.sub === userId ? claims.sessionId : null
  let reason = "unknown"
  try {
    reason = await ssoEndReason(admin(), userId, clientSessionId)
  } catch {
    reason = "unknown"
  }
  return { kind: "end", reason }
}
