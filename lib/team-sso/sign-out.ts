import { NextResponse, type NextRequest } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { teamHomeUrl } from "@/lib/team-sso/config"
import { ssoHeaders } from "@/lib/team-sso/http"
import { accessTokenClaims } from "@/lib/team-sso/jwt"
import { revokeSsoSession, ssoSessionForClientSession } from "@/lib/team-sso/sessions"
import { endedStaffSession } from "@/lib/team-sso/staff-gate"
import { applyCookieWrites, cookieJar, signOutLocal, type CookieJar } from "@/lib/team-sso/session-client"

export interface SignOutDeps {
  admin: SupabaseClient
  sessionClient: (jar: CookieJar) => SupabaseClient
}

/**
 * POST /auth/team/sign-out: "Atsijungti" for a TEAM staff member inside
 * CLASSROOM (contract 4). Ends this CLASSROOM session only (scope local:
 * the TEAM session lives in the same Supabase project and must stay) and
 * records the end of its SSO session. Teachers keep their own sign-out.
 * team_sso_revoke also deletes this CLASSROOM session on the server, so the
 * local sign-out after it may find the session gone; signOutLocal clears
 * the cookies anyway.
 * Answers where to go next: TEAM for staff, /vedejui otherwise.
 */
export async function signOutStaff(request: NextRequest, deps: SignOutDeps): Promise<NextResponse> {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  if (origin && host) {
    let sameOrigin = false
    try {
      sameOrigin = new URL(origin).host === host
    } catch {
      sameOrigin = false
    }
    if (!sameOrigin) return ssoHeaders(NextResponse.json({ error: "Neleistina užklausa." }, { status: 403 }))
  }

  const cookies = request.cookies.getAll()
  const jar = cookieJar(cookies)
  const session = deps.sessionClient(jar)
  let redirect = "/vedejui"

  const {
    data: { user },
  } = await session.auth.getUser()
  if (user) {
    const { data: profile } = await deps.admin.from("profiles").select("role").eq("id", user.id).maybeSingle()
    if ((profile as { role?: string } | null)?.role === "staff") {
      redirect = teamHomeUrl()
      const {
        data: { session: current },
      } = await session.auth.getSession()
      const claims = accessTokenClaims(current?.access_token)
      if (claims && claims.sub === user.id) {
        const ssoId = await ssoSessionForClientSession(deps.admin, user.id, claims.sessionId)
        if (ssoId) await revokeSsoSession(deps.admin, user.id, ssoId)
      }
    }
  } else if (await endedStaffSession(cookies, () => deps.admin)) {
    // Already revoked by TEAM (and deleted on the server): back to TEAM.
    redirect = teamHomeUrl()
  }
  await signOutLocal(session, jar)

  const response = NextResponse.json({ ok: true, redirect })
  applyCookieWrites(response, jar.writes)
  return ssoHeaders(response)
}
