import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"
import { computeDetailedStats } from "@/lib/game/detailed-stats"
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/responses"

// "answers=0" leaves the answer texts out: the summary on the activity page
// refreshes while the activity runs and never shows what participants typed.
const querySchema = z.object({ answers: z.enum(["0", "1"]).optional() })

// GET /api/games/[gameId]/analytics/detailed — per-challenge + per-team detailed stats
export async function GET(request: Request, props: { params: Promise<{ gameId: string }> }) {
  const params = await props.params;
  try {
    const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!query.success) {
      return NextResponse.json({ error: "Netinkama užklausa" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return unauthorized()
    }

    // Verify game access
    const { data: game } = await supabase
      .from("games")
      .select("id, teacher_id, status, title")
      .eq("id", params.gameId)
      .maybeSingle()

    if (!game) {
      return notFound("Veikla nerasta")
    }

    const isOwner = game.teacher_id === user.id
    if (!isOwner) {
      const { data: roleData } = await supabase.rpc("get_my_role")
      if (!roleData || !["admin", "super_admin"].includes(roleData as string)) {
        return forbidden("Neturite prieigos")
      }
    }

    // What participants typed is shown to the owner of the activity only
    // (an administrator sees the numbers). submissions.answer is not granted
    // to any browser role, so it is read with the service role, after the
    // ownership check above (made under the user's own RLS) and only for
    // this activity's tasks. Without the service key the page still works,
    // without the answer texts.
    let answerReader: ReturnType<typeof createAdminClient> | undefined
    if (isOwner && query.data.answers !== "0") {
      try {
        answerReader = createAdminClient()
      } catch {
        answerReader = undefined
      }
    }

    const stats = await computeDetailedStats(supabase, params.gameId, { answerReader })
    return NextResponse.json(
      { ...stats, game_status: game.status, game_title: game.title },
      { headers: { "Cache-Control": "private, no-store" } }
    )
  } catch (error: unknown) {
    return serverError(
      error instanceof Error ? error.message : "Serverio klaida"
    )
  }
}
