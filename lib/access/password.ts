import { z } from "zod"

/** bcrypt, which Supabase Auth uses, ignores everything after 72 bytes. */
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 72

export const PASSWORD_HINT = `Bent ${PASSWORD_MIN} ženklų. Geriausia keli žodžiai, kurių nenaudojate kitur.`

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Slaptažodis turi būti bent ${PASSWORD_MIN} ženklų.`)
  .refine((v) => new TextEncoder().encode(v).length <= PASSWORD_MAX, `Slaptažodis per ilgas (iki ${PASSWORD_MAX} ženklų).`)
  .refine((v) => v.trim().length === v.length, "Slaptažodis negali prasidėti ar baigtis tarpu.")
  .refine((v) => new Set(v).size >= 4, "Slaptažodis per paprastas: naudokite daugiau skirtingų ženklų.")

/** What is wrong with a new password and its repeat, or null when both are fine. */
export function passwordIssue(password: string, repeat: string, email?: string): string | null {
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Netinkamas slaptažodis."
  const local = email?.split("@")[0]?.toLowerCase()
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
    return "Slaptažodyje neturi būti jūsų el. pašto adreso."
  }
  if (password !== repeat) return "Slaptažodžiai nesutampa."
  return null
}

/** Supabase Auth errors for a password change, in the facilitator's language. */
export function passwordErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  const code = error?.code ?? ""
  const message = error?.message ?? ""
  if (code === "weak_password" || /weak|pwned|leaked/i.test(message)) {
    return "Šis slaptažodis per silpnas arba yra nutekėjusių slaptažodžių sąrašuose. Pasirinkite kitą."
  }
  if (code === "same_password") return "Naujas slaptažodis turi skirtis nuo dabartinio."
  if (code === "reauthentication_needed" || code === "session_not_found") {
    return "Saugumo sumetimais prisijunkite iš naujo ir pakartokite."
  }
  return "Nepavyko išsaugoti slaptažodžio. Bandykite dar kartą."
}
