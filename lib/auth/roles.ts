import { SupabaseClient } from "@supabase/supabase-js"

/**
 * CLASSROOM roles. 'staff' is a KU STEAM TEAM staff member inside CLASSROOM:
 * created only by the TEAM sign-in (TEAM-006), works with own activities
 * like a teacher, never an admin, no registration or onboarding. Only the
 * service role sets or removes it.
 */
export type UserRole = "teacher" | "admin" | "super_admin" | "staff"

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  school: string | null
  phone: string | null
  role: UserRole
  avatar_url: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

/**
 * Get current user's role from profiles table
 */
export async function getUserRole(supabase: SupabaseClient): Promise<UserRole> {
  const { data } = await supabase.rpc("get_my_role")
  return (data as UserRole) || "teacher"
}

/**
 * Get current user's full profile
 */
export async function getUserProfile(
  supabase: SupabaseClient
): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return profile as UserProfile | null
}

/**
 * Check if user has one of the allowed roles, throw if not
 */
export async function requireRole(
  supabase: SupabaseClient,
  ...allowedRoles: UserRole[]
): Promise<UserRole> {
  const role = await getUserRole(supabase)
  if (!allowedRoles.includes(role)) {
    throw new Error(`Prieiga uždrausta. Reikalinga rolė: ${allowedRoles.join(" arba ")}`)
  }
  // Admin powers need an active account, checked fresh (not from the proxy
  // cache): a blocked admin keeps the role until someone changes it.
  if (role !== "teacher") {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle()
      : { data: null }
    if (profile?.status !== "active") {
      throw new Error("Prieiga uždrausta: paskyra neaktyvi.")
    }
  }
  return role
}

// Permission helpers
export function canManageUsers(role: UserRole): boolean {
  return role === "super_admin"
}

export function canChangeRoles(role: UserRole): boolean {
  return role === "super_admin"
}

export function canApproveLibrary(role: UserRole): boolean {
  return role === "admin" || role === "super_admin"
}

export function canViewAnalytics(role: UserRole): boolean {
  return role === "admin" || role === "super_admin"
}

export function canViewAdminDashboard(role: UserRole): boolean {
  return role === "admin" || role === "super_admin"
}

export function canDeleteLibraryItem(role: UserRole): boolean {
  return role === "super_admin"
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "Super administratorius"
    case "admin":
      return "Administratorius"
    case "teacher":
      return "Vedėjas"
    case "staff":
      return "KU STEAM darbuotojas"
    default:
      return role
  }
}

export function getRoleBadgeColor(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "bg-accent/10 text-accent-ink border-accent/20"
    case "admin":
      return "bg-secondary/10 text-secondary-ink border-secondary/20"
    case "teacher":
      return "bg-primary/10 text-primary-ink border-primary/20"
    case "staff":
      return "bg-highlight/10 text-highlight-ink border-highlight/20"
    default:
      return "bg-muted text-muted-foreground"
  }
}
