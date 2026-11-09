import { createClient } from "@/lib/supabase/client"

/**
 * Browser side of "Atsijungti" for a TEAM staff member: the server ends the
 * CLASSROOM session and its SSO session (/auth/team/sign-out) and says where
 * to go. If that route is unavailable (sign-in turned off), the session is
 * still ended here, only this one (scope local), so TEAM stays signed in.
 * Returns the address to open next.
 */
export async function signOutTeamStaff(): Promise<string> {
  try {
    const res = await fetch("/auth/team/sign-out", { method: "POST", cache: "no-store" })
    if (res.ok) {
      const body = (await res.json()) as { redirect?: unknown }
      if (typeof body.redirect === "string") return body.redirect
    }
  } catch {
    // fall back below
  }
  await createClient().auth.signOut({ scope: "local" })
  return "/vedejui"
}
