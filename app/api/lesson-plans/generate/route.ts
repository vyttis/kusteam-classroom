import { createClient } from "@/lib/supabase/server"
import { checkAiAllowance, enterAiContext } from "@/lib/ai/usage"
import { friendlyAiError } from "@/lib/ai/error-message"
import { NextResponse } from "next/server"
import { buildLessonPlanSystemPrompt, buildLessonPlanUserMessage } from "@/lib/ai/lesson-plan-prompt"
import { getGradesForSubject, getGradesIntersection } from "@/lib/curriculum/subjects"
import { MODELS, cachedSystem } from "@/lib/ai/client"
import { createWithSchemaRetry } from "@/lib/ai/retry"
import { checkAiRateLimitAsync } from "@/lib/ai/rate-limit"
import { lessonPlanWarnings } from "@/lib/lesson-plans/checks"
import { z } from "zod"

const requestSchema = z.object({
  subject: z.string().min(1),
  secondary_subject: z.string().min(1).nullable().optional(),
  grade: z.number().min(1).max(12),
  topic: z.string().min(1).max(500),
  lesson_type: z.enum(["nauja_tema", "kartojimas", "vertinimas", "projektine_veikla"]),
  duration: z.number().min(25).max(90),
  learning_goal: z.string().max(500).optional(),
  curriculum_context: z.string().max(2000).optional(),
}).refine(
  (d) => !d.secondary_subject || d.secondary_subject !== d.subject,
  { message: "Antrasis dalykas turi skirtis nuo pirmojo", path: ["secondary_subject"] }
)

import { competenciesSchema, bloomLevelSchema } from "@/lib/ai/schemas"

const stageSchema = z.object({
  activity_type: z.enum(["intro", "challenge", "discussion", "reflection"]),
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["text", "number", "multiple_choice"]),
  correct_answer: z.coerce.string().min(1),
  options: z.array(z.string()).nullable().default(null),
  hints: z.array(z.string()).default([]),
  explanation: z.string().default(""),
  points: z.number().min(10).max(500).default(100),
  duration_minutes: z.number().min(1).max(45).default(5),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  competencies: competenciesSchema,
  bloom_level: bloomLevelSchema,
})

// Accept both "stages" (current prompt) and "activities" (old prompt) — the
// model occasionally outputs either depending on grade / context.
const lessonPlanResponseSchema = z
  .object({
    title: z.string().min(1),
    goal: z.string().min(1),
    curriculum_link: z.string().default(""),
    stages: z.array(stageSchema).min(1).optional(),
    activities: z.array(stageSchema).min(1).optional(),
    reflection_prompt: z.string().default(""),
    reflection_question: z.string().default("").optional(),
    teacher_methodical_note: z.string().default(""),
    teacher_note: z.string().default("").optional(),
    competencies: competenciesSchema,
  })
  .transform((obj) => ({
    title: obj.title,
    goal: obj.goal,
    curriculum_link: obj.curriculum_link,
    stages: obj.stages ?? obj.activities ?? [],
    reflection_prompt: obj.reflection_prompt || obj.reflection_question || "",
    teacher_methodical_note: obj.teacher_methodical_note || obj.teacher_note || "",
    competencies: obj.competencies,
  }))
  .refine((obj) => obj.stages.length > 0, {
    message: "Lesson plan must contain at least one stage/activity",
  })

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Neautorizuota" }, { status: 401 })
    }

    if (!(await checkAiRateLimitAsync("lesson-plans-generate", user.id, 5))) {
      return NextResponse.json(
        { error: "Pasiektas DI užklausų limitas (5/min). Palaukite minutę ir bandykite vėl." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }
    // Monthly DI limits (personal and platform budget); every model call
    // from here on is recorded for this action.
    const allowance = await checkAiAllowance(user.id, "lesson-plans/generate")
    if (!allowance.ok) {
      return NextResponse.json({ error: allowance.message, code: allowance.code }, { status: 429 })
    }
    enterAiContext(allowance.ctx)

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Netinkamas formatas" }, { status: 400 })
    }

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Neteisingi duomenys" },
        { status: 400 }
      )
    }

    const validGrades = parsed.data.secondary_subject
      ? getGradesIntersection(parsed.data.subject, parsed.data.secondary_subject)
      : getGradesForSubject(parsed.data.subject)
    if (validGrades.length === 0) {
      return NextResponse.json(
        { error: "Šie dalykai neturi bendrų klasių. Pasirinkite kitą derinį." },
        { status: 400 }
      )
    }
    if (!validGrades.includes(parsed.data.grade)) {
      return NextResponse.json(
        { error: `Klasė ${parsed.data.grade} netinka šiam dalykų deriniui.` },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "DI paslauga nepasiekiama." },
        { status: 503 }
      )
    }

    // Use deepGenerate (Opus 4.7) for lesson plans — this is the inspectable
    // pedagogical output the Ministry will review. Quality > cost.
    // Schema retry handles the most common failure (slightly off field names).
    const lessonPlan = await createWithSchemaRetry(
      {
        model: MODELS.deepGenerate,
        max_tokens: 8192,
        system: cachedSystem(buildLessonPlanSystemPrompt()),
        messages: [{ role: "user", content: buildLessonPlanUserMessage({
          ...parsed.data,
          secondary_subject: parsed.data.secondary_subject ?? null,
        }) }],
      },
      lessonPlanResponseSchema,
      { logPrefix: "lesson-plan-generate", maxRetries: 1 },
    )

    // Rule-based notes for the facilitator (stage minutes against the lesson
    // length, hints that give an answer away). The plan is returned as the
    // model wrote it; the preview shows the notes.
    const warnings = lessonPlanWarnings(lessonPlan.stages, parsed.data.duration)

    return NextResponse.json({ lesson_plan: lessonPlan, warnings })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error("Lesson plan generate error:", errMsg, error)
    const friendly = friendlyAiError(error, "Pamokos plano generavimas nepavyko. Bandykite dar kartą.")
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}

// Lesson plan generation with Opus 4.7 can take longer for full plans
export const maxDuration = 300
