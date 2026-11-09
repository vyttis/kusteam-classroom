import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { grantAccount } from "@/lib/access/approve"

// 2026-11-09: a teacher opened the Supabase invitation link the next
// morning; it had expired after an hour and the unconfirmed account could
// not get a sign-in code either. Accounts are now created confirmed and the
// email links to /vedejui.

function mockAdmin(opts: { existingProfile?: { id: string } | null; confirmed?: boolean }) {
  const createUser = vi.fn(async () => ({ data: { user: { id: "new-user" } }, error: null }))
  const inviteUserByEmail = vi.fn()
  const getUserById = vi.fn(async () => ({
    data: { user: { id: "old-user", email_confirmed_at: opts.confirmed ? "2026-03-08T10:00:00Z" : null } },
    error: null,
  }))
  const updateUserById = vi.fn(async () => ({ data: { user: { id: "old-user" } }, error: null }))
  const deleteUser = vi.fn()

  const from = () => {
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.eq = () => chain
    chain.maybeSingle = async () => ({ data: opts.existingProfile ?? null, error: null })
    chain.update = () => ({ eq: async () => ({ error: null }) })
    return chain
  }
  const admin = {
    from,
    auth: { admin: { createUser, inviteUserByEmail, getUserById, updateUserById, deleteUser } },
  } as unknown as SupabaseClient
  return { admin, createUser, inviteUserByEmail, getUserById, updateUserById }
}

const account = {
  email: "Mokytoja@Example.lt",
  first_name: "Testinis",
  last_name: "Vedėjas",
  school_code: null,
  school_name: null,
  municipality: null,
}

describe("grantAccount", () => {
  it("creates a confirmed account instead of sending an expiring invitation link", async () => {
    const m = mockAdmin({ existingProfile: null })
    const result = await grantAccount(m.admin, account, "admin-1")
    expect(result).toEqual({ ok: true, userId: "new-user", existing: false })
    expect(m.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "mokytoja@example.lt", email_confirm: true }),
    )
    expect(m.inviteUserByEmail).not.toHaveBeenCalled()
  })

  it("confirms an earlier invited account that never opened its link", async () => {
    const m = mockAdmin({ existingProfile: { id: "old-user" }, confirmed: false })
    const result = await grantAccount(m.admin, account, "admin-1")
    expect(result).toEqual({ ok: true, userId: "old-user", existing: true })
    expect(m.updateUserById).toHaveBeenCalledWith("old-user", { email_confirm: true })
    expect(m.createUser).not.toHaveBeenCalled()
  })

  it("leaves an already confirmed account's confirmation alone", async () => {
    const m = mockAdmin({ existingProfile: { id: "old-user" }, confirmed: true })
    await grantAccount(m.admin, account, "admin-1")
    expect(m.updateUserById).not.toHaveBeenCalled()
  })
})
