import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { passwordErrorMessage, passwordSchema } from "@/lib/access/password"

const bodySchema = z.object({ password: passwordSchema })

// POST /api/account/password: a signed-in facilitator sets or replaces the
// password of their own account. The session proves who they are: they came
// in with a password, Google, or a one-time code from their mailbox (which is
// also the "forgot password" path).
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Prisijunkite iš naujo." }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Netinkamas užklausos formatas." }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Netinkamas slaptažodis." }, { status: 400 })
  }

  // KU STEAM staff share this Auth project with KU STEAM TEAM: their password
  // belongs to TEAM and must never be changed from here. The proxy already
  // stops staff; this is the second lock.
  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", user.id).single()
  if (!profile || profile.role === "staff") {
    return NextResponse.json({ error: "KU STEAM darbuotojo slaptažodį tvarko KU STEAM TEAM." }, { status: 403 })
  }
  if (profile.status !== "active") {
    return NextResponse.json({ error: "Paskyra dar nepatvirtinta." }, { status: 403 })
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    console.error("[account] password change failed", { code: error.code, status: error.status })
    return NextResponse.json({ error: passwordErrorMessage(error) }, { status: error.status === 422 ? 422 : 400 })
  }
  return NextResponse.json({ ok: true })
}
