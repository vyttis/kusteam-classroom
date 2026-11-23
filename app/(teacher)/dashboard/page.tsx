import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { withChallengeCount } from "@/lib/game/challenge-count"
import { GamesGrid } from "@/components/teacher/games-grid"
import { OnboardingChecklist } from "@/components/teacher/onboarding-checklist"
import { CreateSampleGameButton } from "@/components/teacher/create-sample-game-button"
import { CATALOGUE_PATH, checklistSteps, groupGames } from "@/lib/teacher/dashboard"
import { GameWithChallengeCount } from "@/types/game"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Gamepad2, GraduationCap, ArrowRight, LayoutGrid, Compass } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = { title: "Mano veiklos" }

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // teams, challenges and submissions have column-level grants only, so a
  // `teams(count)` or `challenges(count)` embed is rejected with
  // "permission denied". Embed the granted `id` column and count here.
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("*, challenges(id), teams(id)")
    .eq("teacher_id", user!.id)
    .order("created_at", { ascending: false })

  if (gamesError) {
    // Surface the failure instead of rendering a misleading empty state.
    console.error("[dashboard] games query failed", {
      code: gamesError.code,
      message: gamesError.message,
    })
    throw new Error("Nepavyko įkelti veiklų")
  }

  type GameRow = GameWithChallengeCount & { teams?: { id: string }[] }
  const gameRows = (games || []).map(withChallengeCount) as GameRow[]
  const dashboardGames = gameRows.map((g) => ({
    ...g,
    taskCount: g.challenges?.[0]?.count || 0,
    teamCount: g.teams?.length || 0,
  }))

  // First-success checklist state, derived from the teacher's actual data
  const steps = checklistSteps(dashboardGames)
  const checklist = (className: string) => (
    <OnboardingChecklist
      steps={steps}
      showSampleGameButton={gameRows.length > 0 && !dashboardGames.some((g) => g.taskCount > 0)}
      userId={user!.id}
      className={className}
    />
  )

  // Other ways to begin: a lesson plan, or an activity from scratch.
  const otherPaths = (
    <section aria-labelledby="kiti-budai">
      <h2 id="kiti-budai" className="mb-3 text-base font-semibold text-steam-dark">
        {gameRows.length > 0 ? "Kurti naują" : "Kiti būdai pradėti"}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/lesson-plans/new" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Card className="border-secondary/30 bg-gradient-to-br from-secondary/5 to-secondary/10 hover:shadow-lg hover:shadow-secondary/10 transition-all duration-300 group h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                <GraduationCap className="h-6 w-6 text-secondary-ink" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-steam-dark text-base mb-1">Kurti pamokos planą</h3>
                <p className="text-sm text-muted-foreground">
                  Pamokos planas pagal ugdymo programą su DI pagalba
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-secondary-ink group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/games/new" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Gamepad2 className="h-6 w-6 text-primary-ink" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-steam-dark text-base mb-1">Kurti veiklą dalyviams</h3>
                <p className="text-sm text-muted-foreground">
                  Veikla su užduotimis, kurias komandos sprendžia klasėje
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-primary-ink group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </section>
  )

  // ============ Brand-new facilitator: what this is and what to do first ============
  if (gameRows.length === 0) {
    return (
      <div className="space-y-8">
        <section
          aria-labelledby="pradzia"
          className="rounded-2xl border border-primary/30 bg-white p-6 shadow-sm sm:p-8"
        >
          <h1 id="pradzia" className="text-2xl font-bold text-steam-dark sm:text-3xl">
            Pradėkite nuo paruoštos veiklos
          </h1>
          <p className="mt-3 max-w-2xl text-base text-foreground">
            Čia vedate komandines veiklas: dalyviai prisijungia telefonu su QR kodu ir komandomis sprendžia
            užduotis, o jūs ekrane matote, kaip joms sekasi. Pirmai pamokai pasirinkite paruoštą veiklą pagal
            dalyką ir klasę.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 gap-2 bg-primary px-6 text-base font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
            >
              <Link href={CATALOGUE_PATH}>
                <LayoutGrid className="h-5 w-5" aria-hidden="true" />
                Pasirinkti paruoštą veiklą
              </Link>
            </Button>
          </div>
          <div className="mt-5 border-t border-border/50 pt-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Arba išbandykite pavyzdinę veiklą su 3 užduotimis, arba kurkite savo nuo nulio.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <CreateSampleGameButton />
              <Button asChild variant="outline" className="gap-2">
                <Link href="/games/new">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Kurti nuo nulio
                </Link>
              </Button>
              <Link
                href="/gidas"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-steam-dark underline underline-offset-4 sm:ml-auto"
              >
                <Compass className="h-4 w-4" aria-hidden="true" />
                Gidas: kaip vesti veiklą
              </Link>
            </div>
          </div>
        </section>

        {checklist("")}
        {otherPaths}
      </div>
    )
  }

  // ============ Facilitator with activities: their activities lead ============
  const groups = groupGames(dashboardGames)
  const lessonRunning = groups.running.length > 0
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-steam-dark">Mano veiklos</h1>
          <p className="text-muted-foreground mt-1">Komandinės veiklos jūsų klasei ar grupei</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-11 gap-2 rounded-full px-5">
            <Link href={CATALOGUE_PATH}>
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              Paruoštos veiklos
            </Link>
          </Button>
          {/* While a lesson runs, going back to it is the main action of the
              page; creating a new activity steps back to an outlined button. */}
          <Button
            asChild
            variant={lessonRunning ? "outline" : "default"}
            className={
              lessonRunning
                ? "h-11 gap-2 rounded-full px-5"
                : "h-12 gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90"
            }
          >
            <Link href="/games/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nauja veikla
            </Link>
          </Button>
        </div>
      </div>

      <GamesGrid groups={groups} />

      {/* First-success checklist: until done, then until the teacher hides it */}
      {checklist("")}
      {otherPaths}
    </div>
  )
}
