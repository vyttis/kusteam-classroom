import { NextResponse, type NextRequest } from "next/server"
import { FLOW_COOKIE, FLOW_COOKIE_PATH, FLOW_TTL_SECONDS, isLoopbackHost } from "@/lib/team-sso/config"
import { hostKind } from "@/lib/hosts"

/**
 * The TEAM sign-in runs on pamokos.kusteam.app (and the bare domain, and a
 * loopback address in tests). The legacy app./play. hosts do not serve it:
 * TEAM sends the code to the pamokos callback only.
 */
export function servesTeamSso(request: NextRequest): boolean {
  const kind = hostKind(request.headers.get("host") || request.nextUrl.host)
  return kind === "pamokos" || kind === "root"
}

/** Secure everywhere except plain http on a loopback host (local tests). */
export function secureCookies(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || !isLoopbackHost(request.nextUrl.hostname)
}

/**
 * A redirect to a path on this site with a relative Location, so the
 * browser stays on the host it used (cookies were just set there). Route
 * handlers would otherwise build the absolute URL from their own idea of
 * the origin (e.g. "localhost" for a server reached as 127.0.0.1).
 */
export function redirectHere(path: string, status = 303): NextResponse {
  return new NextResponse(null, { status, headers: { Location: path } })
}

/** Every SSO response: never cached, never sends a referrer onwards. */
export function ssoHeaders<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}

export function setFlowCookie(response: NextResponse, request: NextRequest, value: string): void {
  response.cookies.set(FLOW_COOKIE, value, {
    httpOnly: true,
    secure: secureCookies(request),
    sameSite: "lax",
    path: FLOW_COOKIE_PATH,
    maxAge: FLOW_TTL_SECONDS,
  })
}

export function clearFlowCookie(response: NextResponse, request: NextRequest): void {
  response.cookies.set(FLOW_COOKIE, "", {
    httpOnly: true,
    secure: secureCookies(request),
    sameSite: "lax",
    path: FLOW_COOKIE_PATH,
    maxAge: 0,
  })
}
