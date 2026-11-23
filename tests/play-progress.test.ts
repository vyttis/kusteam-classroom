import { describe, expect, it } from "vitest"
import { sharedRanks, taskSegments, teamPlace } from "@/components/player/play-progress"

const team = (id: string, total_points: number) => ({ id, total_points })

describe("places on the participant board", () => {
  it("gives nobody a place before anyone has points", () => {
    expect(sharedRanks([team("a", 0), team("b", 0)])).toEqual([null, null])
  })

  it("shares a place between teams tied on points and skips the next one", () => {
    expect(sharedRanks([team("a", 100), team("b", 100), team("c", 80), team("d", 0)])).toEqual([1, 1, 3, null])
    expect(sharedRanks([team("a", 100), team("b", 80), team("c", 80), team("d", 30)])).toEqual([1, 2, 2, 4])
  })

  it("does not depend on the order of the list", () => {
    expect(sharedRanks([team("c", 80), team("a", 100)])).toEqual([2, 1])
  })

  it("finds a team's place and the number of teams", () => {
    const teams = [team("a", 100), team("b", 100), team("c", 0)]
    expect(teamPlace(teams, "b")).toEqual({ rank: 1, of: 3 })
    expect(teamPlace(teams, "c")).toEqual({ rank: null, of: 3 })
    expect(teamPlace(teams, "x")).toBeNull()
    expect(teamPlace(teams, null)).toBeNull()
  })
})

describe("task progress segments", () => {
  it("marks solved tasks, the open one and the rest", () => {
    expect(taskSegments(["a", "b", "c", "d"], new Set(["a"]), "b")).toEqual(["solved", "current", "todo", "todo"])
  })

  it("keeps a solved task solved while its result is on screen", () => {
    expect(taskSegments(["a", "b"], new Set(["a"]), "a")).toEqual(["solved", "todo"])
  })

  it("ignores solved ids of tasks that no longer exist", () => {
    expect(taskSegments(["a"], new Set(["gone"]), null)).toEqual(["todo"])
    expect(taskSegments([], new Set(["gone"]))).toEqual([])
  })
})
