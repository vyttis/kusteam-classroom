import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole } from "@/lib/auth/roles"
import { logAdminAction } from "@/lib/access/approve"
import { NextResponse } from "next/server"
import { z } from "zod"

// GET /api/admin/users — list all users (admin+ only)
export async function GET() {
  try {
    const supabase = await createClient()
    await requireRole(supabase, "admin", "super_admin")

    const { data: users, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(users)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prieiga uždrausta" },
      { status: 403 }
    )
  }
}

// 'staff' is never a target: only the KU STEAM TEAM sign-in (service role)
// gives or removes it.
const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["teacher", "admin", "super_admin"]),
})

// PATCH /api/admin/users — change user role (super_admin only)
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    await requireRole(supabase, "super_admin")

    const body = await request.json()
    const parsed = updateRoleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Neteisingi duomenys" },
        { status: 400 }
      )
    }
    const { userId, role } = parsed.data

    // Prevent self-demotion
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.id === userId) {
      return NextResponse.json(
        { error: "Negalite keisti savo paties rolės" },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS for role update
    const adminClient = createAdminClient()
    const { data: before } = await adminClient.from("profiles").select("role, email").eq("id", userId).maybeSingle()
    if (!before) {
      return NextResponse.json({ error: "Vartotojas nerastas" }, { status: 404 })
    }
    // A KU STEAM TEAM staff member's role belongs to TEAM (ADR-001). The
    // admin may still block or unblock the profile (status route).
    if (before.role === "staff") {
      return NextResponse.json(
        { error: "KU STEAM darbuotojo rolės čia keisti negalima. Ją valdo KU STEAM TEAM." },
        { status: 409 }
      )
    }
    const { error } = await adminClient
      .from("profiles")
      .update({ role })
      .eq("id", userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Role changes are security-sensitive: keep who did what.
    await logAdminAction(adminClient, user!.id, "profile.role_change", "profile", userId, {
      email: before.email,
      from: before.role,
      to: role,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prieiga uždrausta" },
      { status: 403 }
    )
  }
}
