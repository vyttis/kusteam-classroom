import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashAnswer } from "@/lib/game/answer-hasher"
import { isLiveStatus, LIVE_EDIT_BLOCKED } from "@/lib/game/live-edit"
import { sourceAnswers } from "@/lib/library/source-answers"
import { NextResponse } from "next/server"
import { z } from "zod"
import type { ChallengeSnapshot } from "@/types/game"

const SAFE_COLUMNS =
  "id, game_id, title, description, type, points, hints, options, order_index, image_url, maps_url, created_at, updated_at, explanation, difficulty, hint_penalty, needs_answer"

const copySchema = z.object({
  game_id: z.string().uuid(),
  index: z.number().int().min(0).max(500),
})

// POST /api/library/[itemId]/tasks — copy one task of an approved library
// item into the caller's activity, with its picture and, when the task can
// be matched in the published activity, its answer and explanation.
export async function POST(request: Request, props: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neprisijungęs" }, { status: 401 })

  const parsed = copySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Neteisingi duomenys" }, { status: 400 })

  const { data: item } = await supabase
    .from("library_items")
    .select("id, source_game_id, published_by, challenge_data")
    .eq("id", itemId)
    .eq("status", "approved")
    .maybeSingle()
  const snapshot = ((item?.challenge_data as ChallengeSnapshot[] | null) ?? [])[parsed.data.index]
  if (!item || !snapshot) return NextResponse.json({ error: "Užduotis nerasta" }, { status: 404 })

  const { data: game } = await supabase
    .from("games")
    .select("id, status")
    .eq("id", parsed.data.game_id)
    .eq("teacher_id", user.id)
    .maybeSingle()
  if (!game) return NextResponse.json({ error: "Veikla nerasta" }, { status: 404 })

  const [source] = await sourceAnswers(createAdminClient(), item.source_game_id, item.published_by, [snapshot])
  // Participants would see a task nobody can solve.
  if (!source && isLiveStatus(game.status)) {
    return NextResponse.json({ error: LIVE_EDIT_BLOCKED.needsAnswer, code: "live" }, { status: 409 })
  }

  const { data: maxRow } = await supabase
    .from("challenges")
    .select("order_index")
    .eq("game_id", game.id)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle()
  const type = snapshot.type || "text"

  const { data: created, error } = await supabase
    .from("challenges")
    .insert({
      game_id: game.id,
      title: snapshot.title,
      description: snapshot.description || "",
      type,
      points: snapshot.points || 100,
      answer_hash: source ? source.answer_hash : await hashAnswer(crypto.randomUUID(), type),
      hints: snapshot.hints || [],
      options: snapshot.options || null,
      order_index: maxRow ? (maxRow.order_index as number) + 1 : 0,
      image_url: snapshot.image_url || null,
      maps_url: snapshot.maps_url || null,
      explanation: source?.explanation ?? null,
      difficulty: source?.difficulty ?? null,
      ...(source?.hint_penalty != null ? { hint_penalty: source.hint_penalty } : {}),
      needs_answer: !source,
      ...(source?.accepted_answer_hashes?.length ? { accepted_answer_hashes: source.accepted_answer_hashes } : {}),
    })
    .select(SAFE_COLUMNS)
    .single()

  if (error || !created) {
    if (error?.code === "KS409") {
      return NextResponse.json({ error: LIVE_EDIT_BLOCKED.needsAnswer, code: "live" }, { status: 409 })
    }
    console.error("library task copy error:", error?.message)
    return NextResponse.json({ error: "Nepavyko pridėti užduoties" }, { status: 500 })
  }
  return NextResponse.json({ ...created, has_answer: Boolean(source) }, { status: 201 })
}
