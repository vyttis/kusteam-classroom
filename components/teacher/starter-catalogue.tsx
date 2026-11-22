"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowRight, Clock, Puzzle, SearchX } from "lucide-react"
import { pluralizeLt } from "@/lib/utils"
import { relevance, sortByRelevance, type CatalogueEntry } from "@/lib/starter-catalogue/types"

const ALL = "all"

interface StarterCatalogueProps {
  entries: CatalogueEntry[]
  /** Subjects and class bands in display order, only those with activities. */
  subjects: string[]
  gradeBands: string[]
  /** From the facilitator's profile: used to put fitting activities first. */
  profileSubjects: string[]
  profileGrades: string[]
}

export function StarterCatalogue({
  entries,
  subjects,
  gradeBands,
  profileSubjects,
  profileGrades,
}: StarterCatalogueProps) {
  const [subject, setSubject] = useState(ALL)
  const [gradeBand, setGradeBand] = useState(ALL)
  const filtering = subject !== ALL || gradeBand !== ALL

  const visible = useMemo(
    () =>
      sortByRelevance(
        entries.filter(
          (e) => (subject === ALL || e.subject === subject) && (gradeBand === ALL || e.grade_band === gradeBand),
        ),
        profileSubjects,
        profileGrades,
      ),
    [entries, subject, gradeBand, profileSubjects, profileGrades],
  )

  // Without a filter, activities matching the profile get their own group.
  const fitting = filtering ? [] : visible.filter((e) => relevance(e, profileSubjects, profileGrades) > 0)
  const grouped = fitting.length > 0 && fitting.length < visible.length
  const rest = grouped ? visible.filter((e) => !fitting.includes(e)) : visible

  function clearFilters() {
    setSubject(ALL)
    setGradeBand(ALL)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
        <div className="space-y-1.5 sm:w-64">
          <Label htmlFor="starter-subject">Dalykas</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger id="starter-subject">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Visi dalykai</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-48">
          <Label htmlFor="starter-grade">Klasė</Label>
          <Select value={gradeBand} onValueChange={setGradeBand}>
            <SelectTrigger id="starter-grade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Visos klasės</SelectItem>
              {gradeBands.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtering && (
          <Button type="button" variant="ghost" onClick={clearFilters} className="sm:mb-0 self-start sm:self-auto">
            Rodyti visas
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-6" role="status" aria-live="polite">
        {visible.length === 0
          ? "Veiklų nerasta"
          : `${pluralizeLt(visible.length, "Rasta", "Rastos", "Rasta")} ${visible.length} ${pluralizeLt(visible.length, "veikla", "veiklos", "veiklų")}`}
      </p>

      {visible.length === 0 ? (
        <div className="text-center py-16">
          <SearchX className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" aria-hidden="true" />
          <h2 className="text-base font-semibold text-steam-dark">Šiam dalykui ir klasei paruoštos veiklos dar nėra</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Pasirinkite kitą dalyką ar klasę arba peržiūrėkite visas veiklas.
          </p>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Rodyti visas veiklas
          </Button>
        </div>
      ) : grouped ? (
        <>
          <CatalogueGroup id="starter-fitting" title="Jūsų dalykams ir klasėms" entries={fitting} />
          <CatalogueGroup id="starter-other" title="Kitos veiklos" entries={rest} className="mt-10" />
        </>
      ) : (
        <CatalogueGroup id="starter-all" title="Veiklos" titleHidden entries={rest} />
      )}
    </div>
  )
}

function CatalogueGroup({
  id,
  title,
  titleHidden = false,
  entries,
  className,
}: {
  id: string
  title: string
  titleHidden?: boolean
  entries: CatalogueEntry[]
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <h2 id={id} className={titleHidden ? "sr-only" : "text-lg font-semibold text-steam-dark mb-4"}>
        {title}
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map((entry) => (
          <li key={entry.slug} className="flex">
            <CatalogueCard entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function CatalogueCard({ entry }: { entry: CatalogueEntry }) {
  return (
    // The whole card is one link target (the title link stretches over it).
    <Card className="relative flex w-full flex-col transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="secondary">{entry.subject}</Badge>
          <Badge variant="outline">{entry.grade_band}</Badge>
        </div>
        <h3 className="font-semibold text-steam-dark leading-snug">
          <Link
            href={`/paruostos-veiklos/${entry.slug}`}
            className="focus:outline-none after:absolute after:inset-0 after:rounded-xl"
          >
            {entry.title}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground mt-2 flex-1">{entry.description}</p>
        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t text-sm text-muted-foreground">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {entry.duration_minutes} min.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Puzzle className="h-4 w-4" aria-hidden="true" />
              {entry.task_count} {pluralizeLt(entry.task_count, "užduotis", "užduotys", "užduočių")}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-primary-ink" aria-hidden="true">
            Peržiūrėti
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
