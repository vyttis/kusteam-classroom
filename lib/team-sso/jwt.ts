const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `sub` and `session_id` of a Supabase access token. Used only on a token
 * this server has just received from Supabase Auth (verifyOtp, or the
 * session the proxy has just validated with getUser), so the signature is
 * not checked again here. Anything malformed gives null.
 */
export function accessTokenClaims(token: string | null | undefined): { sub: string; sessionId: string } | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      sub?: unknown
      session_id?: unknown
    }
    if (typeof payload.sub !== "string" || !UUID.test(payload.sub)) return null
    if (typeof payload.session_id !== "string" || !UUID.test(payload.session_id)) return null
    return { sub: payload.sub, sessionId: payload.session_id }
  } catch {
    return null
  }
}
