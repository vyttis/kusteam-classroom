import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { GRADE_BANDS, SUBJECTS } from "@/lib/access/profile-fields"
import { listCatalogueEntries } from "@/lib/starter-catalogue/entries"
import { StarterCatalogue } from "@/components/teacher/starter-catalogue"

export const metadata: Metadata = { title: "Paruoštos veiklos" }

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []

export default async function StarterCataloguePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Subjects and class bands the facilitator gave at first sign-in.
  const { data: profile } = await supabase
    .from("profiles")
    .select("subjects, grades")
    .eq("id", user.id)
    .maybeSingle()

  const entries = listCatalogueEntries()
  const subjects = SUBJECTS.filter((s) => entries.some((e) => e.subject === s))
  const gradeBands = GRADE_BANDS.filter((g) => entries.some((e) => e.grade_band === g))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-steam-dark flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-secondary-ink" aria-hidden="true" />
          Paruoštos veiklos
        </h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
          Pagal bendrąsias programas parengtos veiklos su užduotimis, užuominomis ir pastabomis vedėjui.
          Pasirinkite pagal dalyką ir klasę, gaukite savo kopiją ir keiskite ją kaip norite.
        </p>
      </div>

      <StarterCatalogue
        entries={entries}
        subjects={subjects}
        gradeBands={gradeBands}
        profileSubjects={strings(profile?.subjects)}
        profileGrades={strings(profile?.grades)}
      />
    </div>
  )
}
