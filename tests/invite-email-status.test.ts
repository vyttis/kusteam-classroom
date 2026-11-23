import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "fs"
import path from "path"
import type { SupabaseClient } from "@supabase/supabase-js"

// R-06 (readiness audit 2026-11-22): approving a request or inviting a
// facilitator answered "invitation sent" although the email went out after
// the response and a failure was only logged. The routes now await the
// email and report what happened.

const state = vi.hoisted(() => ({
  existing: false,
  request: { status: "pending" } as { status: string } | null,
  guardOk: true,
}))

/** A Supabase stand-in: every chain resolves to the same row. */
function fakeAdmin(): SupabaseClient {
  const row = () => ({
    id: "req-1",
    email: "ona@mokykla.lt",
    first_name: "Ona",
    last_name: "Onaitė",
    school_code: null,
    school_name: null,
    municipality: null,
    ...state.request,
  })
  const from = () => {
    const chain: Record<string, unknown> = {}
    for (const method of ["select", "eq", "or", "update", "insert"]) chain[method] = () => chain
    chain.maybeSingle = async () => ({ data: state.request ? row() : null, error: null })
    chain.single = async () => ({ data: { id: "user-1", email: "ona@mokykla.lt" }, error: null })
    // Awaiting the chain itself (update ... select): one claimed row.
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [{ id: "req-1" }], error: null })
    return chain
  }
  const generateLink = async () => ({ data: { properties: { hashed_token: "tokenhash" } }, error: null })
  return { from, auth: { admin: { generateLink } } } as unknown as SupabaseClient
}

vi.mock("@/lib/access/admin-guard", () => ({
  requireSuperAdmin: async () =>
    state.guardOk
      ? { ok: true, userId: "admin-1", admin: fakeAdmin() }
      : { ok: false, response: Response.json({ error: "Tik super administratorius gali tai daryti." }, { status: 403 }) },
}))

vi.mock("@/lib/access/approve", async (original) => ({
  ...(await original<typeof import("@/lib/access/approve")>()),
  grantAccount: async () => ({ ok: true, userId: "user-1", existing: state.existing }),
  logAdminAction: async () => {},
}))

import { POST as invite } from "@/app/api/admin/invite/route"
import { POST as decide } from "@/app/api/admin/access-requests/[id]/route"
import { accountEmailNotice } from "@/lib/access/notify"
import { emailDelivery } from "@/lib/email/send"

const SECRET = "re_test_secret_value"

function inviteRequest() {
  return new Request("https://pamokos.kusteam.app/api/admin/invite", {
    method: "POST",
    body: JSON.stringify({ email: "Ona@Mokykla.lt", first_name: "Ona", last_name: "Onaitė", role: "teacher" }),
  })
}

function approveRequest() {
  return new Request("https://pamokos.kusteam.app/api/admin/access-requests/req-1", {
    method: "POST",
    body: JSON.stringify({ action: "approve" }),
  })
}

const approve = () => decide(approveRequest(), { params: Promise.resolve({ id: "req-1" }) })

function provider(status: number | "down") {
  const fetchMock =
    status === "down"
      ? vi.fn().mockRejectedValue(new TypeError("fetch failed"))
      : vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "provider detail" }), { status }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  state.existing = false
  state.request = { status: "pending" }
  state.guardOk = true
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("emailDelivery", () => {
  it("maps a send result to what the administrator may know", () => {
    expect(emailDelivery({ ok: true })).toEqual({ sent: true })
    expect(emailDelivery({ ok: false, skipped: true })).toEqual({ sent: false, reason: "not_configured" })
    expect(emailDelivery({ ok: false })).toEqual({ sent: false, reason: "provider_error" })
  })
})

