"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Clock, Puzzle, SearchX } from "lucide-react"
import { cn, pluralizeLt } from "@/lib/utils"
import { relevance, sortByRelevance, type CatalogueEntry } from "@/lib/starter-catalogue/types"
import { RAY_FILL_CLASS, subjectRay } from "@/lib/starter-catalogue/subject-ray"

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
      {/* One press filters: every choice is on the page, nothing to open. */}
      <div className="mb-4 space-y-3">
        <FilterRow label="Dalykas" value={subject} onChange={setSubject} allLabel="Visi dalykai" options={subjects} marked />
        <FilterRow label="Klasė" value={gradeBand} onChange={setGradeBand} allLabel="Visos klasės" options={gradeBands} />
      </div>

      <p className="text-sm text-muted-foreground mb-6" role="status" aria-live="polite">
        {visible.length === 0
          ? "Veiklų nerasta"
          : `${pluralizeLt(visible.length, "Rasta", "Rastos", "Rasta")} ${visible.length} ${pluralizeLt(visible.length, "veikla", "veiklos", "veiklų")}`}
      </p>

      {visible.length === 0 ? (
        <div className="text-center py-16">
          <SearchX className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" aria-hidden="true" />
          <h2 className="text-base font-bold text-steam-dark">Šiam dalykui ir klasei paruoštos veiklos dar nėra</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Pasirinkite kitą dalyką ar klasę arba peržiūrėkite visas veiklas.
          </p>
          <Button type="button" variant="outline" onClick={clearFilters} className="h-11 rounded-full px-5">
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
      <h2 id={id} className={titleHidden ? "sr-only" : "text-lg font-bold text-steam-dark mb-4"}>
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

/**
 * The subject area's ray: a short slanted stroke in the area's brand colour.
 * A shape only; the subject name beside it carries the meaning.
 */
function RayMark({ subject, className }: { subject: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-1.5 w-5 shrink-0 -rotate-[32deg] rounded-full", RAY_FILL_CLASS[subjectRay(subject)], className)}
    />
  )
}

function FilterRow({
  label,
  value,
  onChange,
  allLabel,
  options,
  marked = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: string[]
  /** Show each option's ray colour (subjects). */
  marked?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <span className="shrink-0 pt-2.5 text-sm font-bold text-steam-dark sm:w-16">{label}</span>
      <div className="flex flex-wrap gap-2">
        {[ALL, ...options].map((option) => {
          const selected = value === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected && option !== ALL ? ALL : option)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-foreground bg-foreground font-bold text-background"
                  : "border-foreground/25 bg-white text-foreground hover:bg-muted",
              )}
            >
              {marked && option !== ALL && (
                <RayMark subject={option} className={selected ? "ring-1 ring-background/70" : undefined} />
              )}
              {option === ALL ? allLabel : option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CatalogueCard({ entry }: { entry: CatalogueEntry }) {
  return (
    // The whole card is one link target (the title link stretches over it);
    // keyboard focus on the link rings the whole card.
    <article className="relative flex w-full flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2">
      <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-steam-dark">
        <RayMark subject={entry.subject} />
        <span className="font-bold">{entry.subject}</span>
        <span className="text-muted-foreground">{entry.grade_band}</span>
      </p>
      <h3 className="text-lg font-bold leading-snug text-steam-dark">
        <Link
          href={`/paruostos-veiklos/${entry.slug}`}
          className="focus:outline-none after:absolute after:inset-0 after:rounded-xl"
        >
          {entry.title}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{entry.description}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {entry.duration_minutes} min.
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Puzzle className="h-4 w-4" aria-hidden="true" />
            {entry.task_count} {pluralizeLt(entry.task_count, "užduotis", "užduotys", "užduočių")}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 font-bold text-steam-dark" aria-hidden="true">
          Peržiūrėti
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </article>
  )
}
