import { z } from "zod"
import { GRADE_BANDS, SUBJECTS } from "@/lib/access/profile-fields"

/**
 * Ready-made activities a facilitator can add to their account with one
 * click and run in a lesson as they are, or edit first. They live in code so
 * every change is reviewed; answers never reach a browser (the server hashes
 * them when it creates the activity, like the sample activity).
 */

const text = (max: number) => z.string().trim().min(1).max(max)

export const starterChallengeSchema = z.object({
  title: text(120),
  /** What the team reads. States the expected answer format. */
  description: text(1200),
  type: z.enum(["text", "number", "multiple_choice"]),
  points: z.number().int().min(50).max(300),
  correct_answer: text(120),
  /** Other spellings that also count (text and number tasks), at most 5. */
  accepted_answers: z.array(text(120)).max(5).default([]),
  /** A ladder: direction, narrowing fact, method. Never the answer itself. */
  hints: z.array(text(240)).min(1).max(3),
  options: z.array(text(160)).length(4).nullable(),
  /** Shown to the team after a correct answer: why it is right. */
  explanation: text(600),
  difficulty: z.enum(["easy", "medium", "hard"]),
  cognitive_level: z.enum(["remember", "understand", "apply", "analyse"]),
})

export const starterActivitySchema = z.object({
  /** Stable id, lowercase latin letters, digits and hyphens. */
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
  title: text(80),
  /** One or two sentences for the catalogue card. */
  description: text(300),
  subject: z.enum(SUBJECTS),
  grade_band: z.enum(GRADE_BANDS),
  duration_minutes: z.number().int().min(10).max(45),
  /** Area and topic of the Lithuanian general curriculum this serves. */
  curriculum: text(240),
  /** What participants will be able to do afterwards; measurable verbs. */
  learning_goals: z.array(text(200)).min(1).max(3),
  teacher_notes: z.object({
    /** Preparation and how to form teams. */
    before: text(500),
    /** What to watch for while teams work. */
    during: text(500),
    /** How to discuss the results; typical misconceptions to address. */
    after: text(700),
  }),
  /** Questions for the closing discussion. */
  reflection_questions: z.array(text(200)).min(2).max(4),
  /** Where the facts come from, for the reviewer (textbook, institution, URL). */
  sources: z.array(text(300)).min(1).max(6),
  challenges: z.array(starterChallengeSchema).min(4).max(8),
})

export type StarterChallenge = z.infer<typeof starterChallengeSchema>
export type StarterActivity = z.infer<typeof starterActivitySchema>
/** As written in the content files: fields with defaults may be left out. */
export type StarterActivityInput = z.input<typeof starterActivitySchema>
