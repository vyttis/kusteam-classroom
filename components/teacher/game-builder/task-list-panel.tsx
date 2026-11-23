"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Challenge } from "@/types/game"
import { cn } from "@/lib/utils"
import { SortableTaskCard } from "./sortable-task-card"
import { ArrowRight, BookOpen, Pencil, Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TaskListPanelProps {
  challenges: Challenge[]
  selectedId: string | null
  onSelect: (challenge: Challenge) => void
  onDelete: (challenge: Challenge) => void
  onDuplicate: (challenge: Challenge) => void
  /** Moves a task one step: the alternative to dragging. */
  onMove?: (challenge: Challenge, direction: -1 | 1) => void
  onAddNew: () => void
  /** Opens the DI or the library mode of the workspace. */
  onOpenMode?: (mode: "di" | "library") => void
  /** The task saved in the editor a moment ago: its row confirms it. */
  savedId?: string | null
  isOverPanel: boolean
  locked?: boolean
}

/** How long a new row keeps its "Pridėta" confirmation. */
const FRESH_MS = 2500

const startOption =
  "flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-white p-3 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export function TaskListPanel({
  challenges,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onMove,
  onAddNew,
  onOpenMode,
  savedId = null,
  isOverPanel,
  locked = false,
}: TaskListPanelProps) {
  const { setNodeRef } = useDroppable({
    id: "challenge-list-drop",
  })

  const sortableIds = challenges.map((c) => `challenge-${c.id}`)
  const totalPoints = challenges.reduce((sum, c) => sum + (c.points || 0), 0)

  // Tasks that were not in the list a moment ago rise in and say "Pridėta".
  // Worked out while rendering, so the row never shows before its entrance.
  const [seenIds, setSeenIds] = useState(() => new Set(challenges.map((c) => c.id)))
  const freshKey = challenges
    .filter((c) => !seenIds.has(c.id))
    .map((c) => c.id)
    .join(",")
  useEffect(() => {
    if (!freshKey) return
    const fresh = freshKey.split(",")
    // A task added below the fold is brought into view.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    document
      .getElementById(`task-row-${fresh[fresh.length - 1]}`)
      ?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
    const timer = setTimeout(() => {
      setSeenIds((prev) => new Set([...prev, ...fresh]))
    }, FRESH_MS)
    return () => clearTimeout(timer)
  }, [freshKey])
  const freshIds = new Set(freshKey ? freshKey.split(",") : [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight text-steam-dark">Užduotys</h2>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {challenges.length} užd. &middot; {totalPoints} tšk.
          </p>
        </div>
        <Button
          onClick={onAddNew}
          variant="outline"
          className="shrink-0 gap-1.5 border-2 border-primary bg-white font-bold text-foreground hover:bg-primary/10"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nauja
        </Button>
      </div>

      {/* Below lg the workspace is a sheet: these two open its other modes. */}
      {onOpenMode && (
        <div className="mb-3 grid grid-cols-2 gap-2 lg:hidden">
          <Button type="button" variant="outline" className="gap-1.5 px-3" onClick={() => onOpenMode("di")}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Kurti su DI
          </Button>
          <Button type="button" variant="outline" className="gap-1.5 px-3" onClick={() => onOpenMode("library")}>
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Biblioteka
          </Button>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={cn(
          "-m-1 min-h-0 flex-1 rounded-xl p-1 transition-colors motion-reduce:transition-none lg:overflow-y-auto",
          isOverPanel && "bg-primary/5 outline-dashed outline-2 -outline-offset-2 outline-primary"
        )}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {challenges.length > 0 ? (
            <ol className="space-y-2">
              {challenges.map((challenge, index) => (
                <SortableTaskCard
                  key={challenge.id}
                  challenge={challenge}
                  index={index}
                  isSelected={selectedId === challenge.id}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                  onMove={onMove}
                  isFirst={index === 0}
                  isLast={index === challenges.length - 1}
                  locked={locked}
                  flash={freshIds.has(challenge.id) ? "added" : savedId === challenge.id ? "saved" : null}
                />
              ))}
            </ol>
          ) : isOverPanel ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                <Plus className="h-7 w-7 text-primary-ink" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-steam-dark">Paleiskite užduotį čia</h3>
              <p className="mt-1 text-sm text-muted-foreground">Atleiskite, kad pridėtumėte</p>
            </div>
          ) : (
            <div className="motion-fade-in">
              <h3 className="text-base font-bold text-steam-dark">Užduočių dar nėra</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pasirinkite, nuo ko pradėti. Vėliau užduotis galėsite keisti ir rikiuoti.
              </p>
              <ul className="mt-4 space-y-2">
                {onOpenMode && (
                  <li>
                    <button type="button" className={startOption} onClick={() => onOpenMode("di")}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground">
                        <Sparkles className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-steam-dark">Gauti pasiūlymų iš DI</span>
                        <span className="block text-sm text-muted-foreground">
                          Aprašote temą, DI pasiūlo užduotis su atsakymais. Atsakymus patvirtinate jūs.
                        </span>
                      </span>
                    </button>
                  </li>
                )}
                {onOpenMode && (
                  <li>
                    <button type="button" className={startOption} onClick={() => onOpenMode("library")}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <BookOpen className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-steam-dark">Paimti iš bibliotekos</span>
                        <span className="block text-sm text-muted-foreground">
                          Užduotys iš patvirtintų kitų vedėjų veiklų.
                        </span>
                      </span>
                    </button>
                  </li>
                )}
                <li>
                  <button type="button" className={startOption} onClick={onAddNew}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Pencil className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-steam-dark">Rašyti savo užduotį</span>
                      <span className="block text-sm text-muted-foreground">
                        Klausimas, teisingas atsakymas ir taškai.
                      </span>
                    </span>
                  </button>
                </li>
              </ul>
              <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
                Reikia visos pamokos iš karto? Paruoštose veiklose užduotys ir atsakymai jau sudėti.{" "}
                <Link
                  href="/paruostos-veiklos"
                  className="inline-flex min-h-11 items-center gap-1 font-semibold text-foreground underline underline-offset-4 hover:decoration-2"
                >
                  Paruoštos veiklos
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </p>
            </div>
          )}
        </SortableContext>

        {isOverPanel && challenges.length > 0 && (
          <div className="mt-2 flex h-11 items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5">
            <p className="text-sm font-semibold text-foreground">Paleiskite čia</p>
          </div>
        )}
      </div>
    </div>
  )
}
