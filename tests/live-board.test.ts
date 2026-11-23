import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import {
  boardPhase,
  countdownUrgency,
  sharedRanks,
  shortAddress,
  COUNTDOWN_NOTE,
} from "@/lib/game/live-board"
import { RAY_FILL_CLASS, subjectRay } from "@/lib/starter-catalogue/subject-ray"
import { SUBJECTS } from "@/lib/access/profile-fields"

const team = (id: string, total_points: number) => ({ id, total_points })

describe("places on the class screen", () => {
  it("gives nobody a place before the first points", () => {
    expect(sharedRanks([team("a", 0), team("b", 0)])).toEqual([null, null])
    expect(sharedRanks([])).toEqual([])
  })

  it("ranks only the teams that have points", () => {
    expect(sharedRanks([team("a", 100), team("b", 0), team("c", 0)])).toEqual([1, null, null])
  })

  it("lets level teams share a place and skips the next one", () => {
    expect(sharedRanks([team("a", 180), team("b", 180), team("c", 80)])).toEqual([1, 1, 3])
    expect(sharedRanks([team("a", 180), team("b", 150), team("c", 150), team("d", 150), team("e", 10)])).toEqual([
      1, 2, 2, 2, 5,
    ])
  })
})

describe("join screen or board", () => {
  const none = new Map<string, number>()

  it("shows the join screen until a team has solved something", () => {
    expect(boardPhase({ status: "active", teams: [], solvedCounts: none })).toBe("join")
    expect(boardPhase({ status: "active", teams: [team("a", 0), team("b", 0)], solvedCounts: none })).toBe("join")
    expect(boardPhase({ status: "paused", teams: [team("a", 0)], solvedCounts: none })).toBe("join")
  })

  it("moves to the board with the first solved task or the first point", () => {
    expect(boardPhase({ status: "active", teams: [team("a", 0), team("b", 50)], solvedCounts: none })).toBe("board")
    // A task worth nothing after hint penalties still counts as solved.
    expect(boardPhase({ status: "active", teams: [team("a", 0)], solvedCounts: new Map([["a", 1]]) })).toBe("board")
    // Solves of a team that is no longer listed do not count.
    expect(boardPhase({ status: "active", teams: [team("a", 0)], solvedCounts: new Map([["gone", 2]]) })).toBe("join")
  })

  it("always shows the board once the activity is over", () => {
    expect(boardPhase({ status: "finished", teams: [], solvedCounts: none })).toBe("board")
    expect(boardPhase({ status: "finished", teams: [team("a", 0)], solvedCounts: none })).toBe("board")
  })
})

describe("countdown urgency", () => {
  it("changes at five minutes, one minute and zero", () => {
    expect(countdownUrgency(null)).toBe("calm")
    expect(countdownUrgency(301)).toBe("calm")
    expect(countdownUrgency(300)).toBe("soon")
    expect(countdownUrgency(61)).toBe("soon")
    expect(countdownUrgency(60)).toBe("last")
    expect(countdownUrgency(1)).toBe("last")
    expect(countdownUrgency(0)).toBe("over")
  })

  it("says each urgent state in words, so colour is not the only sign", () => {
    expect(COUNTDOWN_NOTE.calm).toBeNull()
    for (const state of ["soon", "last", "over"] as const) expect(COUNTDOWN_NOTE[state]).toBeTruthy()
    const view = readFileSync("components/teacher/live-view.tsx", "utf8")
    expect(view).toContain("COUNTDOWN_NOTE[urgency]")
    expect(view).not.toContain("animate-pulse")
  })
})

describe("the address a participant types", () => {
  it("drops the scheme and a trailing slash", () => {
    expect(shortAddress("https://pamokos.kusteam.app/prisijungti")).toBe("pamokos.kusteam.app/prisijungti")
    expect(shortAddress("http://pamokos.localhost:3000/")).toBe("pamokos.localhost:3000")
  })
})

describe("subject ray colours in the catalogue", () => {
  it("gives every subject one of the five rays, the same every time", () => {
    for (const subject of SUBJECTS) {
      expect(RAY_FILL_CLASS[subjectRay(subject)], subject).toMatch(/^bg-(primary|secondary|accent|highlight|foreground)$/)
      expect(subjectRay(subject)).toBe(subjectRay(subject))
    }
    expect(subjectRay("Dalykas, kurio dar nėra")).toBe("engineering")
  })

  it("follows the letters of STEAM and uses all five rays", () => {
    expect(subjectRay("Biologija")).toBe("science")
    expect(subjectRay("Informatika")).toBe("technology")
    expect(subjectRay("Technologijos")).toBe("engineering")
    expect(subjectRay("Dailė")).toBe("arts")
    expect(subjectRay("Matematika")).toBe("maths")
    expect(new Set(SUBJECTS.map(subjectRay)).size).toBe(5)
  })

  it("is a coloured shape, never coloured text", () => {
    for (const fill of Object.values(RAY_FILL_CLASS)) expect(fill.startsWith("bg-")).toBe(true)
  })
})

describe("the class screen", () => {
  const view = readFileSync("components/teacher/live-view.tsx", "utf8")
  const join = readFileSync("components/teacher/live-join-screen.tsx", "utf8")
  const board = readFileSync("components/teacher/live-leaderboard-board.tsx", "utf8")
  const actions = readFileSync("components/teacher/game-status-actions.tsx", "utf8")

  it("decides its phase and its places through the tested helpers", () => {
    expect(view).toContain("boardPhase({ status, teams, solvedCounts })")
    expect(board).toContain("sharedRanks(teams)")
  })

  it("shows the brand rays once, drawn, on the join screen only", () => {
    expect(join.match(/<SteamRays/g)).toHaveLength(1)
    expect(join).toMatch(/<SteamRays\s+draw\s+onDark/)
    expect(view).not.toContain("<SteamRays")
    expect(board).not.toContain("<SteamRays")
  })

  it("moves nothing for a facilitator who asked for reduced motion", () => {
    expect(view).toContain('<MotionConfig reducedMotion="user">')
    for (const source of [join, board]) expect(source).toContain("useReducedMotion()")
    for (const source of [view, join, board]) expect(source).not.toMatch(/animate-(pulse|spin|bounce|ping)|Infinity/)
  })

  it("keeps finishing the activity apart from pausing it, and confirmed", () => {
    expect(actions).toContain("order-last")
    expect(actions).toContain("<DialogTitle>Baigti veiklą?</DialogTitle>")
    expect(actions).toContain("Šio veiksmo negalima atšaukti.")
  })
})
