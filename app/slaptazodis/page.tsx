import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SteamLogo } from "@/components/steam-logo"
import { PasswordForm } from "./password-form"

export const metadata: Metadata = { title: "Slaptažodis" }
export const dynamic = "force-dynamic"

// A signed-in facilitator sets a new password: after "Pamiršau slaptažodį"
// (they came in with a one-time code) or from the account menu.
export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ pamirsau?: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/vedejui")
  const forgot = (await searchParams).pamirsau === "1"

  return (
    <main className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <SteamLogo size="large" />
        </div>
        <div className="space-y-5 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-steam-dark">{forgot ? "Naujas slaptažodis" : "Slaptažodis"}</h1>
            <p className="text-sm text-muted-foreground">
              {forgot
                ? "Prisijungėte su kodu iš laiško. Susikurkite naują slaptažodį: senasis nustos galioti."
                : "Susikurkite arba pakeiskite slaptažodį, kuriuo jungsitės kartu su savo el. paštu."}
            </p>
          </div>
          <PasswordForm email={user.email ?? ""} />
        </div>
      </div>
    </main>
  )
}
