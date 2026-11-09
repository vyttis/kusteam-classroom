import { notFound } from "next/navigation"
import type { NextRequest } from "next/server"
import { isTeamSsoEnabled } from "@/lib/team-sso/config"
import { servesTeamSso } from "@/lib/team-sso/http"
import { createSessionClient } from "@/lib/team-sso/session-client"
import { signOutStaff } from "@/lib/team-sso/sign-out"
import { createAdminClient } from "@/lib/supabase/admin"

// "Atsijungti" for a TEAM staff member (lib/team-sso/sign-out.ts). The
// browser falls back to a local sign-out while this is 404.
export async function POST(request: NextRequest) {
  if (!isTeamSsoEnabled() || !servesTeamSso(request)) notFound()
  return signOutStaff(request, { admin: createAdminClient(), sessionClient: createSessionClient })
}
