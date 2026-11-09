import type { AccountStatus, UserRole } from "@/types/game"

// Client-safe types and helpers for the user list (no server imports here).

/** One row of the super admin's user list. Phone numbers are left out on purpose. */
export interface AdminUserRow {
  id: string
  email: string
  name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role: UserRole
  status: AccountStatus
  school: string | null
  school_code: string | null
  municipality: string | null
  school_type: string | null
  subjects: string[]
  grades: string[]
  onboarding_completed: boolean
  created_at: string
  approved_at: string | null
  last_sign_in_at: string | null
  activities: number
  /** null when the viewer may not see DI use (only super administrators do). */
  ai_actions: number | null
  ai_limit: number | null
}

export interface Breakdown {
  label: string
  count: number
}

/** Counts per value, largest first; empty values are grouped as "Nenurodyta". */
export function breakdown(rows: AdminUserRow[], pick: (r: AdminUserRow) => string | string[] | null): Breakdown[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const value = pick(r)
    const values = Array.isArray(value) ? value : [value]
    const list = values.filter((v): v is string => Boolean(v && v.trim()))
    for (const v of list.length > 0 ? list : ["Nenurodyta"]) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "lt"),
  )
}

/** Lower case without Lithuanian diacritics, for search that forgives "s" for "š". */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

export function matchesSearch(row: AdminUserRow, query: string): boolean {
  const q = fold(query.trim())
  if (!q) return true
  return fold([row.name, row.email, row.school ?? "", row.municipality ?? ""].join(" ")).includes(q)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Signed in within the last 30 days. */
export function recentlyActive(row: AdminUserRow, now = Date.now()): boolean {
  return row.last_sign_in_at !== null && now - new Date(row.last_sign_in_at).getTime() < 30 * DAY_MS
}

export const STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Aktyvi",
  pending: "Laukia patvirtinimo",
  blocked: "Užblokuota",
}

export const ROLE_LABEL: Record<UserRole, string> = {
  teacher: "Vedėjas",
  admin: "Administratorius",
  super_admin: "Super administratorius",
  staff: "KU STEAM darbuotojas",
}

// The calendar day in Lithuania (YYYY-MM-DD), not in UTC.
const vilniusDay = new Intl.DateTimeFormat("lt-LT", {
  timeZone: "Europe/Vilnius",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
export const dateOnly = (iso: string | null) => (iso ? vilniusDay.format(new Date(iso)) : "")

export const USER_CSV_HEADERS = [
  "Vardas",
  "Pavardė",
  "El. paštas",
  "Mokykla",
  "Mokyklos kodas",
  "Savivaldybė",
  "Mokyklos tipas",
  "Dalykai",
  "Klasės",
  "Rolė",
  "Paskyros būsena",
  "Sukurta",
  "Patvirtinta",
  "Paskutinis prisijungimas",
  "Veiklų",
  "DI užklausų šį mėnesį",
]

export function userCsvRow(r: AdminUserRow): (string | number)[] {
  return [
    r.first_name ?? "",
    r.last_name ?? "",
    r.email,
    r.school ?? "",
    r.school_code ?? "",
    r.municipality ?? "",
    r.school_type ?? "",
    r.subjects.join("; "),
    r.grades.join("; "),
    ROLE_LABEL[r.role] ?? r.role,
    STATUS_LABEL[r.status] ?? r.status,
    dateOnly(r.created_at),
    dateOnly(r.approved_at),
    dateOnly(r.last_sign_in_at),
    r.activities,
    r.ai_actions ?? "",
  ]
}

/**
 * One key per school for counting: older profiles keep only the school name,
 * newer ones the registry code and the same name, so the name (case and
 * spacing ignored) is the shared identity; the code only when no name is set.
 */
export function schoolKey(r: Pick<AdminUserRow, "school" | "school_code">): string {
  const name = (r.school ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("lt")
  return name || (r.school_code ?? "").trim()
}
