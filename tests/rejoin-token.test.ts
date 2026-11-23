import { beforeAll, describe, expect, it } from "vitest"
import { createRejoinToken, REJOIN_TTL_MS, rejoinTokenUnused, verifyRejoinToken } from "@/lib/game/rejoin-token"

const TEAM = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b"
const SESSION = "session-token-of-the-team"

beforeAll(() => {
  process.env.REJOIN_SECRET = "test-secret-for-rejoin"
})

describe("rejoin tokens", () => {
  it("accepts its own token before it expires", () => {
    const now = 1_790_000_000_000
    const { token, expiresAt } = createRejoinToken(TEAM, SESSION, now)
    expect(expiresAt).toBe(now + REJOIN_TTL_MS)
    expect(verifyRejoinToken(token, now + 60_000)).toEqual({ ok: true, teamId: TEAM, binding: token.split(".")[2] })
  })

  it("rejects an expired token", () => {
    const now = 1_790_000_000_000
    const { token } = createRejoinToken(TEAM, SESSION, now)
    expect(verifyRejoinToken(token, now + REJOIN_TTL_MS + 1)).toEqual({ ok: false, reason: "expired" })
  })

  it("rejects a token for another team or with a longer life", () => {
    const now = 1_790_000_000_000
    const { token } = createRejoinToken(TEAM, SESSION, now)
    const [, exp, binding, sig] = token.split(".")
    const other = "00000000-0000-4000-8000-000000000000"
    expect(verifyRejoinToken(`${other}.${exp}.${binding}.${sig}`, now)).toEqual({ ok: false, reason: "invalid" })
    expect(verifyRejoinToken(`${TEAM}.${Number(exp) + 3_600_000}.${binding}.${sig}`, now)).toEqual({ ok: false, reason: "invalid" })
    expect(verifyRejoinToken("garbage", now)).toEqual({ ok: false, reason: "invalid" })
    // The form before single use (no session binding) is no longer accepted.
    expect(verifyRejoinToken(`${TEAM}.${exp}.${sig}`, now)).toEqual({ ok: false, reason: "invalid" })
  })

  it("rejects a token signed with another secret", () => {
    const now = 1_790_000_000_000
    const { token } = createRejoinToken(TEAM, SESSION, now)
    process.env.REJOIN_SECRET = "another-secret"
    expect(verifyRejoinToken(token, now)).toEqual({ ok: false, reason: "invalid" })
    process.env.REJOIN_SECRET = "test-secret-for-rejoin"
  })

  it("is tied to the session the team had when the link was made (single use)", () => {
    const now = 1_790_000_000_000
    const { token } = createRejoinToken(TEAM, SESSION, now)
    const check = verifyRejoinToken(token, now)
    if (!check.ok) throw new Error("the token must verify")
    // Unused: the team still has that session.
    expect(rejoinTokenUnused(check.binding, SESSION)).toBe(true)
    // Used: the rejoin gave the team another session token.
    expect(rejoinTokenUnused(check.binding, "the-new-session-token")).toBe(false)
    // Another link made before the use dies with it; one made after works.
    const earlier = verifyRejoinToken(createRejoinToken(TEAM, SESSION, now - 1000).token, now)
    const later = verifyRejoinToken(createRejoinToken(TEAM, "the-new-session-token", now).token, now)
    if (!earlier.ok || !later.ok) throw new Error("the tokens must verify")
    expect(rejoinTokenUnused(earlier.binding, "the-new-session-token")).toBe(false)
    expect(rejoinTokenUnused(later.binding, "the-new-session-token")).toBe(true)
  })

  it("does not carry the session token and cannot be re-bound to another session", () => {
    const now = 1_790_000_000_000
    const { token } = createRejoinToken(TEAM, SESSION, now)
    expect(token).not.toContain(SESSION)
    const [team, exp, , sig] = token.split(".")
    const otherBinding = createRejoinToken(TEAM, "the-new-session-token", now).token.split(".")[2]
    expect(verifyRejoinToken(`${team}.${exp}.${otherBinding}.${sig}`, now)).toEqual({ ok: false, reason: "invalid" })
  })
})
