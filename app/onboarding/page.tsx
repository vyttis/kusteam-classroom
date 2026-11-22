import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SteamLogo } from "@/components/steam-logo"
import { OnboardingForm } from "./onboarding-form"

export const metadata: Metadata = { title: "Užbaikite registraciją" }
export const dynamic = "force-dynamic"

// First sign-in after approval: the facilitator checks the details from the
// request and adds what we use for statistics (subjects, classes).
export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/vedejui")

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, first_name, last_name, school, school_code, municipality, subjects, grades")
    .eq("id", user.id)
    .single()

  // Older profiles only have full_name: split it as a starting point.
  const [guessFirst, ...rest] = (profile?.full_name ?? "").trim().split(/\s+/)
  const school = profile?.school
    ? {
        school_code: profile.school_code ?? null,
        school_name: profile.school,
        municipality: profile.municipality ?? null,
      }
    : null

  return (
    <main className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="flex justify-center">
          <SteamLogo size="large" />
        </div>
        <div className="space-y-5 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-steam-dark">Užbaikite registraciją</h1>
            <p className="text-sm text-muted-foreground">
              Paskyra patvirtinta. Patikrinkite duomenis ir pažymėkite, ką mokote: tai padės planuoti veiklas.
            </p>
          </div>
          <OnboardingForm
            initial={{
              email: profile?.email ?? user.email ?? "",
              first_name: profile?.first_name ?? guessFirst ?? "",
              last_name: profile?.last_name ?? rest.join(" "),
              school,
              subjects: profile?.subjects ?? [],
              grades: profile?.grades ?? [],
              hasGoogle: (user.app_metadata?.providers as string[] | undefined)?.includes("google") ?? false,
            }}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">KU STEAM centras, Klaipėdos universitetas</p>
      </div>
    </main>
  )
}
