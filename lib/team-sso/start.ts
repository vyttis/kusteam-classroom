import { NextResponse, type NextRequest } from "next/server"
import { TEAM_SSO_CLIENT_ID, teamAppUrl } from "@/lib/team-sso/config"
import { pkceChallenge, randomToken, sealFlow } from "@/lib/team-sso/crypto"
import { redirectHere, setFlowCookie, ssoHeaders } from "@/lib/team-sso/http"
import { messagePath } from "@/lib/team-sso/messages"
import { safeNextPath } from "@/lib/team-sso/next-path"

/**
 * GET /auth/team/start (contract 3.1): a new state and PKCE verifier in a
 * sealed 10-minute cookie, then 303 to TEAM's authorize page. A new start
 * replaces any earlier flow. Works signed in or not.
 */
export function startTeamSignIn(request: NextRequest): NextResponse {
  const url = request.nextUrl
  const next = safeNextPath(url.searchParams.get("next"), url.origin)
  const state = randomToken()
  const verifier = randomToken()

  let sealed: string
  try {
    sealed = sealFlow({ state, verifier, next, created: Date.now() })
  } catch {
    // No server secret configured: nothing can be signed in safely.
    console.error("[team-sso] flow cookie key missing")
    return ssoHeaders(redirectHere(messagePath("nepasiekiamas")))
  }

  const authorize = new URL("/sso/authorize", teamAppUrl())
  authorize.searchParams.set("client_id", TEAM_SSO_CLIENT_ID)
  authorize.searchParams.set("state", state)
  authorize.searchParams.set("code_challenge", pkceChallenge(verifier))
  authorize.searchParams.set("code_challenge_method", "S256")

  const response = NextResponse.redirect(authorize, 303)
  setFlowCookie(response, request, sealed)
  return ssoHeaders(response)
}
