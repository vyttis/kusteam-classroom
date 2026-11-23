import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { changesScoring, isLiveStatus, LIVE_SCORING_NOTICE, samePrerequisites } from "@/lib/game/live-edit"

describe("live edit rules", () => {
  it("treats running and paused activities as live", () => {
    expect(isLiveStatus("active")).toBe(true)
    expect(isLiveStatus("paused")).toBe(true)
    expect(isLiveStatus("draft")).toBe(false)
    expect(isLiveStatus("finished")).toBe(false)
    expect(isLiveStatus(null)).toBe(false)
  })

  it("compares prerequisite lists as sets", () => {
    expect(samePrerequisites(["a", "b"], ["b", "a"])).toBe(true)
    expect(samePrerequisites([], null)).toBe(true)
    expect(samePrerequisites(["a"], ["a", "b"])).toBe(false)
    expect(samePrerequisites(["a", "c"], ["a", "b"])).toBe(false)
  })
})

// Audit R-13, scenario P13: a new answer or other points saved while the
// activity runs apply to new answers only. Nothing is rescored, so the
// facilitator is told.
describe("scoring changes while the activity runs", () => {
  const stored = { type: "text", points: 100, hint_penalty: 20 }

  it("a new answer, other accepted answers, type, points or penalty change scoring", () => {
    expect(changesScoring({ correct_answer: "Vilnius" }, stored)).toBe(true)
    expect(changesScoring({ accepted_answers: [] }, stored)).toBe(true)
    expect(changesScoring({ type: "number" }, stored)).toBe(true)
    expect(changesScoring({ points: 50 }, stored)).toBe(true)
    expect(changesScoring({ hint_penalty: 0 }, stored)).toBe(true)
  })

  it("a save that repeats the stored values (the editor sends them every time) does not", () => {
    expect(changesScoring({ type: "text", points: 100, hint_penalty: 20 }, stored)).toBe(false)
    expect(changesScoring({}, stored)).toBe(false)
    expect(changesScoring({ hint_penalty: 0 }, { ...stored, hint_penalty: null })).toBe(false)
  })

  it("the notice says in Lithuanian that given answers are not checked again", () => {
    expect(LIVE_SCORING_NOTICE).toContain("Jau pateikti atsakymai iš naujo nevertinami")
    expect(LIVE_SCORING_NOTICE).toContain("komandų taškai ir išspręstos užduotys lieka")
    expect(LIVE_SCORING_NOTICE).not.toMatch(/[—–]/)
  })

  it("the save route returns it for a running activity whose task has answers, and the editor shows it", () => {
    const route = readFileSync("app/api/challenges/[challengeId]/route.ts", "utf8")
    expect(route).toMatch(/isLiveStatus\(owned\.gameStatus\) &&\s+changesScoring\(parsed\.data, \{ type: owned\.type, points: owned\.points, hint_penalty: owned\.hintPenalty \}\)/)
    expect(route).toMatch(/if \(countError \|\| \(count \?\? 0\) > 0\) \{\s+return NextResponse\.json\(\{ \.\.\.\(data as unknown as Record<string, unknown>\), live_scoring_notice: LIVE_SCORING_NOTICE \}\)/)
    const editor = readFileSync("components/teacher/game-builder/manual-task-editor.tsx", "utf8")
    expect(editor).toContain("saved.live_scoring_notice")
    expect(editor).toContain("description: notice")
    const builder = readFileSync("components/teacher/game-builder/game-builder.tsx", "utf8")
    expect(builder).toContain("Jau pateikti atsakymai iš naujo nevertinami")
  })
})
