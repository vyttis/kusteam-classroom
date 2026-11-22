import type { GameStatus } from "@/types/game"

/** What the dashboard needs to know about an activity. */
export interface DashboardGame {
  id: string
  status: GameStatus
  created_at: string
  updated_at?: string | null
  ends_at?: string | null
  /** Number of tasks. */
  taskCount: number
  /** Number of teams that joined. */
  teamCount: number
}

export interface GameGroups<T> {
  /** Active first, then paused. */
  running: T[]
  drafts: T[]
  finished: T[]
}

const time = (value?: string | null) => {
  const ms = value ? Date.parse(value) : NaN
  return Number.isNaN(ms) ? 0 : ms
}
const lastTouched = (g: DashboardGame) => time(g.updated_at) || time(g.created_at)

/**
 * Dashboard order: what runs now, then what is being prepared, then what is
 * over. Inside a group the most recently touched activity comes first; a
 * running activity always comes before a paused one.
 */
export function groupGames<T extends DashboardGame>(games: T[]): GameGroups<T> {
  const newestFirst = (a: T, b: T) => lastTouched(b) - lastTouched(a)
  const running = games
    .filter((g) => g.status === "active" || g.status === "paused")
    .sort((a, b) => Number(a.status === "paused") - Number(b.status === "paused") || newestFirst(a, b))
  const drafts = games.filter((g) => g.status === "draft").sort(newestFirst)
  const finished = games
    .filter((g) => g.status === "finished")
    .sort((a, b) => (time(b.ends_at) || lastTouched(b)) - (time(a.ends_at) || lastTouched(a)))
  return { running, drafts, finished }
}

export type NextActionKind = "continue" | "add-tasks" | "start" | "results"

export interface NextAction {
  kind: NextActionKind
  /** Short visible label. */
  label: string
  /** What the label means for this activity; used in the accessible name. */
  verb: string
  href: string
}

/**
 * The one most useful thing to do with an activity:
 * - running or paused: go back to leading it ("Tęsti"),
 * - draft without tasks: add tasks,
 * - draft with tasks: start it ("Pradėti"; the start button and its checks
 *   live on the activity page),
 * - finished: look at the results ("Rezultatai").
 */
export function nextAction(game: Pick<DashboardGame, "id" | "status" | "taskCount">): NextAction {
  switch (game.status) {
    case "active":
    case "paused":
      return { kind: "continue", label: "Tęsti", verb: "Tęsti veiklą", href: `/games/${game.id}` }
    case "finished":
      return { kind: "results", label: "Rezultatai", verb: "Rezultatai, veikla", href: `/games/${game.id}/analytics` }
    default:
      return game.taskCount > 0
        ? { kind: "start", label: "Pradėti", verb: "Pradėti veiklą", href: `/games/${game.id}` }
        : { kind: "add-tasks", label: "Pridėti užduočių", verb: "Pridėti užduočių veiklai", href: `/games/${game.id}/builder` }
  }
}

export interface ChecklistStep {
  label: string
  done: boolean
  href: string
  /** The first step that is not done yet. */
  current: boolean
}

export const CATALOGUE_PATH = "/paruostos-veiklos"

/**
 * "Pirmieji žingsniai": state comes from the facilitator's own activities
 * (nothing is stored), and each step links to where it is done.
 */
export function checklistSteps(games: DashboardGame[]): ChecklistStep[] {
  // The activity the facilitator is most likely working on.
  const byRecency = [...games].sort((a, b) => lastTouched(b) - lastTouched(a))
  const latest = byRecency[0]
  const withTasks = byRecency.find((g) => g.taskCount > 0)
  const readyDraft = byRecency.find((g) => g.status === "draft" && g.taskCount > 0)
  const started = byRecency.find((g) => g.status !== "draft")
  const withResults = byRecency.find((g) => g.teamCount > 0 || g.status === "finished")

  const steps = [
    { label: "Pasirinkite arba sukurkite veiklą", done: Boolean(latest), href: CATALOGUE_PATH },
    {
      label: "Pridėkite užduočių",
      done: Boolean(withTasks),
      href: latest ? `/games/${latest.id}/builder` : CATALOGUE_PATH,
    },
    {
      label: "Pradėkite veiklą su QR kodu",
      done: Boolean(started),
      href: readyDraft || withTasks ? `/games/${(readyDraft ?? withTasks)!.id}` : latest ? `/games/${latest.id}/builder` : CATALOGUE_PATH,
    },
    {
      label: "Peržiūrėkite rezultatus",
      done: Boolean(withResults),
      href: started ? `/games/${started.id}/analytics` : latest ? `/games/${latest.id}` : CATALOGUE_PATH,
    },
  ]
  const currentIndex = steps.findIndex((s) => !s.done)
  return steps.map((s, i) => ({ ...s, current: i === currentIndex }))
}
