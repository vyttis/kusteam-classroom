import type { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { FLOW_COOKIE, TEAM_SSO_CLIENT_ID } from "@/lib/team-sso/config"
import { openFlow, sameSecret, sha256Hex } from "@/lib/team-sso/crypto"
import { clearFlowCookie, redirectHere, ssoHeaders } from "@/lib/team-sso/http"
import { accessTokenClaims } from "@/lib/team-sso/jwt"
import { messageKindFor, messagePath } from "@/lib/team-sso/messages"
import { safeNextPath } from "@/lib/team-sso/next-path"
import { ensureClassroomProfile } from "@/lib/team-sso/profile"
import { revokeSsoSession } from "@/lib/team-sso/sessions"
import { applyCookieWrites, cookieJar, type CookieJar } from "@/lib/team-sso/session-client"
import { rpcRow } from "@/lib/supabase/rpc-row"

export interface CallbackDeps {
  /** Service-role client (redeem, profile, generateLink, link). */
  admin: SupabaseClient
  /** CLASSROOM session client writing to the given jar (verifyOtp, signOut). */
  sessionClient: (jar: CookieJar) => SupabaseClient
}

interface RedeemRow {
  status: string
  session_id: string | null
  user_id: string | null
  email: string | null
  full_name: string | null
  team_role: string | null
  activity: string | null
  expires_at: string | null
}

const CODE = /^[A-Za-z0-9_-]{43}$/

/**
 * GET /auth/team/callback (contract 3.3 and 5): checks state against the
 * flow cookie (deleted in this response whatever happens), redeems the code
 * with the service role, makes sure the CLASSROOM profile is right, signs
 * the person in to a new CLASSROOM Supabase session on the server, links
 * that session to the SSO session and sends them to `next`.
 *
 * The code, the verifier and the one-time Supabase token never leave the
 * server and are never logged.
 */
export async function finishTeamSignIn(request: NextRequest, deps: CallbackDeps): Promise<NextResponse> {
  const url = request.nextUrl
  const flow = openFlow(request.cookies.get(FLOW_COOKIE)?.value)
  // CLASSROOM session cookies: whatever the Supabase client signs out or in
  // below lands on the response, success or not.
  const jar = cookieJar(request.cookies.getAll())

  // Same-site paths only: the message page, or `next`, which was checked at
  // start, sealed, and is checked again before use.
  const respond = (path: string) => {
    const response = redirectHere(path)
    applyCookieWrites(response, jar.writes)
    clearFlowCookie(response, request)
    return ssoHeaders(response)
  }
  const fail = (reason: string) => respond(messagePath(messageKindFor(reason)))

  // 1. Login CSRF: the state must be the one this browser started with.
  const state = url.searchParams.get("state")
  if (!flow || !state || !sameSecret(state, flow.state)) return fail("invalid_state")

  // 2. TEAM refused (no grant, rate limit, malformed request).
  const teamError = url.searchParams.get("error")
  if (teamError) return fail(teamError)

  const code = url.searchParams.get("code")
  if (!code || !CODE.test(code)) return fail("invalid_request")

  // 3. Redeem: single use, PKCE and live access are checked in the database.
  let redeemed: RedeemRow | null
  try {
    const { data, error } = await deps.admin.rpc("team_sso_redeem_code", {
      p_client: TEAM_SSO_CLIENT_ID,
      p_code_hash: sha256Hex(code),
      p_code_verifier: flow.verifier,
    })
    if (error) {
      console.error("[team-sso] redeem failed", { pg: error.code })
      return fail("temporarily_unavailable")
    }
    redeemed = rpcRow<RedeemRow>(data)
  } catch {
    console.error("[team-sso] redeem failed")
    return fail("temporarily_unavailable")
  }
  if (!redeemed) return fail("temporarily_unavailable")
  if (redeemed.status !== "ok") {
    return fail(redeemed.status.startsWith("access_denied:") ? redeemed.status.slice("access_denied:".length) : redeemed.status)
  }
  const { session_id: ssoSessionId, user_id: userId } = redeemed
  if (!ssoSessionId || !userId || redeemed.activity !== TEAM_SSO_CLIENT_ID) return fail("invalid_grant")

  // From here on an SSO session exists: any failure ends it again.
  const abort = async (reason: string) => {
    try {
      await revokeSsoSession(deps.admin, userId, ssoSessionId)
    } catch {
      console.error("[team-sso] revoke failed")
    }
    return fail(reason)
  }
  const session = deps.sessionClient(jar)
  const signOutHere = async () => {
    try {
      await session.auth.signOut({ scope: "local" })
    } catch {
      console.error("[team-sso] sign-out failed")
    }
  }
  let signedIn = false

  try {
    // 4. The person's CLASSROOM account. The email comes from Supabase Auth
    //    (not from TEAM's copy): generateLink must address this exact user.
    const { data: authData, error: authError } = await deps.admin.auth.admin.getUserById(userId)
    const email = authData?.user?.email
    if (authError || !email) {
      console.error("[team-sso] auth user read failed", { status: authError?.status })
      return abort("temporarily_unavailable")
    }
    const profile = await ensureClassroomProfile(deps.admin, { userId, email, fullName: redeemed.full_name })
    if (profile === "blocked") return abort("blocked")
    if (profile === "error") return abort("temporarily_unavailable")

    // 5. A new CLASSROOM session. Whatever session this browser brought (any
    //    person) is signed out first, only that session (scope local).
    const { data: existing } = await session.auth.getSession()
    if (existing.session) await signOutHere()

    const { data: link, error: linkError } = await deps.admin.auth.admin.generateLink({ type: "magiclink", email })
    const tokenHash = link?.properties?.hashed_token
    if (linkError || !tokenHash || link.user?.id !== userId) {
      console.error("[team-sso] generateLink failed", { status: linkError?.status })
      return abort("temporarily_unavailable")
    }

    const { data: verified, error: verifyError } = await session.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash })
    if (verifyError || !verified.session) {
      console.error("[team-sso] verifyOtp failed", { status: verifyError?.status })
      return abort("temporarily_unavailable")
    }
    signedIn = true

    // 6. Bind the new CLASSROOM session to the SSO session. The session id is
    //    read from the access token Supabase has just issued, nothing else.
    const claims = accessTokenClaims(verified.session.access_token)
    if (!claims || claims.sub !== userId || verified.user?.id !== userId) {
      await signOutHere()
      return abort("invalid_grant")
    }
    const { data: linked, error: bindError } = await deps.admin.rpc("team_sso_link_client_session", {
      p_session_id: ssoSessionId,
      p_client_session_id: claims.sessionId,
    })
    if (bindError || linked !== true) {
      if (bindError) console.error("[team-sso] link failed", { pg: bindError.code })
      await signOutHere()
      return abort("invalid_grant")
    }
  } catch {
    console.error("[team-sso] sign-in failed")
    if (signedIn) await signOutHere()
    return abort("temporarily_unavailable")
  }

  // 7. Into CLASSROOM, so the code leaves the address bar.
  return respond(safeNextPath(flow.next, url.origin))
}
