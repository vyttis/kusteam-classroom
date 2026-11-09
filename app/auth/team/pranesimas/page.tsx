import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SteamLogo } from "@/components/steam-logo"
import { Button } from "@/components/ui/button"
import { isTeamSsoEnabled, teamHomeUrl } from "@/lib/team-sso/config"
import { TEAM_SSO_MESSAGES, parseMessageKind } from "@/lib/team-sso/messages"

export const metadata: Metadata = { title: "Prisijungimas per KU STEAM TEAM" }
export const dynamic = "force-dynamic"

// Where the TEAM sign-in ends when it cannot continue, and where a staff
// member lands when their access has ended (proxy.ts). Texts and buttons
// are the contract's (section 7); no codes or ids are shown.
export default async function TeamSignInMessagePage(props: { searchParams: Promise<{ p?: string | string[] }> }) {
  if (!isTeamSsoEnabled()) notFound()
  const { p } = await props.searchParams
  const message = TEAM_SSO_MESSAGES[parseMessageKind(p)]

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <SteamLogo size="large" />
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4 text-left">
          <h1 className="text-xl font-bold text-steam-dark">Prisijungimas per KU STEAM TEAM</h1>
          <p className="text-sm text-muted-foreground">{message.text}</p>
          {message.button && (
            <Button asChild className="w-full sm:w-auto">
              <a href={teamHomeUrl()}>{message.button}</a>
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
