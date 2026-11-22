import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Clock, Puzzle, Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { pluralizeLt } from "@/lib/utils"
import { findCatalogueDetail } from "@/lib/starter-catalogue/entries"
import type { CatalogueTask } from "@/lib/starter-catalogue/types"
import { UseStarterActivityButton } from "@/components/teacher/use-starter-activity-button"

type Params = Promise<{ slug: string }>

const TYPE_LABELS: Record<CatalogueTask["type"], string> = {
  text: "Tekstas",
  number: "Skaičius",
  multiple_choice: "Pasirinkimas",
}

const points = (n: number) => `${n} ${pluralizeLt(n, "taškas", "taškai", "taškų")}`

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  return { title: findCatalogueDetail(slug)?.title ?? "Paruoštos veiklos" }
}

export default async function StarterActivityPage({ params }: { params: Params }) {
  const { slug } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const activity = findCatalogueDetail(slug)
  if (!activity) {
    notFound()
  }

  const notes = [
    { title: "Prieš veiklą", text: activity.teacher_notes.before },
    { title: "Veiklos metu", text: activity.teacher_notes.during },
    { title: "Po veiklos", text: activity.teacher_notes.after },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/paruostos-veiklos"
        className="inline-flex items-center gap-2 min-h-9 mb-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Visos paruoštos veiklos
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge variant="secondary">{activity.subject}</Badge>
            <Badge variant="outline">{activity.grade_band}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-steam-dark">{activity.title}</h1>
          <p className="text-muted-foreground mt-2">{activity.description}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-sm text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {activity.duration_minutes} min.
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Puzzle className="h-4 w-4" aria-hidden="true" />
              {activity.task_count} {pluralizeLt(activity.task_count, "užduotis", "užduotys", "užduočių")}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              Iš viso {points(activity.total_points)}
            </li>
          </ul>
          <div className="mt-6">
            <UseStarterActivityButton slug={activity.slug} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 space-y-8">
        <section aria-labelledby="veikla-programa">
          <h2 id="veikla-programa" className="text-lg font-semibold text-steam-dark mb-2">
            Ryšys su bendrosiomis programomis
          </h2>
          <p className="text-sm text-foreground">{activity.curriculum}</p>
        </section>

        <section aria-labelledby="veikla-tikslai">
          <h2 id="veikla-tikslai" className="text-lg font-semibold text-steam-dark mb-2">
            Ko dalyviai išmoks
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
            {activity.learning_goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="veikla-pastabos">
          <h2 id="veikla-pastabos" className="text-lg font-semibold text-steam-dark mb-3">
            Metodinės pastabos vedėjui
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {notes.map((note) => (
              <Card key={note.title} className="shadow-none">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-secondary-ink mb-1.5">{note.title}</h3>
                  <p className="text-sm text-foreground">{note.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="veikla-refleksija">
          <h2 id="veikla-refleksija" className="text-lg font-semibold text-steam-dark mb-2">
            Klausimai aptarimui
          </h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground">
            {activity.reflection_questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="veikla-uzduotys">
          <h2 id="veikla-uzduotys" className="text-lg font-semibold text-steam-dark mb-1">
            Užduotys
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Užduočių tekstus, atsakymus ir užuominas matysite ir galėsite keisti savo kopijoje.
          </p>
          <Card className="shadow-none">
            <ol className="divide-y">
              {activity.tasks.map((task, index) => (
                <li key={`${index}-${task.title}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                  <span className="text-muted-foreground tabular-nums" aria-hidden="true">
                    {index + 1}.
                  </span>
                  <span className="flex-1 min-w-[10rem] font-medium text-steam-dark">{task.title}</span>
                  <Badge variant="outline">{TYPE_LABELS[task.type]}</Badge>
                  <span className="text-muted-foreground tabular-nums">{points(task.points)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      </div>
    </div>
  )
}
