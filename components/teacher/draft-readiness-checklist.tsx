import type { ReactNode } from "react"
import { CheckCircle2, Circle } from "lucide-react"

interface ChecklistItem {
  label: string
  done: boolean
  hint?: string
  /** Without it the activity cannot start. */
  required: boolean
}

interface DraftReadinessChecklistProps {
  challengeCount: number
  tasksNeedingAnswer: number
  /** Tasks with no question text: participants would see only a title. */
  tasksWithoutText?: number
  /** DI tasks whose check doubted them and nobody reviewed yet. */
  tasksNeedingReview?: number
  hasDescription: boolean
  hasTimeLimit: boolean
  /** The start button: the one main action of a draft's page. */
  action?: ReactNode
  /** Compact facts of the activity (tasks, points, duration). */
  facts?: ReactNode
}

// Server-renderable state panel of a draft activity: whether it can start,
// the start button, and only what is still missing. It mirrors the
// server-side activation guards plus soft recommendations; the full list
// stays one press away.
export function DraftReadinessChecklist({
  challengeCount,
  tasksNeedingAnswer,
  tasksWithoutText = 0,
  tasksNeedingReview = 0,
  hasDescription,
  hasTimeLimit,
  action,
  facts,
}: DraftReadinessChecklistProps) {
  const items: ChecklistItem[] = [
    {
      label: "Pridėta bent viena užduotis",
      done: challengeCount > 0,
      hint: challengeCount === 0 ? "Sukurkite užduotis valdymo skiltyje" : undefined,
      required: true,
    },
    {
      label: "Visos užduotys turi atsakymus",
      done: challengeCount > 0 && tasksNeedingAnswer === 0,
      hint: tasksNeedingAnswer > 0 ? `Atsakymo trūksta: ${tasksNeedingAnswer} užd.` : undefined,
      required: true,
    },
    {
      label: "Visos užduotys turi klausimą",
      done: challengeCount > 0 && tasksWithoutText === 0,
      hint: tasksWithoutText > 0 ? `Be klausimo: ${tasksWithoutText} užd.` : undefined,
      required: false,
    },
    {
      label: "DI užduotys peržiūrėtos",
      done: tasksNeedingReview === 0,
      hint: tasksNeedingReview > 0 ? `Reikia peržiūros: ${tasksNeedingReview} užd.` : undefined,
      required: false,
    },
    { label: "Pridėtas veiklos aprašymas", done: hasDescription, required: false },
    { label: "Nustatytas laiko limitas", done: hasTimeLimit, required: false },
  ]

  const readyToStart = items.every((i) => i.done || !i.required)
  const missing = items.filter((i) => !i.done)
  const doneCount = items.length - missing.length

  return (
    <section
      aria-labelledby="pasiruosimas"
      className={`rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${
        readyToStart ? "border-l-[6px] border-primary" : "border-border"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="pasiruosimas" className="text-xl font-bold leading-snug text-steam-dark">
            {readyToStart ? "Viskas paruošta, galite pradėti veiklą!" : "Pasiruošimas veiklai"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readyToStart
              ? "Pradėjus veiklą dalyviai galės prisijungti su QR kodu arba veiklos kodu."
              : "Veiklą galėsite pradėti, kai sutvarkysite būtinus punktus."}
          </p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {facts && <div className="mt-4 border-t border-border pt-4">{facts}</div>}

      {missing.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-4">
          {missing.map((item) => (
            <li key={item.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              <Circle className="h-4 w-4 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden="true" />
              <span className="font-bold text-steam-dark">{item.label}</span>
              <span className="text-muted-foreground">{item.required ? "būtina" : "rekomenduojama"}</span>
              {item.hint && <span className="ml-auto text-steam-dark">{item.hint}</span>}
            </li>
          ))}
        </ul>
      )}

      <details className="group mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md text-sm text-muted-foreground underline underline-offset-4 hover:text-steam-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          Visi patikros punktai: atlikta {doneCount} iš {items.length}
        </summary>
        <ul className="mt-1 space-y-1.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className={item.done ? "text-steam-dark" : "text-muted-foreground"}>{item.label}</span>
              <span className="sr-only">{item.done ? " (atlikta)" : " (neatlikta)"}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
