import { STARTER_ACTIVITIES } from "@/lib/content/starter-activities"
import type { StarterActivity } from "@/lib/content/starter-activities/schema"
import type { CatalogueDetail, CatalogueEntry } from "./types"

/**
 * What the catalogue pages may show of a ready-made activity before a
 * facilitator makes their own copy. Fields are copied one by one (never
 * spread), so answers, other accepted spellings, hints and the texts shown
 * after solving stay on the server: the catalogue UI reads activities only
 * through this module (tests/starter-catalogue.test.ts guards that). Server
 * only: it imports the full content, so client components use ./types.
 */

export function toCatalogueEntry(activity: StarterActivity): CatalogueEntry {
  return {
    slug: activity.slug,
    title: activity.title,
    description: activity.description,
    subject: activity.subject,
    grade_band: activity.grade_band,
    duration_minutes: activity.duration_minutes,
    task_count: activity.challenges.length,
    total_points: activity.challenges.reduce((sum, c) => sum + c.points, 0),
  }
}

export function toCatalogueDetail(activity: StarterActivity): CatalogueDetail {
  return {
    ...toCatalogueEntry(activity),
    curriculum: activity.curriculum,
    learning_goals: [...activity.learning_goals],
    teacher_notes: {
      before: activity.teacher_notes.before,
      during: activity.teacher_notes.during,
      after: activity.teacher_notes.after,
    },
    reflection_questions: [...activity.reflection_questions],
    tasks: activity.challenges.map((c) => ({ title: c.title, type: c.type, points: c.points })),
  }
}

export function listCatalogueEntries(): CatalogueEntry[] {
  return STARTER_ACTIVITIES.map(toCatalogueEntry)
}

export function findCatalogueDetail(slug: string): CatalogueDetail | undefined {
  const activity = STARTER_ACTIVITIES.find((a) => a.slug === slug)
  return activity ? toCatalogueDetail(activity) : undefined
}
