import { notFound } from "next/navigation"
import type { NextRequest } from "next/server"
import { isTeamSsoEnabled } from "@/lib/team-sso/config"
import { servesTeamSso } from "@/lib/team-sso/http"
import { startTeamSignIn } from "@/lib/team-sso/start"

// KU STEAM TEAM sign-in, step 1 (lib/team-sso/start.ts). TEAM's
// "Atidaryti veiklą" links here. 404 while TEAM_SSO_ENABLED is not "1".
export async function GET(request: NextRequest) {
  if (!isTeamSsoEnabled() || !servesTeamSso(request)) notFound()
  return startTeamSignIn(request)
}
