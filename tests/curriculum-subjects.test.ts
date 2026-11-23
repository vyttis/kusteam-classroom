import { describe, expect, it } from "vitest"
import { SUBJECTS, getGradesForSubject, getSubjectLabel } from "@/lib/curriculum/subjects"
import { getTopicsForSubjectAndGrade } from "@/lib/curriculum/topics"

// Saved lesson plans store these ids (lesson_plans.subject, secondary_subject)
// and topics.ts is keyed by them: a subject may get a new label, never a new id.
const STORED_IDS = [
  "lietuviu-kalba", "matematika", "pasaulio-pazinimas", "gamta-ir-zmogus", "biologija", "chemija", "fizika",
  "istorija", "geografija", "pilietiskumas", "ekonomika", "informatika", "anglu-kalba", "antroji-uzsienio-kalba",
  "daile", "muzika", "technologijos", "fizinis-ugdymas", "tikyba", "etika", "psichologija", "filosofija",
  "teatras", "sokis",
]

describe("curriculum subjects", () => {
  it("keeps every stored subject id", () => {
    expect(SUBJECTS.map((s) => s.id)).toEqual(STORED_IDS)
  })

  it("shows the names of the updated general curricula", () => {
    expect(getSubjectLabel("gamta-ir-zmogus")).toBe("Gamtos mokslai")
    expect(getSubjectLabel("tikyba")).toBe("Dorinis ugdymas (tikyba)")
    expect(getSubjectLabel("etika")).toBe("Dorinis ugdymas (etika)")
    const labels = SUBJECTS.map((s) => s.label)
    for (const old of ["Gamta ir žmogus", "Tikyba", "Etika"]) expect(labels).not.toContain(old)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("leaves grades and topic lists of the renamed subjects as they were", () => {
    expect(getGradesForSubject("gamta-ir-zmogus")).toEqual([5, 6])
    expect(getGradesForSubject("tikyba")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(getGradesForSubject("etika")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    for (const [id, grade] of [["gamta-ir-zmogus", 5], ["tikyba", 7], ["etika", 9]] as const) {
      expect(getTopicsForSubjectAndGrade(id, grade).length).toBeGreaterThan(0)
    }
  })

  it("falls back to the stored value for a subject it does not know", () => {
    expect(getSubjectLabel("steam")).toBe("Integruotos STEAM veiklos")
    expect(getSubjectLabel("nezinomas")).toBe("nezinomas")
  })
})
