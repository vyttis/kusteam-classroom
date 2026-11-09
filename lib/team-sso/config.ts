/**
 * KU STEAM TEAM sign-in (SSO) for CLASSROOM: settings shared by the route
 * handlers, the proxy and the message page.
 *
 * Contract: kusteam-ai-lab docs/TEAM-SSO-INTEGRATION-CONTRACT.md (v1),
 * sections 3.1, 3.3, 4, 5 and 7. Decision: docs/ADR-001-TEAM-SSO.md.
 *
 * No server-only imports here: the message page and client code use it too.
 */

/** CLASSROOM's client id at TEAM (contract section 2). Fixed, not configurable. */
export const TEAM_SSO_CLIENT_ID = "classroom"

/** Short-lived cookie that carries state, PKCE verifier and `next` between start and callback. */
export const FLOW_COOKIE = "kusteam_team_sso_flow"
export const FLOW_COOKIE_PATH = "/auth/team"
export const FLOW_TTL_SECONDS = 600

/** Where a staff member lands when `next` is missing or not a safe path. */
export const DEFAULT_NEXT = "/dashboard"

const DEFAULT_TEAM_URL = "https://komanda.kusteam.app"

/** `TEAM_SSO_ENABLED=1` turns the TEAM sign-in on. Unset: /auth/team/* is 404. */
export function isTeamSsoEnabled(): boolean {
  return process.env.TEAM_SSO_ENABLED === "1"
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1"
  )
}

/**
 * TEAM's origin, https://komanda.kusteam.app unless TEAM_SSO_URL (contract
 * name) or TEAM_APP_URL points elsewhere, which local and CI tests do
 * (http is accepted only on a loopback host). A malformed value falls back
 * to the real TEAM, never to an arbitrary host.
 */
export function teamAppUrl(): string {
  const raw = process.env.TEAM_SSO_URL || process.env.TEAM_APP_URL
  if (!raw) return DEFAULT_TEAM_URL
  try {
    const url = new URL(raw)
    if (url.protocol === "https:" || (url.protocol === "http:" && isLoopbackHost(url.hostname))) {
      return url.origin
    }
  } catch {
    // fall through
  }
  return DEFAULT_TEAM_URL
}

/** TEAM's home page, where every "back to TEAM" button points. */
export function teamHomeUrl(): string {
  return `${teamAppUrl()}/`
}