describe("POST /api/admin/invite", () => {
  it("says the invitation was sent only when Resend accepted it", async () => {
    vi.stubEnv("RESEND_API_KEY", SECRET)
    const fetchMock = provider(200)
    const res = await invite(inviteRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, existing: false, email: { sent: true } })
    expect(body.message).toContain("Kvietimas išsiųstas")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // A new account gets the one-time link to the registration form.
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.to).toEqual(["ona@mokykla.lt"])
    expect(sent.text).toContain("/auth/confirm?token_hash=tokenhash")
  })

  it("reports an account without an email when email is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    const fetchMock = provider(200)
    const res = await invite(inviteRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.user).toBeTruthy()
    expect(body.email).toEqual({ sent: false, reason: "not_configured" })
    expect(body.message).toContain("Paskyra sukurta.")
    expect(body.message).toContain("kvietimo laiškas neišsiųstas")
    expect(body.message).toContain("Siųsti dar kartą")
    expect(body.message).not.toMatch(/išsiųstas el\. paštu/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ["rejects the email", 422 as const],
    ["answers with a server error", 500 as const],
    ["is unreachable", "down" as const],
  ])("reports a provider error when Resend %s, without leaking details", async (_name, status) => {
    vi.stubEnv("RESEND_API_KEY", SECRET)
    provider(status)
    const res = await invite(inviteRequest())
    const text = await res.text()
    const body = JSON.parse(text)
    expect(res.status).toBe(200)
    expect(body.email).toEqual({ sent: false, reason: "provider_error" })
    expect(body.message).toContain("laiškų siuntimo paslauga jo nepriėmė")
    for (const leak of [SECRET, "provider detail", "RESEND_API_KEY", "422", "fetch failed"]) {
      expect(text, leak).not.toContain(leak)
    }
  })

  it("sending the form again emails the sign-in link to the account that now exists", async () => {
    vi.stubEnv("RESEND_API_KEY", SECRET)
    const fetchMock = provider(200)
    state.existing = true
    const body = await (await invite(inviteRequest())).json()
    expect(body).toMatchObject({ existing: true, email: { sent: true } })
    expect(body.message).toContain("rolė nepakeista")
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.text).toContain("/vedejui")
    expect(sent.text).not.toContain("token_hash")
  })

  it("stays closed to everyone but the super admin", async () => {
    state.guardOk = false
    const fetchMock = provider(200)
    expect((await invite(inviteRequest())).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("POST /api/admin/access-requests/[id] (approve)", () => {
  it("reports a sent invitation", async () => {
    vi.stubEnv("RESEND_API_KEY", SECRET)
    provider(200)
    const body = await (await approve()).json()
    expect(body).toMatchObject({ ok: true, status: "approved", existing: false, email: { sent: true } })
    expect(body.message).toContain("Kvietimas išsiųstas")
  })

  it("approves but says so when the email did not go out", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    const res = await approve()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, status: "approved", email: { sent: false, reason: "not_configured" } })
    expect(body.message).toContain("neišsiųstas")

    vi.stubEnv("RESEND_API_KEY", SECRET)
    provider(503)
    const failed = await (await approve()).json()
    expect(failed.email).toEqual({ sent: false, reason: "provider_error" })
  })

  it("still refuses a request that was already decided", async () => {
    state.request = { status: "approved" }
    expect((await approve()).status).toBe(409)
    state.request = null
    expect((await approve()).status).toBe(404)
  })
})

describe("accountEmailNotice", () => {
  const all = [
    accountEmailNotice(false, { sent: true }),
    accountEmailNotice(true, { sent: true }),
    accountEmailNotice(false, { sent: false, reason: "not_configured" }),
    accountEmailNotice(false, { sent: false, reason: "provider_error" }),
    accountEmailNotice(true, { sent: false, reason: "not_configured" }),
    accountEmailNotice(true, { sent: false, reason: "provider_error" }),
  ]

  it("never claims a sent email when it was not sent, and offers to send again", () => {
    for (const text of all.slice(2)) {
      expect(text).toContain("neišsiųstas")
      expect(text).toContain("Siųsti dar kartą")
    }
    for (const text of all.slice(0, 2)) expect(text).not.toContain("neišsiųstas")
  })

  it("tells the two reasons apart", () => {
    expect(all[2]).toContain("nesukonfigūruotas")
    expect(all[3]).not.toContain("nesukonfigūruotas")
  })

  it("uses no long dashes and the role word „vedėjas“", () => {
    for (const text of all) {
      expect(text).not.toMatch(/[—–]/)
      expect(text).not.toMatch(/mokytoj/i)
    }
  })
})

describe("admin screens", () => {
  const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8")

  it("check email.sent and offer to send again", () => {
    for (const file of ["components/admin/invite-user-dialog.tsx", "components/admin/access-requests-panel.tsx"]) {
      const source = read(file)
      expect(source, file).toContain("email?.sent === false")
      expect(source, file).toContain("<EmailNotSentNotice")
      expect(source, file).toContain("resendAccountEmail(")
    }
    expect(read("components/admin/email-not-sent-notice.tsx")).toContain("Siųsti dar kartą")
  })

  it("the account routes no longer send the account email after the response", () => {
    expect(read("app/api/admin/invite/route.ts")).not.toContain("after(() =>")
    expect(read("app/api/admin/access-requests/[id]/route.ts")).toContain("await sendAccountEmail(")
  })
})
