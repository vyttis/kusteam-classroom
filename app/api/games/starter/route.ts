import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { generateGameCode } from "@/lib/game/code-generator"
import { findStarterActivity } from "@/lib/content/starter-activities"
import {
  starterChallengeRows,
  starterCreatedResponse,
  starterGameFields,
} from "@/lib/starter-catalogue/rows"
import { badRequest, notFound, serverError, unauthorized } from "@/lib/api/responses"

const bodySchema = z.object({
  slug: z
    .string()
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
})

// POST /api/games/starter { slug }: the facilitator's own editable draft of
// a ready-made activity. Answers are hashed here and never sent back.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return unauthorized()
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest("Netinkamas užklausos formatas")
    }

    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Nenurodyta, kurią paruoštą veiklą naudoti.")
    }

    const activity = findStarterActivity(parsed.data.slug)
    if (!activity) {
      return notFound("Tokios paruoštos veiklos nėra.")
    }

    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({
        teacher_id: user.id,
        ...starterGameFields(activity),
        game_code: generateGameCode(),
        status: "draft",
      })
      .select("id, game_code")
      .single()

    if (gameError || !game) {
      console.error("Starter activity INSERT error:", gameError)
      return serverError("Nepavyko sukurti veiklos. Bandykite dar kartą.")
    }

    // Never leave an activity without its tasks behind.
    const rollBack = () => supabase.from("games").delete().eq("id", game.id)

    let rows
    try {
      rows = await starterChallengeRows(activity, game.id)
    } catch (error) {
      console.error("Starter activity mapping error:", error)
      await rollBack()
      return serverError("Nepavyko paruošti užduočių. Bandykite dar kartą.")
    }

    const { error: challengeError } = await supabase
      .from("challenges")
      .insert(rows, { defaultToNull: false })

    if (challengeError) {
      console.error("Starter tasks INSERT error:", challengeError)
      await rollBack()
      return serverError("Nepavyko sukurti užduočių, todėl veikla nesukurta. Bandykite dar kartą.")
    }

    return NextResponse.json(starterCreatedResponse(game, activity.slug), { status: 201 })
  } catch (error: unknown) {
    console.error("Starter activity error:", error)
    return serverError()
  }
}
