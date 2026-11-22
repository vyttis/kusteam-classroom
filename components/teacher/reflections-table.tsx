"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Download, Search, MessageSquare } from "lucide-react"
import { exportCsv } from "@/lib/csv"
import { countHardestTasks } from "@/lib/game/formative-insights"

interface Reflection {
  id: string
  team_name: string
  hardest_challenge_title: string | null
  improvement_text: string
  liked_text: string | null
  created_at: string
}

interface ReflectionsTableProps {
  reflections: Reflection[]
  totalTeams: number
}

/** The two open questions of the participant reflection form (components/player/reflection-form.tsx). */
const QUESTION_IMPROVEMENT = "Ką kitą kartą darytumėte kitaip?"
const QUESTION_LIKED = "Kas labiausiai patiko?"

function AnswerList({
  question,
  answers,
  emptyText,
}: {
  question: string
  answers: { id: string; team_name: string; text: string }[]
  emptyText: string
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-steam-dark">
        {question}{" "}
        <span className="font-normal text-muted-foreground">({answers.length})</span>
      </h3>
      {answers.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {answers.map((a) => (
            <li key={a.id} className="rounded-lg border border-border/50 p-3 text-sm">
              <p className="text-steam-dark whitespace-pre-line break-words">{a.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.team_name}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ReflectionsTable({ reflections, totalTeams }: ReflectionsTableProps) {
  const [search, setSearch] = useState("")
  const [challengeFilter, setChallengeFilter] = useState<string>("all")

  // Get unique challenge titles for filter
  const uniqueChallenges = useMemo(() => {
    const titles = new Set<string>()
    reflections.forEach((r) => {
      if (r.hardest_challenge_title) titles.add(r.hardest_challenge_title)
    })
    return Array.from(titles).sort()
  }, [reflections])

  // Filter reflections
  const filtered = useMemo(() => {
    return reflections.filter((r) => {
      const matchesSearch =
        !search ||
        r.team_name.toLowerCase().includes(search.toLowerCase()) ||
        r.improvement_text.toLowerCase().includes(search.toLowerCase()) ||
        (r.liked_text && r.liked_text.toLowerCase().includes(search.toLowerCase()))

      const matchesChallenge =
        challengeFilter === "all" ||
        r.hardest_challenge_title === challengeFilter

      return matchesSearch && matchesChallenge
    })
  }, [reflections, search, challengeFilter])

  const hardest = useMemo(() => countHardestTasks(reflections), [reflections])

  function exportCSV() {
    exportCsv(
      `refleksijos_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Komanda",
        "Sudėtingiausia užduotis",
        "Ką darytų kitaip",
        "Kas patiko",
        "Data",
      ],
      reflections.map((r) => [
        r.team_name,
        r.hardest_challenge_title || "-",
        r.improvement_text,
        r.liked_text || "-",
        new Date(r.created_at).toLocaleString("lt-LT", { timeZone: "Europe/Vilnius" }),
      ])
    )
  }

  if (reflections.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">
            Dar nėra refleksijų. Dalyviai gali užpildyti refleksiją baigę veiklą.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Refleksijos</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {reflections.length} / {totalTeams}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="gap-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Eksportuoti CSV
          </Button>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ieškoti komandos arba teksto"
              aria-label="Ieškoti komandos arba teksto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          {uniqueChallenges.length > 0 && (
            <Select value={challengeFilter} onValueChange={setChallengeFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[220px] text-sm" aria-label="Rodyti komandas pagal sudėtingiausią užduotį">
                <SelectValue placeholder="Sudėtingiausia užduotis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visos užduotys</SelectItem>
                {uniqueChallenges.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-6">
          {/* Which task the teams named as the hardest (all reflections, not the filtered ones) */}
          <section>
            <h3 className="text-sm font-semibold text-steam-dark">Kuri užduotis buvo sudėtingiausia?</h3>
            {hardest.named.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nė viena komanda užduoties nenurodė.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Kiek komandų kurią užduotį nurodė kaip sudėtingiausią</caption>
                  <thead>
                    <tr className="border-b border-border/50">
                      <th scope="col" className="text-left py-2 pr-3 font-medium text-muted-foreground">Užduotis</th>
                      <th scope="col" className="text-right py-2 font-medium text-muted-foreground whitespace-nowrap">Komandų</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hardest.named.map((h) => (
                      <tr key={h.title} className="border-b border-border/30 last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-medium text-steam-dark break-words">
                          {h.title}
                        </th>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden" aria-hidden="true">
                              <div
                                className="h-full bg-accent rounded-full"
                                style={{ width: `${Math.round((h.count / reflections.length) * 100)}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-steam-dark w-6 text-right">{h.count}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hardest.unnamed > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Nenurodė užduoties: {hardest.unnamed}.</p>
            )}
          </section>

          <AnswerList
            question={QUESTION_IMPROVEMENT}
            answers={filtered.map((r) => ({ id: r.id, team_name: r.team_name, text: r.improvement_text }))}
            emptyText="Nerasta refleksijų pagal filtrą"
          />
          <AnswerList
            question={QUESTION_LIKED}
            answers={filtered
              .filter((r) => r.liked_text && r.liked_text.trim())
              .map((r) => ({ id: r.id, team_name: r.team_name, text: r.liked_text as string }))}
            emptyText="Į šį neprivalomą klausimą atsakymų nėra."
          />
        </div>

        {filtered.length !== reflections.length && (
          <p className="text-xs text-muted-foreground mt-4">
            Rodoma {filtered.length} iš {reflections.length}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
