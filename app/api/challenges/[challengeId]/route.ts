import { createClient } from "@/lib/supabase/server"
import { hashAnswer, MAX_ANSWER_LENGTH } from "@/lib/game/answer-hasher"
import { changesScoring, isLiveStatus, LIVE_EDIT_BLOCKED, LIVE_SCORING_NOTICE, samePrerequisites } from "@/lib/game/live-edit"
import { acceptedAnswersSchema, prepareAcceptedAnswers } from "@/lib/game/accepted-answers"
import { NextResponse } from "next/server"
import { z } from "zod"

// Safe columns to return (never include answer_hash)
const LEGACY_CHALLENGE_COLUMNS = "id, game_id, title, description, type, points, hints, options, order_index, image_url, maps_url, explanation, difficulty, hint_penalty, generated_by_di, verification_verdict, verification_issues, verification_confidence, prerequisites, created_at, updated_at"
const SAFE_CHALLENGE_COLUMNS = LEGACY_CHALLENGE_COLUMNS + ", needs_answer"

const updateChallengeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(["text", "number", "multiple_choice"]).optional(),
  points: z.number().min(1).max(1000).optional(),
  correct_answer: z
    .string()
    .min(1)
    .max(MAX_ANSWER_LENGTH, `Atsakymas gali būti iki ${MAX_ANSWER_LENGTH} ženklų`)
    .optional(),
  // Replaces the extra accepted answers; [] removes them. Left out, they stay.
  accepted_answers: acceptedAnswersSchema.optional(),
  hints: z.array(z.string()).optional(),
  options: z.array(z.string()).nullable().optional(),
  order_index: z.number().optional(),
  image_url: z.string().url().refine(
    (url) => url.startsWith("https://"),
    { message: "Paveiksliuko URL turi prasidėti https://" }
  ).nullable().optional(),
  maps_url: z.string().url().refine(
    (url) => url.startsWith("https://"),
    { message: "Žemėlapio URL turi prasidėti https://" }
  ).nullable().optional(),
  explanation: z.string().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  hint_penalty: z.number().min(0).max(100).optional(),
  prerequisites: z.array(z.string().uuid()).optional(),
  // The facilitator has looked at a task the DI check flagged and keeps it.
  mark_reviewed: z.literal(true).optional(),
}).strict()

type ChallengeUpdatePayload = Omit<z.infer<typeof updateChallengeSchema>, "mark_reviewed" | "accepted_answers"> & {
  answer_hash?: string
  accepted_answer_hashes?: string[]
  needs_answer?: boolean
  correct_answer?: never
  verification_verdict?: null
  verification_issues?: string[]
  verification_confidence?: null
}

async function verifyChallengeOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: string,
  userId: string
) {
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, game_id, type, prerequisites, points, hint_penalty")
    .eq("id", challengeId)
    .single()

  if (!challenge) return null

  const { data: game } = await supabase
    .from("games")
    .select("id, status")
    .eq("id", challenge.game_id)
    .eq("teacher_id", userId)
    .single()

  return game
    ? {
        type: challenge.type as string | null,
        gameStatus: game.status as string,
        prerequisites: (challenge.prerequisites as string[] | null) ?? [],
        points: (challenge.points as number | null) ?? null,
        hintPenalty: (challenge.hint_penalty as number | null) ?? null,
      }
    : null
}

