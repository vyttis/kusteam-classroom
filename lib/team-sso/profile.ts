import type { SupabaseClient } from "@supabase/supabase-js"

export type ProfileOutcome = "ok" | "blocked" | "error"

/**
 * The CLASSROOM profile of a TEAM staff member at a successful TEAM
 * sign-in (ADR-001, "CLASSROOM: darbuotojo aplinka"):
 * - none: a 'staff' profile is created (active, no onboarding). Only the
 *   service role may do this (protect_staff_role trigger, TEAM-006).
 * - 'staff': kept as it is. One a CLASSROOM admin blocked is not
 *   re-activated: the sign-in is refused.
 * - teacher, admin, super_admin: left exactly as it is. The person is a
 *   CLASSROOM facilitator in their own right; TEAM changes nothing.
 */
export async function ensureClassroomProfile(
  admin: SupabaseClient,
  person: { userId: string; email: string; fullName: string | null },
): Promise<ProfileOutcome> {
  const existing = await readProfile(admin, person.userId)
  if (existing === "error") return "error"
  if (existing) return outcomeFor(existing)

  const { error } = await admin.from("profiles").insert({
    id: person.userId,
    email: person.email,
    full_name: person.fullName || null,
    role: "staff",
    status: "active",
    onboarding_completed: true,
  })
  if (!error) return "ok"
  // Two sign-ins at once: the other one created it.
  if (error.code === "23505") {
    const again = await readProfile(admin, person.userId)
    if (again && again !== "error") return outcomeFor(again)
  }
  console.error("[team-sso] profile insert failed", { pg: error.code })
  return "error"
}

type ProfileRow = { role: string; status: string }

async function readProfile(admin: SupabaseClient, userId: string): Promise<ProfileRow | null | "error"> {
  const { data, error } = await admin.from("profiles").select("role, status").eq("id", userId).maybeSingle()
  if (error) {
    console.error("[team-sso] profile read failed", { pg: error.code })
    return "error"
  }
  return (data as ProfileRow | null) ?? null
}

function outcomeFor(profile: ProfileRow): ProfileOutcome {
  if (profile.role === "staff" && profile.status !== "active") return "blocked"
  return "ok"
}
