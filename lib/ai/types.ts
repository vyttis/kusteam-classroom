import { ChallengeType } from "@/types/game"

// Verification types
export type VerificationVerdict = "pass" | "fail" | "uncertain"

export interface VerificationResult {
  verdict: VerificationVerdict
  issues: string[]
  confidence: number
}

export interface AiSuggestion {
  title: string
  description: string
  type: ChallengeType
  points: number
  correct_answer: string
  /** Other spellings of a text answer the DI proposes; the facilitator confirms them. */
  accepted_answers?: string[]
  hints: string[]
  options: string[] | null
  explanation?: string
  difficulty?: "easy" | "medium" | "hard"
  verification?: VerificationResult
}

export interface AiSuggestRequest {
  game_id: string
  game_title: string
  game_description: string | null
  existing_challenges: {
    title: string
    description: string | null
    type: ChallengeType
    points: number
  }[]
  teacher_prompt?: string
  count?: number
}

export interface AiSuggestResponse {
  suggestions: AiSuggestion[]
}

// Game creation DI types
export interface AiGameIdea {
  title: string
  description: string
  theme: string
}

export interface AiGameSuggestRequest {
  teacher_prompt?: string
  theme?: string
  count?: number
}

export interface AiGameSuggestResponse {
  ideas: AiGameIdea[]
}

// DI pipeline types
export type ScenarioPreset = "quick_check" | "investigation" | "escape_room" | "discussion"

export interface DiGenerateRequest {
  game_id: string
  game_title: string
  game_description: string | null
  existing_challenges: {
    title: string
    description: string | null
    type: ChallengeType
    points: number
  }[]
  teacher_prompt?: string
  count?: number
  scenario?: ScenarioPreset
}

export interface DiGenerateResponse {
  suggestions: AiSuggestion[]
}
