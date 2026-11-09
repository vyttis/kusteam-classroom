import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { FLOW_TTL_SECONDS } from "@/lib/team-sso/config"

/** 32 random bytes, base64url without padding (43 characters): state and PKCE verifier. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url")
}

/** PKCE S256: base64url(sha256(ascii(verifier))), RFC 7636 section 4.2. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url")
}

/** Hex sha256, as TEAM stores codes (`team_sso_codes.code_hash`). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

/** Constant-time string comparison (lengths are hidden by hashing first). */
export function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest()
  const hb = createHash("sha256").update(b, "utf8").digest()
  return timingSafeEqual(ha, hb) && a.length === b.length
}

/**
 * Key for the flow cookie: TEAM_SSO_FLOW_SECRET when set, otherwise derived
 * from SUPABASE_SERVICE_ROLE_KEY. Either way it is an HMAC with a purpose
 * string, so it never equals the secret and stands in for nothing else
 * signed with it (same approach as lib/game/rejoin-token.ts).
 */
function flowKey(): Buffer {
  const secret = process.env.TEAM_SSO_FLOW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("no server secret for the TEAM sign-in flow cookie")
  return createHmac("sha256", secret).update("kusteam-classroom:team-sso:flow-cookie:v1").digest()
}

export interface FlowState {
  state: string
  verifier: string
  next: string
  created: number
}

const AAD = Buffer.from("kusteam-classroom team-sso flow v1")

/**
 * Seals the flow with AES-256-GCM: the verifier is never readable, and a
 * changed cookie fails authentication.
 */
export function sealFlow(flow: FlowState): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", flowKey(), iv)
  cipher.setAAD(AAD)
  const body = Buffer.from(JSON.stringify({ s: flow.state, v: flow.verifier, n: flow.next, t: flow.created }), "utf8")
  const sealed = Buffer.concat([cipher.update(body), cipher.final()])
  return Buffer.concat([iv, sealed, cipher.getAuthTag()]).toString("base64url")
}

/** The flow, or null if the cookie is missing, altered, malformed or older than 10 minutes. */
export function openFlow(value: string | undefined | null, now = Date.now()): FlowState | null {
  if (!value || value.length > 2048) return null
  try {
    const raw = Buffer.from(value, "base64url")
    if (raw.length < 12 + 16 + 2) return null
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(raw.length - 16)
    const body = raw.subarray(12, raw.length - 16)
    const decipher = createDecipheriv("aes-256-gcm", flowKey(), iv)
    decipher.setAAD(AAD)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")
    const parsed = JSON.parse(plain) as { s?: unknown; v?: unknown; n?: unknown; t?: unknown }
    if (
      typeof parsed.s !== "string" ||
      typeof parsed.v !== "string" ||
      typeof parsed.n !== "string" ||
      typeof parsed.t !== "number"
    ) {
      return null
    }
    const age = now - parsed.t
    if (age < -60_000 || age > FLOW_TTL_SECONDS * 1000) return null
    return { state: parsed.s, verifier: parsed.v, next: parsed.n, created: parsed.t }
  } catch {
    return null
  }
}
