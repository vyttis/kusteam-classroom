import type { SupabaseClient } from "@supabase/supabase-js"
import { findSchoolByCode } from "@/lib/access/schools"

/** The public address of the platform (pamokos.kusteam.app in production). */
export function publicBaseUrl(origin: string): string {
  const host = process.env.CANONICAL_CLASSROOM_HOST
  return host ? `https://${host}` : origin
}

/** The facilitator sign-in page: the link in every account email. */
export function loginUrl(origin: string): string {
  return `${publicBaseUrl(origin)}/vedejui`
}

export async function logAdminAction(
  admin: SupabaseClient,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  })
  // The action itself already happened; a missing log line must not undo it.
  if (error) console.error("[admin-audit] insert failed", { action, code: error.code })
}

export interface NewAccount {
  email: string
  first_name: string
  last_name: string
  school_code: string | null
  school_name: string | null
  municipality: string | null
  role?: "teacher" | "admin" | "super_admin"
}

export type AccountResult =
  | { ok: true; userId: string; existing: boolean }
  | { ok: false; status: number; error: string }

/**
 * Gives a person an active facilitator account. If the email already has
 * an account (e.g. it signed in with Google and waits for approval), that
 * account is activated; otherwise a new one is created. The profile starts
 * active with the request's details; the person completes the rest on first
 * sign-in (onboarding).
 *
 * The account's email is marked confirmed, so the person signs in at
 * /vedejui with Google or an emailed code. Supabase's invitation link
 * expired after an hour (the email OTP lifetime), and an invited account
 * that never opened it could not get a code either. The caller sends
 * accountActivatedEmail with the sign-in link, which does not expire.
 */
export async function grantAccount(
  admin: SupabaseClient,
  account: NewAccount,
  actorId: string,
): Promise<AccountResult> {
  const email = account.email.trim().toLowerCase()
  const school = account.school_code ? findSchoolByCode(account.school_code) : null
  const profileFields = {
    first_name: account.first_name,
    last_name: account.last_name,
    full_name: `${account.first_name} ${account.last_name}`.trim(),
    school: school?.name ?? account.school_name,
    school_code: school?.code ?? null,
    municipality: school?.municipality ?? account.municipality,
    school_type: school?.type ?? null,
    status: "active",
    approved_at: new Date().toISOString(),
    approved_by: actorId,
    ...(account.role ? { role: account.role } : {}),
  }

  // Exact match: ilike would treat "_" and "%" in an address as wildcards.
  // Supabase Auth stores emails in lower case, and so do profiles.
  const { data: existing } = await admin
    .from("profiles")
    .select("id, first_name, last_name, school")
    .eq("email", email)
    .maybeSingle()

  if (existing) {
    // Keep what the person already entered; fill only empty fields. The
    // role of an existing account changes only in user management, so an
    // approval can never demote an admin.
    const update: Record<string, unknown> = {
      status: "active",
      approved_at: profileFields.approved_at,
      approved_by: actorId,
    }
    if (!existing.first_name) update.first_name = profileFields.first_name
    if (!existing.last_name) update.last_name = profileFields.last_name
    if (!existing.school) {
      update.school = profileFields.school
      update.school_code = profileFields.school_code
      update.municipality = profileFields.municipality
      update.school_type = profileFields.school_type
    }
    const { error } = await admin.from("profiles").update(update).eq("id", existing.id)
    if (error) return { ok: false, status: 500, error: "Nepavyko aktyvuoti paskyros." }
    // An account invited earlier that never opened its link is still
    // unconfirmed and cannot get a sign-in code: confirm it now.
    const { data: authUser } = await admin.auth.admin.getUserById(existing.id)
    if (authUser?.user && !authUser.user.email_confirmed_at) {
      const { error: confirmError } = await admin.auth.admin.updateUserById(existing.id, { email_confirm: true })
      if (confirmError) {
        console.error("[access] confirm failed", { status: confirmError.status })
        return { ok: false, status: 502, error: "Nepavyko aktyvuoti paskyros. Bandykite dar kartą." }
      }
    }
    return { ok: true, userId: existing.id, existing: true }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: profileFields.full_name },
  })
  if (createError || !created?.user) {
    console.error("[access] create failed", { status: createError?.status })
    return { ok: false, status: 502, error: "Nepavyko sukurti paskyros. Bandykite dar kartą." }
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ ...profileFields, onboarding_completed: false })
    .eq("id", created.user.id)
  if (profileError) {
    // Do not leave a half-made account behind: the next attempt starts clean.
    await admin.auth.admin.deleteUser(created.user.id)
    return { ok: false, status: 500, error: "Nepavyko sukurti profilio. Bandykite dar kartą." }
  }
  return { ok: true, userId: created.user.id, existing: false }
}
