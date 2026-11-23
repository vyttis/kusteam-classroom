import { describe, expect, it } from "vitest"
import { CATALOGUE_PATH, checklistSteps, groupGames, nextAction, type DashboardGame } from "@/lib/teacher/dashboard"

let n = 0
function game(over: Partial<DashboardGame> = {}): DashboardGame {
  n += 1
  return {
    id: `g${n}`,
    status: "draft",
    created_at: "2026-11-01T08:00:00Z",
    updated_at: "2026-11-01T08:00:00Z",
    ends_at: null,
    taskCount: 0,
    teamCount: 0,
    ...over,
  }
}

describe("groupGames", () => {
  it("puts running activities first, then drafts, then finished ones", () => {
    const finished = game({ id: "f", status: "finished" })
    const draft = game({ id: "d" })
    const paused = game({ id: "p", status: "paused" })
    const active = game({ id: "a", status: "active" })
    const groups = groupGames([finished, draft, paused, active])
    expect(groups.running.map((g) => g.id)).toEqual(["a", "p"])
    expect(groups.drafts.map((g) => g.id)).toEqual(["d"])
    expect(groups.finished.map((g) => g.id)).toEqual(["f"])
  })

  it("keeps an active activity before a more recently touched paused one", () => {
    const groups = groupGames([
      game({ id: "p", status: "paused", updated_at: "2026-11-20T10:00:00Z" }),
      game({ id: "a", status: "active", updated_at: "2026-11-02T10:00:00Z" }),
    ])
    expect(groups.running.map((g) => g.id)).toEqual(["a", "p"])
  })

  it("orders drafts by the last change and finished ones by when they ended", () => {
    const groups = groupGames([
      game({ id: "d-old", updated_at: "2026-11-02T10:00:00Z" }),
      game({ id: "d-new", updated_at: "2026-11-10T10:00:00Z" }),
      game({ id: "d-no-update", updated_at: null, created_at: "2026-11-05T10:00:00Z" }),
      game({ id: "f-early", status: "finished", ends_at: "2026-11-03T10:00:00Z", updated_at: "2026-11-21T10:00:00Z" }),
      game({ id: "f-late", status: "finished", ends_at: "2026-11-12T10:00:00Z", updated_at: "2026-11-12T10:00:00Z" }),
    ])
    expect(groups.drafts.map((g) => g.id)).toEqual(["d-new", "d-no-update", "d-old"])
    expect(groups.finished.map((g) => g.id)).toEqual(["f-late", "f-early"])
  })

  it("loses no activity and does not change the list it was given", () => {
    const games = [game({ status: "finished" }), game(), game({ status: "active" }), game({ status: "paused" }), game()]
    const before = games.map((g) => g.id)
    const groups = groupGames(games)
    expect(groups.running.length + groups.drafts.length + groups.finished.length).toBe(games.length)
    expect(games.map((g) => g.id)).toEqual(before)
  })
})

describe("nextAction", () => {
  it("continues a running or paused activity on its page", () => {
    for (const status of ["active", "paused"] as const) {
      expect(nextAction({ id: "x", status, taskCount: 3 })).toMatchObject({ kind: "continue", label: "Tęsti", href: "/games/x" })
    }
  })

  it("starts a draft that has tasks and sends an empty draft to the builder", () => {
    expect(nextAction({ id: "x", status: "draft", taskCount: 2 })).toMatchObject({ kind: "start", label: "Pradėti", href: "/games/x" })
    expect(nextAction({ id: "x", status: "draft", taskCount: 0 })).toMatchObject({
      kind: "add-tasks",
      href: "/games/x/builder",
    })
  })

  it("shows the results of a finished activity", () => {
    expect(nextAction({ id: "x", status: "finished", taskCount: 2 })).toMatchObject({
      kind: "results",
      label: "Rezultatai",
      href: "/games/x/analytics",
    })
  })

  it("keeps the visible label inside the accessible name (WCAG 2.5.3)", () => {
    const cases = [
      { status: "active", taskCount: 1 },
      { status: "draft", taskCount: 1 },
      { status: "draft", taskCount: 0 },
      { status: "finished", taskCount: 1 },
    ] as const
    for (const c of cases) {
      const action = nextAction({ id: "x", ...c })
      expect(action.verb.startsWith(action.label)).toBe(true)
    }
  })
})

describe("checklistSteps", () => {
  const state = (games: DashboardGame[]) => checklistSteps(games).map((s) => (s.done ? "done" : s.current ? "current" : "todo"))

  it("starts a new facilitator at the first step, in the catalogue", () => {
    const steps = checklistSteps([])
    expect(state([])).toEqual(["current", "todo", "todo", "todo"])
    expect(steps[0].href).toBe(CATALOGUE_PATH)
  })

  it("moves the current step as the facilitator progresses", () => {
    expect(state([game()])).toEqual(["done", "current", "todo", "todo"])
    expect(state([game({ taskCount: 3 })])).toEqual(["done", "done", "current", "todo"])
    expect(state([game({ taskCount: 3, status: "active" })])).toEqual(["done", "done", "done", "current"])
    expect(state([game({ taskCount: 3, status: "active", teamCount: 2 })])).toEqual(["done", "done", "done", "done"])
    expect(state([game({ taskCount: 3, status: "finished" })])).toEqual(["done", "done", "done", "done"])
  })

  it("marks exactly one step as current until all are done", () => {
    for (const games of [[], [game()], [game({ taskCount: 1 })], [game({ taskCount: 1, status: "paused" })]]) {
      expect(checklistSteps(games).filter((s) => s.current)).toHaveLength(1)
    }
    expect(checklistSteps([game({ taskCount: 1, status: "finished" })]).some((s) => s.current)).toBe(false)
  })

  it("links each step to where it is done", () => {
    const draft = game({ id: "draft", taskCount: 0, updated_at: "2026-11-10T10:00:00Z" })
    expect(checklistSteps([draft])[1].href).toBe("/games/draft/builder")

    const ready = game({ id: "ready", taskCount: 3, updated_at: "2026-11-11T10:00:00Z" })
    expect(checklistSteps([draft, ready])[2].href).toBe("/games/ready")

    const live = game({ id: "live", taskCount: 3, status: "active", updated_at: "2026-11-12T10:00:00Z" })
    expect(checklistSteps([draft, live])[3].href).toBe("/games/live/analytics")
  })

  it("never links to an activity that does not exist", () => {
    for (const step of checklistSteps([])) expect(step.href).toBe(CATALOGUE_PATH)
  })
})
