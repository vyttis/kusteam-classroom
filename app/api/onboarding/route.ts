import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { onboardingSchema } from "@/lib/access/profile-fields"
import { findSchoolByCode } from "@/lib/access/schools"
import { passwordErrorMessage, passwordSchema } from "@/lib/access/password"

// POST /api/onboarding: the facilitator completes the profile on first
// sign-in. Writes only the columns authenticated users may update (see the
// column grants in the migrations); status and role stay server-controlled.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Prisijunkite iš naujo." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Netinkamas užklausos formatas." }, { status: 400 })
  }
  const parsed = onboardingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Patikrinkite laukus." }, { status: 400 })
  }

  // Optional: a facilitator who came in by invitation link creates the
  // password for later sign-ins here. Set before the profile is marked as
  // complete, so a rejected password leaves onboarding open.
  const rawPassword = (body as { password?: unknown } | null)?.password
  if (rawPassword !== undefined) {
    const password = passwordSchema.safeParse(rawPassword)
    if (!password.success) {
      return NextResponse.json({ error: password.error.issues[0]?.message || "Netinkamas slaptažodis." }, { status: 400 })
    }
    const { error: passwordError } = await supabase.auth.updateUser({ password: password.data })
    if (passwordError) {
      console.error("[onboarding] password failed", { code: passwordError.code, status: passwordError.status })
      return NextResponse.json({ error: passwordErrorMessage(passwordError) }, { status: 400 })
    }
  }

  const d = parsed.data
  const registry = d.school_code ? findSchoolByCode(d.school_code) : null
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: d.first_name,
      last_name: d.last_name,
      full_name: `${d.first_name} ${d.last_name}`,
      school: registry?.name ?? d.school_name,
      school_code: registry?.code ?? null,
      municipality: registry?.municipality ?? d.municipality ?? null,
      school_type: registry?.type ?? null,
      subjects: d.subjects,
      grades: d.grades,
      consent_at: new Date().toISOString(),
      onboarding_completed: true,
    })
    .eq("id", user.id)

  if (error) {
    console.error("[onboarding] update failed", { code: error.code })
    return NextResponse.json({ error: "Nepavyko išsaugoti profilio." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
