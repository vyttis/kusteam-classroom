import { createHmac, timingSafeEqual } from "node:crypto"

/** How long a rejoin link works after the facilitator shows it. */
export const REJOIN_TTL_MS = 10 * 60 * 1000

function key(): Buffer {
  const secret = process.env.REJOIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("no server secret for rejoin links")
  // A key of its own, derived from the server secret, so a rejoin signature
  // can never stand in for anything else signed with that secret.
  return createHmac("sha256", secret).update("kusteam-classroom:rejoin:v1").digest()
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url")
}

/**
 * What ties a link to the team's session at the moment the facilitator made
 * it: a keyed digest of the team's session token (never the token itself).
 * Using the link gives the team a new session token, so the digest no longer
 * matches and the link, and every other link made before, stops working.
 */
function sessionBinding(sessionToken: string): string {
  return createHmac("sha256", key()).update(`bind:${sessionToken}`).digest("base64url").slice(0, 22)
}

/**
 * A short-lived, single-use link token that moves a team's session to a new
 * device: "<teamId>.<expiry ms>.<session binding>.<signature>". It carries
 * no session token, so a photo of the QR is useless after ten minutes or
 * once the link was used, and the server still checks that the team and its
 * running activity exist when it is used.
 */
export function createRejoinToken(
  teamId: string,
  sessionToken: string,
  now = Date.now()
): { token: string; expiresAt: number } {
  const expiresAt = now + REJOIN_TTL_MS
  const payload = `${teamId}.${expiresAt}.${sessionBinding(sessionToken)}`
  return { token: `${payload}.${sign(payload)}`, expiresAt }
}

export type RejoinCheck =
  | { ok: true; teamId: string; binding: string }
  | { ok: false; reason: "invalid" | "expired" }

/** Signature and expiry. Whether the link was used already: rejoinTokenUnused(). */
export function verifyRejoinToken(token: string, now = Date.now()): RejoinCheck {
  const parts = token.split(".")
  if (parts.length !== 4) return { ok: false, reason: "invalid" }
  const [teamId, exp, binding, signature] = parts
  if (!/^[0-9a-f-]{36}$/i.test(teamId) || !/^\d{13}$/.test(exp) || !/^[A-Za-z0-9_-]{22}$/.test(binding)) {
    return { ok: false, reason: "invalid" }
  }
  const expected = Buffer.from(sign(`${teamId}.${exp}.${binding}`))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalid" }
  if (Number(exp) < now) return { ok: false, reason: "expired" }
  return { ok: true, teamId, binding }
}

/**
 * true while the team still has the session token the link was made for.
 * false once a rejoin link gave the team a new one: the link is spent.
 */
export function rejoinTokenUnused(binding: string, currentSessionToken: string): boolean {
  const expected = Buffer.from(sessionBinding(currentSessionToken))
  const given = Buffer.from(binding)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
