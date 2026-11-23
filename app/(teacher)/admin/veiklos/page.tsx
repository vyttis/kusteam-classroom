import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { AccessDeniedError, requireRole } from "@/lib/auth/roles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FinishGameButton } from "@/components/admin/finish-game-button"

export const metadata: Metadata = { title: "Visos veiklos" }

const PAGE_SIZE = 50
const DAY_MS = 24 * 60 * 60 * 1000

const FILTERS = [
  { key: "vyksta", label: "Vyksta", statuses: ["active", "paused"] },
  { key: "juodrasciai", label: "Juodraščiai", statuses: ["draft"] },
  { key: "baigtos", label: "Baigtos", statuses: ["finished"] },
  { key: "visos", label: "Visos", statuses: ["draft", "active", "paused", "finished"] },
] as const

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Juodraštis", className: "bg-muted text-muted-foreground" },
  active: { label: "Vyksta", className: "bg-primary/10 text-primary-ink border-primary/20" },
  paused: { label: "Pristabdyta", className: "bg-highlight/15 text-steam-dark border-highlight/30" },
  finished: { label: "Baigta", className: "bg-secondary/10 text-secondary-ink border-secondary/20" },
}

type GameRow = {
  id: string
  title: string
  game_code: string
  status: string
  created_at: string
  starts_at: string | null
  updated_at: string
  teacher_id: string
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vilnius",
  })

/** How long ago, read at request time (server render). */
function ageMs(iso: string): number {
  return Date.now() - new Date(iso).getTime()
}

function sinceText(iso: string): string {
  const hours = Math.floor(ageMs(iso) / 3_600_000)
  if (hours < 1) return "mažiau nei valandą"
  if (hours < 48) return `${hours} val.`
  return `${Math.floor(hours / 24)} d.`
}

/**
 * Every activity on the platform, for administrators (ADM-14): who runs
 * what, and "Baigti" for one left running after a lesson. Read with the
 * service role after the role check; facilitators' answers are not shown.
 */
export default async function AdminActivitiesPage(props: {
  searchParams: Promise<{ busena?: string; q?: string; puslapis?: string }>
}) {
  const supabase = await createClient()
  // The admin layout redirects a facilitator too, but this page renders at
  // the same time: a thrown denial would be logged as a server error (N-5).
  // Only the expected denial is turned into a redirect; real failures throw.
  try {
    await requireRole(supabase, "admin", "super_admin")
  } catch (e) {
    if (e instanceof AccessDeniedError) redirect("/dashboard")
    throw e
  }
  const params = await props.searchParams
  const filter = FILTERS.find((f) => f.key === params.busena) ?? FILTERS[0]
  const q = (params.q ?? "").trim().slice(0, 80)
  const page = Math.max(1, Number.parseInt(params.puslapis ?? "1", 10) || 1)

  const admin = createAdminClient()
  let query = admin
    .from("games")
    .select("id, title, game_code, status, created_at, starts_at, updated_at, teacher_id", { count: "exact" })
    .in("status", [...filter.statuses])
    .order(filter.key === "vyksta" ? "starts_at" : "created_at", { ascending: filter.key === "vyksta", nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (q) {
    // Letters, digits, spaces and dashes only: the text goes into a filter.
    const safe = q.replace(/[^\p{L}\p{N} -]/gu, "")
    if (safe) query = query.or(`title.ilike.%${safe}%,game_code.ilike.%${safe.toUpperCase()}%`)
  }
  const { data, count, error } = await query
  const games = (data ?? []) as GameRow[]

  const teacherIds = [...new Set(games.map((g) => g.teacher_id))]
  const { data: teachers } = teacherIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", teacherIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] }
  const teacherName = new Map((teachers ?? []).map((t) => [t.id, t.full_name || t.email || "Nežinomas vedėjas"]))

  const total = count ?? games.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const href = (next: { busena?: string; q?: string; puslapis?: number }) => {
    const sp = new URLSearchParams()
    const busena = next.busena ?? filter.key
    if (busena !== "vyksta") sp.set("busena", busena)
    const text = next.q ?? q
    if (text) sp.set("q", text)
    if (next.puslapis && next.puslapis > 1) sp.set("puslapis", String(next.puslapis))
    const s = sp.toString()
    return `/admin/veiklos${s ? `?${s}` : ""}`
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground mb-6">
        <Link href="/admin">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Administravimas
        </Link>
      </Button>

      <h1 className="text-2xl font-bold text-steam-dark">Visos veiklos</h1>
      <p className="text-muted-foreground text-sm mt-1 mb-6">
        Visų vedėjų veiklos. Po pamokos palikta vykti veikla baigiama mygtuku „Baigti“, rezultatai išlieka. Kas naktį
        automatiškai baigiamos veiklos, kurios prasidėjo prieš 6 val. ir kuriose 2 val. nieko nevyko.
      </p>

      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Veiklų būsena" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              asChild
              size="sm"
              variant={f.key === filter.key ? "secondary" : "ghost"}
              className={f.key === filter.key ? "" : "text-muted-foreground"}
            >
              <Link href={href({ busena: f.key, puslapis: 1 })} aria-current={f.key === filter.key ? "page" : undefined}>
                {f.label}
              </Link>
            </Button>
          ))}
        </nav>
        <form action="/admin/veiklos" className="flex gap-2" role="search">
          {filter.key !== "vyksta" && <input type="hidden" name="busena" value={filter.key} />}
          <label htmlFor="activity-search" className="sr-only">
            Ieškoti pagal pavadinimą arba kodą
          </label>
          <Input
            id="activity-search"
            name="q"
            defaultValue={q}
            placeholder="Pavadinimas arba kodas"
            className="h-9 w-full sm:w-56 bg-white"
          />
          <Button type="submit" size="sm" variant="outline" className="h-9 gap-1.5">
            <Search className="h-4 w-4" aria-hidden="true" />
            Ieškoti
          </Button>
        </form>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm text-steam-dark">
          Nepavyko gauti veiklų sąrašo. Atnaujinkite puslapį.
        </p>
      ) : games.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {q ? "Pagal paiešką veiklų nerasta." : filter.key === "vyksta" ? "Šiuo metu nevyksta nė viena veikla." : "Veiklų nėra."}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-white">
          {games.map((game) => {
            const status = STATUS[game.status] ?? STATUS.draft
            const live = game.status === "active" || game.status === "paused"
            const since = game.starts_at ?? game.created_at
            const stale = live && ageMs(since) > DAY_MS
            const teacher = teacherName.get(game.teacher_id) ?? "Nežinomas vedėjas"
            return (
              <li key={game.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-steam-dark break-words">{game.title}</span>
                    <Badge variant="outline" className={`text-xs ${status.className}`}>
                      {status.label}
                    </Badge>
                    {stale && (
                      <Badge variant="outline" className="text-xs border-accent/30 bg-accent/5 text-accent-ink">
                        Vyksta {sinceText(since)}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{game.game_code}</span> · {teacher} ·{" "}
                    {live && game.starts_at ? `pradėta ${when(game.starts_at)}` : `sukurta ${when(game.created_at)}`}
                  </p>
                </div>
                {live && <FinishGameButton gameId={game.id} title={game.title} teacher={teacher} />}
              </li>
            )
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Puslapiai" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link className="text-secondary-ink underline" href={href({ puslapis: page - 1 })}>
              Ankstesnis
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            {page} iš {pages} ({total})
          </span>
          {page < pages ? (
            <Link className="text-secondary-ink underline" href={href({ puslapis: page + 1 })}>
              Kitas
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}
