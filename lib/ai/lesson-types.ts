import { ChallengeType } from "@/types/game"

export type Competency =
  | "komunikavimo"
  | "pazinimo"
  | "kulturine"
  | "kurybiskumo"
  | "pilietiskumo"
  | "skaitmenine"
  | "socialine_emocine_ir_sveikos_gyvensenos"

export type BloomLevel =
  | "zinios"
  | "supratimas"
  | "taikymas"
  | "analize"
  | "sinteze"
  | "vertinimas"

export const COMPETENCY_LABELS: Record<Competency, string> = {
  komunikavimo: "Komunikavimo",
  pazinimo: "Pažinimo",
  kulturine: "Kultūrinė",
  kurybiskumo: "Kūrybiškumo",
  pilietiskumo: "Pilietiškumo",
  skaitmenine: "Skaitmeninė",
  socialine_emocine_ir_sveikos_gyvensenos: "Socialinė, emocinė ir sveikos gyvensenos",
}

export const BLOOM_LABELS: Record<BloomLevel, string> = {
  zinios: "Žinios",
  supratimas: "Supratimas",
  taikymas: "Taikymas",
  analize: "Analizė",
  sinteze: "Sintezė",
  vertinimas: "Vertinimas",
}

export interface LessonGenerateRequest {
  game_id: string
  subject: string
  grade: number
  topic: string
  lesson_type: string
  duration: number
  learning_goal?: string
  curriculum_context?: string
  existing_challenges: {
    title: string
    type: string
    points: number
  }[]
}

export interface LessonActivity {
  activity_type: "intro" | "challenge" | "discussion" | "reflection"
  title: string
  description: string
  type: ChallengeType
  correct_answer: string
  options: string[] | null
  hints: string[]
  explanation: string
  points: number
  duration_minutes: number
  difficulty: "easy" | "medium" | "hard"
  competencies?: Competency[]
  bloom_level?: BloomLevel
}

export interface GeneratedLesson {
  title: string
  goal: string
  curriculum_link: string
  activities: LessonActivity[]
  reflection_question: string
  teacher_note: string
  competencies?: Competency[]
}

export interface LessonGenerateResponse {
  lesson: GeneratedLesson
}
