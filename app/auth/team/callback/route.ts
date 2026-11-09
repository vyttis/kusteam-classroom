import { notFound } from "next/navigation"
import type { NextRequest } from "next/server"
import { isTeamSsoEnabled } from "@/lib/team-sso/config"
import { finishTeamSignIn } from "@/lib/team-sso/callback"
import { servesTeamSso } from "@/lib/team-sso/http"
import { createSessionClient } from "@/lib/team-sso/session-client"
import { createAdminClient } from "@/lib/supabase/admin"

// KU STEAM TEAM sign-in, step 2 (lib/team-sso/callback.ts): TEAM sends the
// browser here with a one-time code. 404 while TEAM_SSO_ENABLED is not "1".
export async function GET(request: NextRequest) {
  if (!isTeamSsoEnabled() || !servesTeamSso(request)) notFound()
  return finishTeamSignIn(request, { admin: createAdminClient(), sessionClient: createSessionClient })
}
