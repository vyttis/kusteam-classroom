import { hashAnswer } from "@/lib/game/answer-hasher"
import { prepareAcceptedAnswers } from "@/lib/game/accepted-answers"
import type { StarterActivity } from "@/lib/content/starter-activities/schema"
import type { GameSettings } from "@/types/game"

/** The draft activity a facilitator gets from a ready-made one. */
export function starterGameFields(activity: StarterActivity): {
  title: string
  description: string
  settings: GameSettings
} {
  return {
    title: activity.title,
    // Participants see the description when they join, so it carries no
    // notes for the facilitator.
    description: activity.description,
    settings: {
      max_teams: 50,
      time_limit_minutes: activity.duration_minutes,
      show_leaderboard: true,
      shuffle_challenges: false,
    },
  }
}

export interface StarterChallengeRow {
  game_id: string
  title: string
  description: string
  type: "text" | "number" | "multiple_choice"
  points: number
  answer_hash: string
  accepted_answer_hashes: string[]
  hints: string[]
  options: string[] | null
  order_index: number
  explanation: string
  difficulty: "easy" | "medium" | "hard"
  generated_by_di: false
  needs_answer: false
}

/**
 * Task rows in catalogue order. Answers are hashed here, on the server, the
 * way the task routes store them; every row has the same keys so a bulk
 * insert never turns a missing one into NULL.
 */
export async function starterChallengeRows(
  activity: StarterActivity,
  gameId: string,
): Promise<StarterChallengeRow[]> {
  return Promise.all(
    activity.challenges.map(async (c, index) => {
      const accepted = await prepareAcceptedAnswers(c.accepted_answers, c.type, c.correct_answer)
      if (!accepted.ok) {
        throw new Error(`Starter activity ${activity.slug}, task ${index + 1}: ${accepted.error}`)
      }
      return {
        game_id: gameId,
        title: c.title,
        description: c.description,
        type: c.type,
        points: c.points,
        answer_hash: await hashAnswer(c.correct_answer, c.type),
        accepted_answer_hashes: accepted.hashes,
        hints: [...c.hints],
        options: c.options ? [...c.options] : null,
        order_index: index,
        explanation: c.explanation,
        difficulty: c.difficulty,
        generated_by_di: false as const,
        needs_answer: false as const,
      }
    }),
  )
}

/** The whole response of POST /api/games/starter: ids only. */
export function starterCreatedResponse(game: { id: string; game_code: string }, slug: string) {
  return { game_id: game.id, game_code: game.game_code, slug }
}
