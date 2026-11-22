/**
 * Shapes and pure helpers of the ready-made activity catalogue. Safe for
 * client components: nothing here imports the activity content.
 */
export interface CatalogueTask {
  title: string
  type: "text" | "number" | "multiple_choice"
  points: number
}
export interface CatalogueEntry {
  slug: string
  title: string
  description: string
  subject: string
  grade_band: string
  duration_minutes: number
  task_count: number
  total_points: number
}

export interface CatalogueDetail extends CatalogueEntry {
  curriculum: string
  learning_goals: string[]
  teacher_notes: { before: string; during: string; after: string }
  reflection_questions: string[]
  tasks: CatalogueTask[]
}

/** How well an entry fits the facilitator's profile: 2 both, 1 one, 0 none. */
export function relevance(
  entry: Pick<CatalogueEntry, "subject" | "grade_band">,
  subjects: readonly string[],
  grades: readonly string[],
): number {
  return (subjects.includes(entry.subject) ? 1 : 0) + (grades.includes(entry.grade_band) ? 1 : 0)
}

/** Best fit first; the reviewed catalogue order is kept within a tier. */
export function sortByRelevance<T extends Pick<CatalogueEntry, "subject" | "grade_band">>(
  entries: readonly T[],
  subjects: readonly string[],
  grades: readonly string[],
): T[] {
  return entries
    .map((entry, index) => ({ entry, index, score: relevance(entry, subjects, grades) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.entry)
}
