import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryDouble, silenceConsole } from "./helpers/team-sso"

// CLASSROOM role 'staff' (TEAM-006): like a teacher for own content, never
// an admin, and its role is managed by KU STEAM TEAM only.

const state = {
  callerRole: "super_admin",
  target: { role: "staff", email: "darbuotoja@ku.lt", status: "active", first_name: null } as Record<string, unknown> | null,
  writes: [] as { op: string; values: unknown }[],
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string) => {
      if (fn !== "get_my_role") throw new Error(fn)
      return { data: state.callerRole, error: null }
    },
    auth: { getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-00000000aaaa" } }, error: null }) },
    from: () => queryDouble({ data: { status: "active" }, error: null }),
  }),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        return queryDouble(() => ({ data: state.target, error: null }), state.writes)
      }
      if (table === "admin_audit_log") return queryDouble({ data: null, error: null }, state.writes)
      if (table === "access_requests") return queryDouble({ data: null, error: null }, state.writes)
      throw new Error(table)
    },
  }),
}))

// The caller is a super admin for requireSuperAdmin too.
const superAdminProfile = { role: "super_admin", status: "active" }

let consoleCapture: ReturnType<typeof silenceConsole>
beforeEach(() => {
  state.callerRole = "super_admin"
  state.target = { role: "staff", email: "darbuotoja@ku.lt", status: "active", first_name: null }
  state.writes = []
  consoleCapture = silenceConsole()
})
afterEach(() => consoleCapture.restore())

function patch(body: unknown) {
  return new Request("https://pamokos.kusteam.app/api/admin/users", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("admin API and staff profiles", () => {
  it("refuses any role change for a staff profile", async () => {
    const { PATCH } = await import("@/app/api/admin/users/route")
    for (const role of ["teacher", "admin", "super_admin"]) {
      const res = await PATCH(patch({ userId: "00000000-0000-4000-8000-0000000000d1", role }))
      expect(res.status, role).toBe(409)
    }
    expect(state.writes).toEqual([])
  })

  it("never sets the staff role", async () => {
    const { PATCH } = await import("@/app/api/admin/users/route")
    state.target = { role: "teacher", email: "mokytoja@example.lt" }
    const res = await PATCH(patch({ userId: "00000000-0000-4000-8000-0000000000d1", role: "staff" }))
    expect(res.status).toBe(400)
    expect(state.writes).toEqual([])
  })

  it("still changes a teacher's role (unchanged behaviour)", async () => {
    const { PATCH } = await import("@/app/api/admin/users/route")
    state.target = { role: "teacher", email: "mokytoja@example.lt" }
    const res = await PATCH(patch({ userId: "00000000-0000-4000-8000-0000000000d1", role: "admin" }))
    expect(res.status).toBe(200)
    expect(state.writes[0]).toEqual({ op: "update", values: { role: "admin" } })
  })

  it("lets the super admin block a staff profile (status only)", async () => {
    vi.resetModules()
    vi.doMock("@/lib/access/admin-guard", () => ({
      requireSuperAdmin: async () => ({
        ok: true,
        userId: "00000000-0000-4000-8000-00000000aaaa",
        admin: {
          from: (table: string) =>
            queryDouble({ data: table === "profiles" ? { ...state.target, ...superAdminProfile, role: "staff" } : null, error: null }, state.writes),
        },
      }),
    }))
    const { PATCH } = await import("@/app/api/admin/users/[id]/status/route")
    const req = new Request("https://pamokos.kusteam.app/api/admin/users/x/status", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "blocked" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "00000000-0000-4000-8000-0000000000d1" }) })
    expect(res.status).toBe(200)
    expect(state.writes[0]).toEqual({ op: "update", values: { status: "blocked" } })
    vi.doUnmock("@/lib/access/admin-guard")
  })
})

describe("account approval and invitation never touch a staff profile", () => {
  it("grantAccount refuses an email that belongs to a staff profile", async () => {
    const { grantAccount } = await import("@/lib/access/approve")
    const writes: { op: string; values: unknown }[] = []
    const createUser = vi.fn()
    const admin = {
      from: () => queryDouble({ data: { id: "u1", role: "staff", first_name: null, last_name: null, school: null }, error: null }, writes),
      auth: { admin: { createUser, getUserById: vi.fn(), updateUserById: vi.fn() } },
    } as unknown as SupabaseClient
    const result = await grantAccount(
      admin,
      { email: "darbuotoja@ku.lt", first_name: "Ona", last_name: "D", school_code: null, school_name: null, municipality: null, role: "admin" },
      "admin-1",
    )
    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(writes).toEqual([])
    expect(createUser).not.toHaveBeenCalled()
  })
})

describe("role helpers", () => {
  it("treat staff as never an admin, and label it", async () => {
    const roles = await import("@/lib/auth/roles")
    const { ROLE_LABEL } = await import("@/lib/admin/user-rows")
    expect(roles.canViewAdminDashboard("staff")).toBe(false)
    expect(roles.canApproveLibrary("staff")).toBe(false)
    expect(roles.canManageUsers("staff")).toBe(false)
    expect(roles.canChangeRoles("staff")).toBe(false)
    expect(roles.canViewAnalytics("staff")).toBe(false)
    expect(roles.canDeleteLibraryItem("staff")).toBe(false)
    expect(roles.getRoleLabel("staff")).toBe("KU STEAM darbuotojas")
    expect(ROLE_LABEL.staff).toBe("KU STEAM darbuotojas")
  })

  it("requireRole refuses staff for admin actions", async () => {
    const { requireRole } = await import("@/lib/auth/roles")
    const supabase = { rpc: async () => ({ data: "staff", error: null }) } as unknown as SupabaseClient
    await expect(requireRole(supabase, "admin", "super_admin")).rejects.toThrow(/Prieiga uždrausta/)
    await expect(requireRole(supabase, "super_admin")).rejects.toThrow(/Prieiga uždrausta/)
  })

  it("every admin check in API routes compares against admin roles, never 'not teacher'", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs")
    const { join } = await import("node:path")
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const p = join(dir, name)
        return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : []
      })
    const offenders = [...files("app"), ...files("components"), ...files("lib")].filter((f) =>
      /role\s*!==?\s*["']teacher["']|["']teacher["']\s*!==?\s*role/.test(readFileSync(f, "utf8")),
    )
    // lib/auth/roles.ts: requireRole's "admin powers need an active account"
    // runs only after the role was found in the allowed list.
    expect(offenders).toEqual(["lib/auth/roles.ts"])
  })
})
