import type { SupabaseClient } from "@supabase/supabase-js"
import { TEAM_SSO_CLIENT_ID } from "@/lib/team-sso/config"
import { rpcRow } from "@/lib/supabase/rpc-row"

// Server-only helpers around the TEAM-006 functions and tables. Every call
// takes the service-role client: team_sso_* is not readable by any client
// role. Nothing here logs ids, tokens or codes.

/** The CLASSROOM SSO session linked to a CLASSROOM Supabase session, or null. */
export async function ssoSessionForClientSession(
  admin: SupabaseClient,
  userId: string,
  clientSessionId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("team_sso_sessions")
    .select("id")
    .eq("client_session_id", clientSessionId)
    .eq("client_id", TEAM_SSO_CLIENT_ID)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) {
    console.error("[team-sso] session lookup failed", { pg: error.code })
    return null
  }
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Ends one CLASSROOM SSO session on purpose (the person signed out in
 * CLASSROOM, or the sign-in could not be finished). TEAM stays signed in.
 */
export async function revokeSsoSession(admin: SupabaseClient, userId: string, ssoSessionId: string): Promise<void> {
  const { error } = await admin.rpc("team_sso_revoke", {
    p_user: userId,
    p_reason: "client_signed_out",
    p_team_session: null,
    p_client: TEAM_SSO_CLIENT_ID,
    p_session_id: ssoSessionId,
  })
  if (error) console.error("[team-sso] revoke failed", { pg: error.code })
}

type SsoStatus = { found: false } | { found: true; active: boolean; reason: string | null }

/** Live status of the CLASSROOM SSO session linked to a CLASSROOM Supabase session. */
async function ssoStatusForClientSession(
  admin: SupabaseClient,
  userId: string,
  clientSessionId: string,
): Promise<SsoStatus | null> {
  const ssoId = await ssoSessionForClientSession(admin, userId, clientSessionId)
  if (!ssoId) return { found: false }
  const { data, error } = await admin.rpc("team_sso_session_status", {
    p_client: TEAM_SSO_CLIENT_ID,
    p_session_id: ssoId,
  })
  if (error) return null
  const row = rpcRow<{ active: boolean; reason: string | null }>(data)
  if (!row) return null
  return { found: true, active: row.active, reason: row.reason }
}

/**
 * Why a staff member's CLASSROOM session no longer gives access, as a
 * contract reason: blocked, grant_revoked, not_member, logged_out, expired
 * or unknown (no linked SSO session, e.g. a direct sign-in at /vedejui).
 * Errors read as "unknown": the person starts again from TEAM.
 */
export async function ssoEndReason(admin: SupabaseClient, userId: string, clientSessionId: string | null): Promise<string> {
  if (!clientSessionId) return "unknown"
  try {
    const status = await ssoStatusForClientSession(admin, userId, clientSessionId)
    if (!status?.found || status.active) return "unknown"
    return status.reason ?? "unknown"
  } catch {
    return "unknown"
  }
}

/**
 * For a CLASSROOM Supabase session that Supabase no longer knows (deleted on
 * the server): if it was opened through the TEAM sign-in, why it ended;
 * null if it was not (an ordinary teacher session, or nothing found).
 * Revoking an SSO session deletes its CLASSROOM session (TEAM-006), so this
 * is how a staff member whose access was taken away gets the right message
 * instead of the teacher sign-in page. An SSO session that is still active
 * reads as "expired": the person goes through TEAM again.
 */
export async function endedSsoSessionReason(
  admin: SupabaseClient,
  userId: string,
  clientSessionId: string,
): Promise<string | null> {
  try {
    const status = await ssoStatusForClientSession(admin, userId, clientSessionId)
    if (!status) return "unknown"
    if (!status.found) return null
    if (status.active) return "expired"
    return status.reason ?? "unknown"
  } catch {
    return null
  }
}