export async function PATCH(request: Request, props: { params: Promise<{ challengeId: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizuota" }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Netinkamas užklausos formatas" }, { status: 400 })
  }

  const parsed = updateChallengeSchema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Neteisingi duomenys"
    return NextResponse.json(
      { error: firstError },
      { status: 400 }
    )
  }

  // Verify the challenge belongs to a game owned by this teacher
  const owned = await verifyChallengeOwnership(supabase, params.challengeId, user.id)
  if (!owned) {
    return NextResponse.json(
      { error: "Užduotis nerasta arba neturite teisės" },
      { status: 404 }
    )
  }

  // Moving a task while the activity runs shifts teams in linear mode; the
  // order changes only through the reorder route, which refuses it too.
  if (parsed.data.order_index !== undefined && isLiveStatus(owned.gameStatus)) {
    return NextResponse.json({ error: LIVE_EDIT_BLOCKED.reorder, code: "live" }, { status: 409 })
  }
  // Participants keep the unlock rules they loaded while the server checks
  // the stored ones, so a change would lock or open tasks unexpectedly. The
  // editor sends the list on every save; only an actual change is refused.
  if (
    parsed.data.prerequisites !== undefined &&
    isLiveStatus(owned.gameStatus) &&
    !samePrerequisites(parsed.data.prerequisites, owned.prerequisites)
  ) {
    return NextResponse.json({ error: LIVE_EDIT_BLOCKED.prerequisites, code: "live" }, { status: 409 })
  }

  const { correct_answer, mark_reviewed, accepted_answers, ...rest } = parsed.data
  const updateData: ChallengeUpdatePayload = { ...rest }

  // Extra accepted answers are stored in the form of the task's type: new
  // ones replace them, and a change of type drops the old ones.
  const typeAfter = parsed.data.type ?? owned.type
  if (accepted_answers !== undefined) {
    const accepted = await prepareAcceptedAnswers(accepted_answers, typeAfter, correct_answer)
    if (!accepted.ok) return NextResponse.json({ error: accepted.error }, { status: 400 })
    updateData.accepted_answer_hashes = accepted.hashes
  } else if (parsed.data.type !== undefined && parsed.data.type !== owned.type) {
    updateData.accepted_answer_hashes = []
  }
  // A repeated id would make the task need more solves than there are tasks
  // (is_challenge_unlocked compares with the list length): store each once.
  if (updateData.prerequisites) updateData.prerequisites = [...new Set(updateData.prerequisites)]

  // If answer is being updated, hash it with bcrypt (never stored/returned in
  // plaintext) and clear the needs_answer flag set on duplicated/cloned tasks
  if (correct_answer) {
    // Text answers fold diacritics, choices keep the exact form: use the
    // type being saved, or the task's current one when it is unchanged
    updateData.answer_hash = await hashAnswer(correct_answer, parsed.data.type ?? owned.type)
    updateData.needs_answer = false
  }
  // A DI verdict is about the answer it checked: a new answer, or the
  // facilitator's review, ends it. Its notes may quote an answer and are
  // readable while the activity runs, so they go too.
  if (correct_answer || mark_reviewed) {
    updateData.verification_verdict = null
    updateData.verification_issues = []
    updateData.verification_confidence = null
  }

  let { data, error } = await supabase
    .from("challenges")
    .update(updateData)
    .eq("id", params.challengeId)
    .select(SAFE_CHALLENGE_COLUMNS)
    .single()

  // A database without 20261107100000: extra answers the facilitator gave
  // are never dropped silently; clearing them has nothing to clear.
  // (PostgREST answers PGRST204 for a written column it does not know.)
  if ((error?.code === "PGRST204" || error?.code === "42703") && updateData.accepted_answer_hashes !== undefined) {
    if (updateData.accepted_answer_hashes.length > 0) {
      return NextResponse.json(
        { error: "Kitų priimamų atsakymų dar negalima išsaugoti. Pašalinkite juos arba bandykite vėliau." },
        { status: 503 }
      )
    }
    delete updateData.accepted_answer_hashes
    ;({ data, error } = await supabase
      .from("challenges")
      .update(updateData)
      .eq("id", params.challengeId)
      .select(SAFE_CHALLENGE_COLUMNS)
      .single())
  }

  // needs_answer column may not exist on unmigrated DBs — retry without it
  if (error && (error.message?.includes("column") || error.code === "42703")) {
    delete updateData.needs_answer
    ;({ data, error } = await supabase
      .from("challenges")
      .update(updateData)
      .eq("id", params.challengeId)
      .select(LEGACY_CHALLENGE_COLUMNS)
      .single())
  }

  if (error) {
    console.error("Challenge UPDATE error:", error)
    return NextResponse.json({ error: "Nepavyko atnaujinti užduoties." }, { status: 500 })
  }

  // Answers already given are never checked again and points are not
  // recalculated (audit R-13): when the activity runs and this save changed
  // how the task is scored, the facilitator is told so, if the task has
  // answers. An unreadable count warns too.
  if (
    isLiveStatus(owned.gameStatus) &&
    changesScoring(parsed.data, { type: owned.type, points: owned.points, hint_penalty: owned.hintPenalty })
  ) {
    const { count, error: countError } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", params.challengeId)
    if (countError || (count ?? 0) > 0) {
      return NextResponse.json({ ...(data as unknown as Record<string, unknown>), live_scoring_notice: LIVE_SCORING_NOTICE })
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, props: { params: Promise<{ challengeId: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizuota" }, { status: 401 })
  }

  // Verify the challenge belongs to a game owned by this teacher
  const owned = await verifyChallengeOwnership(supabase, params.challengeId, user.id)
  if (!owned) {
    return NextResponse.json(
      { error: "Užduotis nerasta arba neturite teisės" },
      { status: 404 }
    )
  }
  if (isLiveStatus(owned.gameStatus)) {
    return NextResponse.json({ error: LIVE_EDIT_BLOCKED.delete, code: "live" }, { status: 409 })
  }
  // Removing a task takes its answers with it while team points stay, so a
  // finished activity keeps every task that has answers in its report.
  if (owned.gameStatus === "finished") {
    const { count, error: countError } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", params.challengeId)
    if (countError || (count ?? 0) > 0) {
      return NextResponse.json({ error: LIVE_EDIT_BLOCKED.finishedWithAnswers, code: "has_results" }, { status: 409 })
    }
  }

  const { error } = await supabase
    .from("challenges")
    .delete()
    .eq("id", params.challengeId)

  if (error) {
    // The database refuses it too when the activity started meanwhile
    // (challenges_live_rules, 20261106150000).
    if (error.code === "KS409") {
      return NextResponse.json({ error: LIVE_EDIT_BLOCKED.delete, code: "live" }, { status: 409 })
    }
    console.error("Challenge DELETE error:", error)
    return NextResponse.json({ error: "Nepavyko ištrinti užduoties." }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
