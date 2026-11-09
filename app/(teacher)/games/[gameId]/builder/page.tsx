import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { GameStatus, GameSettings, Challenge } from "@/types/game"
import { GameBuilder } from "@/components/teacher/game-builder/game-builder"

export const metadata: Metadata = { title: "Veiklos redaktorius" }

export default async function BuilderPage(
  props: {
    params: Promise<{ gameId: string }>
    searchParams: Promise<{ task?: string | string[] }>
  }
) {
  const params = await props.params;
  // ?task=<id>: open that task in the editor (links from the activity page).
  const { task } = await props.searchParams
  const initialTaskId = typeof task === "string" ? task : null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // answer_hash intentionally excluded from select — teacher UI never needs it
  const CHALLENGE_FIELDS =
    "id, game_id, title, description, type, points, hints, options, order_index, image_url, maps_url, explanation, difficulty, hint_penalty, generated_by_di, verification_verdict, verification_issues, verification_confidence, prerequisites, needs_answer, created_at, updated_at"

  // With how many extra accepted answers each task has (20261107100000);
  // a database without that column is read as before.
  const readGame = (withCount: boolean) =>
    supabase
      .from("games")
      .select(
        `*, challenges(${withCount ? `${CHALLENGE_FIELDS}, accepted_answer_count` : CHALLENGE_FIELDS})` as `*, challenges(${typeof CHALLENGE_FIELDS})`
      )
      .eq("id", params.gameId)
      .eq("teacher_id", user!.id)
      .single()
  const withCount = await readGame(true)
  const game = withCount.error?.code === "42703" ? (await readGame(false)).data : withCount.data

  if (!game) {
    notFound()
  }

  const challenges = (game.challenges || []) as Challenge[]
  const sortedChallenges = [...challenges].sort(
    (a, b) => a.order_index - b.order_index
  )
  const settings = (game.settings as GameSettings | null) || {
    max_teams: 50,
    time_limit_minutes: null,
    show_leaderboard: true,
    shuffle_challenges: false,
  }

  return (
    <GameBuilder
      initialGame={{
        id: game.id,
        title: game.title,
        description: game.description,
        status: game.status as GameStatus,
        settings,
        game_code: game.game_code,
      }}
      initialChallenges={sortedChallenges}
      initialTaskId={initialTaskId}
    />
  )
}
