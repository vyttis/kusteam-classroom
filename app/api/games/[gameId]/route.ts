import { createClient } from "@/lib/supabase/server"
import { rpcRow } from "@/lib/supabase/rpc-row"
import { NextResponse } from "next/server"
import { z } from "zod"
import { AI_REVIEW_REQUIRED_MESSAGE, aiTasksToReview, type AiReviewCandidate } from "@/lib/game/ai-review"

// Safe columns to return for challenges (never include answer_hash)
const SAFE_CHALLENGE_SELECT = "id, game_id, title, description, type, points, hints, options, order_index, image_url, maps_url, created_at, updated_at"

// The database refuses writes from an account that is pending or blocked.
const INACTIVE_ACCOUNT = "Paskyra neaktyvi, todėl veiklos keisti negalima."

const updateGameSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "paused", "finished"]).optional(),
  // Sent with the start (draft -> active): the facilitator confirmed in the
  // start dialog that the DI-made tasks' answers were reviewed.
  ai_reviewed: z.boolean().optional(),
  settings: z
    .object({
      max_teams: z.number().min(2).max(100).optional(),
      time_limit_minutes: z.number().int().min(1).max(1440).nullable().optional(),
      show_leaderboard: z.boolean().optional(),
      shuffle_challenges: z.boolean().optional(),
      challenge_path_mode: z.enum(["linear", "free"]).optional(),
      allow_access_requests: z.boolean().optional(),
      joining_closed: z.boolean().optional(),
    })
    .optional(),
})

