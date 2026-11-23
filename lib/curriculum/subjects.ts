export interface Subject {
  id: string
  label: string
  grades: number[]
  icon: string // lucide-react icon name
}

const g = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

// The ids are stored on saved lesson plans (lesson_plans.subject) and name
// the topic lists in topics.ts, so they never change: only the labels follow
// the names of the updated general curricula (Bendrosios programos, 2022).
// "pasaulio-pazinimas" keeps its old name: the updated curricula split it
// into "Gamtos mokslai" and "Visuomeninis ugdymas", which needs a subject
// expert and new topic lists, not a new label.
export const SUBJECTS: Subject[] = [
  { id: "lietuviu-kalba",         label: "Lietuvių kalba ir literatūra", grades: g(1, 12), icon: "BookText" },
  { id: "matematika",             label: "Matematika",                   grades: g(1, 12), icon: "Calculator" },
  { id: "pasaulio-pazinimas",     label: "Pasaulio pažinimas",           grades: g(1, 4),  icon: "Compass" },
  { id: "gamta-ir-zmogus",        label: "Gamtos mokslai",               grades: [5, 6],   icon: "Sprout" },
  { id: "biologija",              label: "Biologija",                    grades: g(7, 12), icon: "Leaf" },
  { id: "chemija",                label: "Chemija",                      grades: g(8, 12), icon: "FlaskConical" },
  { id: "fizika",                 label: "Fizika",                       grades: g(7, 12), icon: "Atom" },
  { id: "istorija",               label: "Istorija",                     grades: g(5, 12), icon: "Landmark" },
  { id: "geografija",             label: "Geografija",                   grades: g(6, 12), icon: "Globe" },
  { id: "pilietiskumas",          label: "Pilietiškumo pagrindai",       grades: [9, 10],  icon: "Scale" },
  { id: "ekonomika",              label: "Ekonomika ir verslumas",       grades: g(9, 12), icon: "TrendingUp" },
  { id: "informatika",            label: "Informatika",                  grades: g(5, 12), icon: "Cpu" },
  { id: "anglu-kalba",            label: "Užsienio kalba (anglų)",       grades: g(2, 12), icon: "Languages" },
  { id: "antroji-uzsienio-kalba", label: "Užsienio kalba (antroji)",     grades: g(6, 12), icon: "MessageSquare" },
  { id: "daile",                  label: "Dailė",                        grades: g(1, 10), icon: "Palette" },
  { id: "muzika",                 label: "Muzika",                       grades: g(1, 10), icon: "Music" },
  { id: "technologijos",          label: "Technologijos",                grades: g(1, 10), icon: "Hammer" },
  { id: "fizinis-ugdymas",        label: "Fizinis ugdymas",              grades: g(1, 12), icon: "Dumbbell" },
  { id: "tikyba",                 label: "Dorinis ugdymas (tikyba)",     grades: g(1, 12), icon: "Church" },
  { id: "etika",                  label: "Dorinis ugdymas (etika)",      grades: g(1, 12), icon: "HeartHandshake" },
  { id: "psichologija",           label: "Psichologija",                 grades: [11, 12], icon: "Brain" },
  { id: "filosofija",             label: "Filosofija",                   grades: [11, 12], icon: "Lightbulb" },
  { id: "teatras",                label: "Teatras",                      grades: g(5, 12), icon: "Drama" },
  { id: "sokis",                  label: "Šokis",                        grades: g(1, 12), icon: "PersonStanding" },
]

export const LESSON_TYPES = [
  { id: "nauja_tema", label: "Nauja tema" },
  { id: "kartojimas", label: "Kartojimas" },
  { id: "vertinimas", label: "Vertinimas" },
  { id: "projektine_veikla", label: "Projektinė veikla" },
] as const

export const DURATIONS = [
  { value: 25, label: "25 min" },
  { value: 35, label: "35 min" },
  { value: 45, label: "45 min" },
] as const

export function getSubjectById(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id)
}

export function getGradesForSubject(subjectId: string): number[] {
  return getSubjectById(subjectId)?.grades ?? []
}

export function getSubjectLabel(id: string): string {
  return (
    SUBJECTS.find((s) => s.id === id)?.label ??
    (id === "steam" ? "Integruotos STEAM veiklos" : id)
  )
}

export function getGradesIntersection(a: string, b: string): number[] {
  const setA = new Set(getGradesForSubject(a))
  return getGradesForSubject(b).filter((g) => setA.has(g))
}
