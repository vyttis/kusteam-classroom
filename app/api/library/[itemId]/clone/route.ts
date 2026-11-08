import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sourceAnswers } from "@/lib/library/source-answers"
import { generateGameCode } from "@/lib/game/code-generator"
import { hashAnswer } from "@/lib/game/answer-hasher"
import { NextResponse } from "next/server"
import type { ChallengeSnapshot } from "@/types/game"

// POST /api/library/[itemId]/clone — clone library item into a new game
export async function POST(_request: Request, props: { params: Promise<{ itemId: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Neprisijungęs" }, { status: 401 })
    }

    // Get library item
    const { data: item, error: itemError } = await supabase
      .from("library_items")
      .select("*")
      .eq("id", params.itemId)
      .eq("status", "approved")
      .single()

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Šablonas nerastas arba nepatvirtintas" },
        { status: 404 }
      )
    }

    // Create new game
    const gameCode = generateGameCode()
    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({
        teacher_id: user.id,
        title: `${item.title} (kopija)`,
        description: item.description,
        game_code: gameCode,
        status: "draft",
        settings: item.settings || {
          max_teams: 50,
          time_limit_minutes: null,
          show_leaderboard: true,
          shuffle_challenges: false,
        },
      })
      .select()
      .single()

    if (gameError || !game) {
      return NextResponse.json(
        { error: gameError?.message || "Nepavyko sukurti veiklos" },
        { status: 500 }
      )
    }

    // Create challenges from snapshot
    const challengeData = (item.challenge_data as ChallengeSnapshot[] | null) ?? []
    let needsAnswers = 0
    if (challengeData.length > 0) {
      // Snapshots never carry answers. The answer hash (and explanation) is
      // copied on the server from the activity the item was published from;
      // a task that cannot be matched there gets a random unguessable hash
      // and needs_answer, which blocks activation until an answer is set.
      const sources = await sourceAnswers(createAdminClient(), item.source_game_id, challengeData)
      needsAnswers = sources.filter((s) => !s).length
      const buildChallenges = async (withNeedsAnswer: boolean) =>
        Promise.all(
          challengeData.map(async (c: ChallengeSnapshot, i: number) => {
            const source = sources[i]
            return {
              game_id: game.id,
              title: c.title,
              description: c.description || "",
              type: c.type || "text",
              points: c.points || 100,
              answer_hash: source ? source.answer_hash : await hashAnswer(crypto.randomUUID(), c.type || "text"),
              hints: c.hints || [],
              options: c.options || null,
              order_index: c.order_index || 0,
              image_url: c.image_url || null,
              maps_url: c.maps_url || null,
              ...(source
                ? {
                    explanation: source.explanation,
                    difficulty: source.difficulty,
                    ...(source.hint_penalty != null ? { hint_penalty: source.hint_penalty } : {}),
                  }
                : {}),
              ...(withNeedsAnswer ? { needs_answer: !source } : {}),
              ...(source?.accepted_answer_hashes?.length
                ? { accepted_answer_hashes: source.accepted_answer_hashes }
                : {}),
            }
          })
        )

      let { error: challengeError } = await supabase
        .from("challenges")
        // Missing keys take the column default, not NULL (see duplicate).
        .insert(await buildChallenges(true), { defaultToNull: false })

      // needs_answer column may not exist on unmigrated DBs — retry without it
      if (
        challengeError &&
        (challengeError.message?.includes("column") || challengeError.code === "42703")
      ) {
        ;({ error: challengeError } = await supabase
          .from("challenges")
          .insert(await buildChallenges(false), { defaultToNull: false }))
      }

      if (challengeError) {
        // Game was created but challenges failed — still return the game
        console.error("Challenge clone error:", challengeError)
      }
    }

    // Count the copy (best effort). A facilitator may not update someone
    // else's approved template (RLS), so the server counts it.
    const { error: countError } = await createAdminClient()
      .from("library_items")
      .update({ clone_count: (item.clone_count || 0) + 1 })
      .eq("id", params.itemId)
    if (countError) console.error("Library clone count failed", { code: countError.code })

    return NextResponse.json(
      { game_id: game.id, game_code: game.game_code, needs_answers: needsAnswers },
      { status: 201 }
    )
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vidinė klaida" }, { status: 500 })
  }
}