export async function GET(_request: Request, props: { params: Promise<{ gameId: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizuota" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("games")
    .select(`*, challenges(${SAFE_CHALLENGE_SELECT})`)
    .eq("id", params.gameId)
    .eq("teacher_id", user.id)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: "Veikla nerasta" },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request, props: { params: Promise<{ gameId: string }> }) {
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

  const parsed = updateGameSchema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Neteisingi duomenys"
    return NextResponse.json(
      { error: firstError },
      { status: 400 }
    )
  }

  const { data: current } = await supabase
    .from("games")
    .select("status")
    .eq("id", params.gameId)
    .eq("teacher_id", user.id)
    .maybeSingle()
  if (!current) {
    return NextResponse.json({ error: "Veikla nerasta" }, { status: 404 })
  }
  // Readiness is checked when the activity starts, not when it resumes: a
  // task added during a pause must not leave the activity stuck paused.
  if (parsed.data.status === "active" && current.status === "draft") {
    const { count } = await supabase
      .from("challenges")
      .select("id", { count: "exact", head: true })
      .eq("game_id", params.gameId)

    if (!count || count === 0) {
      return NextResponse.json(
        { error: "Veikla turi turėti bent 1 užduotį" },
        { status: 400 }
      )
    }

    // Block activation while duplicated/cloned challenges lack a real answer.
    // Tolerate a missing needs_answer column (unmigrated DB) by skipping.
    const { data: pendingTasks, error: pendingError } = await supabase
      .from("challenges")
      .select("id, title")
      .eq("game_id", params.gameId)
      .eq("needs_answer", true)
      .order("order_index", { ascending: true })

    if (!pendingError && pendingTasks && pendingTasks.length > 0) {
      const titles = pendingTasks.map((t) => `„${t.title}“`).join(", ")
      return NextResponse.json(
        {
          error: `Šios užduotys neturi nustatyto atsakymo: ${titles}. Nustatykite atsakymus prieš pradėdami veiklą.`,
          tasks_needing_answer: pendingTasks,
        },
        { status: 400 }
      )
    }

    // DI only suggests: the facilitator confirms every answer. DI-made tasks
    // nobody has confirmed start only with an explicit acknowledgement from
    // the start dialog. A database without the DI columns has no such tasks.
    if (parsed.data.ai_reviewed !== true) {
      const { data: aiTasks, error: aiError } = await supabase
        .from("challenges")
        .select("id, title, generated_by_di, verification_verdict, needs_answer, created_at, updated_at, order_index")
        .eq("game_id", params.gameId)
        .eq("generated_by_di", true)

      const unreviewed = aiError ? [] : aiTasksToReview((aiTasks ?? []) as AiReviewCandidate[])
      if (unreviewed.length > 0) {
        return NextResponse.json(
          { error: AI_REVIEW_REQUIRED_MESSAGE, code: "ai_review_required", ai_tasks_to_review: unreviewed },
          { status: 400 }
        )
      }
    }
  }

  const details: Record<string, unknown> = {}
  if (parsed.data.title !== undefined) details.title = parsed.data.title
  if (parsed.data.description !== undefined) details.description = parsed.data.description
  const hasDetails = Object.keys(details).length > 0
  const hasStatus = parsed.data.status !== undefined

  if (!hasDetails && !parsed.data.settings && !hasStatus) {
    return NextResponse.json({ error: "Nėra ką atnaujinti" }, { status: 400 })
  }
  // A status change is its own request, so it is never half applied
  // together with other fields.
  if (hasStatus && (hasDetails || parsed.data.settings)) {
    return NextResponse.json({ error: "Būsena keičiama atskirai nuo kitų laukų." }, { status: 400 })
  }

  let data: unknown = null

  // Settings merge in the database in one statement, with the title and
  // description of the same save, so a save from an older tab cannot undo an
  // extension made meanwhile and nothing is half saved; while the activity
  // runs, the time limit changes only through "Pratęsti" (/extend).
  if (parsed.data.settings) {
    const { data: updated, error } = await supabase.rpc("update_game_settings", {
      p_game_id: params.gameId,
      p_patch: parsed.data.settings,
      p_details: details,
    })
    if (error) {
      if (error.code === "P0002") return NextResponse.json({ error: "Veikla nerasta" }, { status: 404 })
      if (error.code === "42501") return NextResponse.json({ error: INACTIVE_ACCOUNT }, { status: 403 })
      return NextResponse.json({ error: "Nepavyko išsaugoti nustatymų." }, { status: 500 })
    }
    data = rpcRow(updated)
  } else if (hasDetails) {
    const { data: updated, error } = await supabase
      .from("games")
      .update(details)
      .eq("id", params.gameId)
      .eq("teacher_id", user.id)
      .select()
      .single()
    if (error) {
      // No row came back although the owner check passed: row security
      // refused the change for an account that is no longer active.
      if (error.code === "PGRST116") return NextResponse.json({ error: INACTIVE_ACCOUNT }, { status: 403 })
      return NextResponse.json({ error: "Nepavyko išsaugoti veiklos." }, { status: 500 })
    }
    data = updated
  }

  // Status moves only forward (draft -> active <-> paused -> finished); the
  // database function also keeps the pause time and the class start.
  if (parsed.data.status !== undefined) {
    const { data: updated, error } = await supabase.rpc("set_game_status", {
      p_game_id: params.gameId,
      p_status: parsed.data.status,
    })
    if (error) {
      if (error.code === "KS409") {
        return NextResponse.json(
          {
            error:
              current.status === "finished"
                ? "Veikla jau baigta, jos atnaujinti negalima."
                : "Šios būsenos pakeisti negalima. Atnaujinkite puslapį.",
            code: "status_conflict",
          },
          { status: 409 }
        )
      }
      if (error.code === "P0002") {
        return NextResponse.json({ error: "Veikla nerasta" }, { status: 404 })
      }
      if (error.code === "42501") return NextResponse.json({ error: INACTIVE_ACCOUNT }, { status: 403 })
      // The last task was removed while the start was checked.
      if (error.code === "KS427") {
        return NextResponse.json({ error: "Veikla turi turėti bent 1 užduotį" }, { status: 400 })
      }
      // A task without an answer was added while the start was checked.
      if (error.code === "KS428") {
        return NextResponse.json(
          { error: "Kai kurios užduotys neturi nustatyto atsakymo. Nustatykite atsakymus prieš pradėdami veiklą." },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: "Nepavyko pakeisti būsenos." }, { status: 500 })
    }
    data = rpcRow(updated)
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, props: { params: Promise<{ gameId: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizuota" }, { status: 401 })
  }

  const { error } = await supabase
    .from("games")
    .delete()
    .eq("id", params.gameId)
    .eq("teacher_id", user.id)

  if (error) {
    console.error("[games] delete failed", { code: error.code })
    return NextResponse.json({ error: "Nepavyko ištrinti veiklos. Bandykite dar kartą." }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
