import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateGameCode } from "@/lib/game/code-generator"
import { NextResponse } from "next/server"
import { z } from "zod"

function acceptedHashes(task: object): string[] {
  const hashes = (task as { accepted_answer_hashes?: unknown }).accepted_answer_hashes
  return Array.isArray(hashes) ? hashes.filter((h): h is string => typeof h === "string") : []
}

// What the facilitator reads when the copy is only partly made. Database
// messages never go to the browser: they are logged with their code only.
const PARTIAL_NO_TASKS =
  "Veiklos kopija sukurta, bet užduočių nukopijuoti nepavyko, todėl kopijoje jų nėra. Ištrinkite kopiją ir kopijuokite dar kartą arba pridėkite užduotis patys."
const PARTIAL_NO_PREREQUISITES =
  "Veikla nukopijuota, bet kai kurių užduočių atrakinimo sąlygų perkelti nepavyko. Patikrinkite jas kopijoje prieš vesdami veiklą."

const duplicateSchema = z.object({
  title: z.string().min(3, "Pavadinimas turi būti bent 3 simbolių").optional(),
})

// POST /api/games/[gameId]/duplicate — duplicate a game with all challenges
export async function POST(request: Request, props: { params: Promise<{ gameId: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Neprisijungęs" },
        { status: 401 }
      )
    }

    // Parse and validate body
    let body: unknown = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is valid (title is optional)
    }
    const parsed = duplicateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Neteisingi duomenys" },
        { status: 400 }
      )
    }

    // Fetch source game (verify ownership)
    const { data: sourceGame, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", params.gameId)
      .eq("teacher_id", user.id)
      .single()

    if (gameError || !sourceGame) {
      return NextResponse.json(
        { error: "Veikla nerasta arba neturite teisės jos kopijuoti" },
        { status: 404 }
      )
    }

    // Signed-in users cannot read answer_hash (20261106120000_close_answer_and_role_gaps). Ownership is checked
    // above, so the copy reads the source tasks with the service role.
    const { data: sourceChallenges, error: challengesError } = await createAdminClient()
      .from("challenges")
      .select("*")
      .eq("game_id", sourceGame.id)
      .order("order_index", { ascending: true })

    if (challengesError) {
      console.error("[duplicate] reading source tasks failed", { code: challengesError.code })
      return NextResponse.json(
        { error: "Nepavyko nuskaityti veiklos užduočių. Bandykite dar kartą." },
        { status: 500 }
      )
    }

    // Generate new game code
    const gameCode = generateGameCode()
    const newTitle = parsed.data?.title || `${sourceGame.title} (kopija)`

    // Insert new game
    const { data: newGame, error: newGameError } = await supabase
      .from("games")
      .insert({
        teacher_id: user.id,
        title: newTitle,
        description: sourceGame.description,
        game_code: gameCode,
        status: "draft" as const,
        settings: sourceGame.settings,
      })
      .select()
      .single()

    if (newGameError || !newGame) {
      console.error("[duplicate] creating the copy failed", { code: newGameError?.code })
      return NextResponse.json(
        { error: "Nepavyko sukurti veiklos kopijos. Bandykite dar kartą." },
        { status: 500 }
      )
    }

    // Set when the copy exists but is not complete.
    let partialMessage: string | null = null

    // Bulk insert challenges, then remap prerequisite UUIDs to new IDs
    if (sourceChallenges && sourceChallenges.length > 0) {
      const challengePayloads = sourceChallenges.map((c) => ({
        game_id: newGame.id,
        title: c.title,
        description: c.description,
        type: c.type,
        points: c.points,
        answer_hash: c.answer_hash,
        hints: c.hints,
        options: c.options,
        order_index: c.order_index,
        image_url: c.image_url,
        maps_url: c.maps_url,
        explanation: c.explanation,
        difficulty: c.difficulty,
        hint_penalty: c.hint_penalty,
        generated_by_di: c.generated_by_di,
        verification_verdict: c.verification_verdict,
        verification_issues: c.verification_issues,
        verification_confidence: c.verification_confidence,
        // needs_answer MUST travel with the copy: dropping it would let a
        // duplicate of an answer-less task (dummy hash) pass the activation
        // guard and ship unsolvable tasks to a live class.
        needs_answer: c.needs_answer ?? false,
        // Extra accepted answers travel too (20261107100000); a source read
        // from a database without the column has none to copy.
        ...(acceptedHashes(c).length > 0 ? { accepted_answer_hashes: acceptedHashes(c) } : {}),
        // Insert without prerequisites first, remap after
      }))

      let { data: newChallenges, error: insertError } = await supabase
        .from("challenges")
        // Rows differ in which keys they carry (accepted_answer_hashes only
        // when a task has extra answers): without this PostgREST fills the
        // missing ones with NULL instead of the column default, and the
        // NOT NULL column rejects the whole copy (production, 2026-11-08).
        .insert(challengePayloads, { defaultToNull: false })
        .select("id, order_index")

      // Tolerate an unmigrated DB (needs_answer column missing, 42703) the
      // same way the activation guard does — retry without the column.
      if (insertError && insertError.code === "42703") {
        const legacyPayloads = challengePayloads.map((payload) => {
          const rest = { ...payload } as Record<string, unknown>
          delete rest.needs_answer
          return rest
        })
        ;({ data: newChallenges, error: insertError } = await supabase
          .from("challenges")
          .insert(legacyPayloads, { defaultToNull: false })
          .select("id, order_index"))
      }

      if (insertError) {
        console.error("[duplicate] copying tasks failed", { code: insertError.code })
        return NextResponse.json(
          { error: PARTIAL_NO_TASKS, partial: true, game_id: newGame.id, game_code: newGame.game_code },
          { status: 207 }
        )
      } else if (newChallenges) {
        // Build old ID → new ID mapping via order_index
        const newIdByIndex = new Map(newChallenges.map((c: { id: string; order_index: number }) => [c.order_index, c.id]))
        const idMap = new Map<string, string>()
        sourceChallenges.forEach((c) => {
          const newId = newIdByIndex.get(c.order_index)
          if (newId) idMap.set(c.id, newId)
        })

        // Update prerequisites with remapped IDs
        const hasPrereqs = sourceChallenges.some((c) => c.prerequisites?.length > 0)
        if (hasPrereqs) {
          const prereqResults = await Promise.all(
            sourceChallenges.map((src) => {
              if (!src.prerequisites?.length) return Promise.resolve(null)
              const newId = idMap.get(src.id)
              if (!newId) return Promise.resolve(null)
              const remapped = src.prerequisites
                .map((oldPrereqId: string) => idMap.get(oldPrereqId))
                .filter(Boolean) as string[]
              return supabase
                .from("challenges")
                .update({ prerequisites: remapped })
                .eq("id", newId)
            })
          )
          const prereqErrors = prereqResults.filter((r) => r?.error)
          if (prereqErrors.length > 0) {
            console.error("[duplicate] remapping unlock rules failed", {
              codes: prereqErrors.map((r) => r?.error?.code),
            })
            partialMessage = PARTIAL_NO_PREREQUISITES
          }
        }
      }
    }

    if (partialMessage) {
      return NextResponse.json(
        { error: partialMessage, partial: true, game_id: newGame.id, game_code: newGame.game_code },
        { status: 207 }
      )
    }

    return NextResponse.json(
      { game_id: newGame.id, game_code: newGame.game_code },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("[duplicate] unexpected failure", error instanceof Error ? error.name : "unknown")
    return NextResponse.json({ error: "Vidinė serverio klaida. Bandykite dar kartą." }, { status: 500 })
  }
}
