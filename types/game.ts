export type GameStatus = "draft" | "active" | "paused" | "finished"

export type ChallengeType = "text" | "number" | "multiple_choice"

export interface GameSettings {
  max_teams: number
  time_limit_minutes: number | null
  show_leaderboard: boolean
  shuffle_challenges: boolean
  challenge_path_mode?: "linear" | "free"
  /** Participants may ask for a facilitator account (activities for teachers). */
  allow_access_requests?: boolean
  /** The facilitator closed joining: no new teams (teams in keep playing). */
  joining_closed?: boolean
}

export interface GameWithChallengeCount {
  id: string
  teacher_id: string
  title: string
  description: string | null
  game_code: string
  status: GameStatus
  settings: GameSettings
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
  challenges: { count: number }[]
}

export interface Challenge {
  id: string
  game_id: string
  title: string
  description: string | null
  type: ChallengeType
  points: number
  // Server-only field — never selected by client/teacher pages. Optional so a
  // Challenge fetched without answer_hash still typechecks.
  answer_hash?: string
  hints: string[]
  options: string[] | null
  image_url: string | null
  maps_url: string | null
  order_index: number
  explanation: string | null
  difficulty: "easy" | "medium" | "hard" | null
  hint_penalty: number
  generated_by_di: boolean
  verification_verdict: "pass" | "fail" | "uncertain" | null
  verification_issues: string[]
  verification_confidence: number | null
  prerequisites: string[]
  // True when the challenge was duplicated/cloned and the teacher has not yet
  // set a real answer. Blocks game activation.
  needs_answer?: boolean
  // How many extra accepted answers the task has; the answers stay hidden.
  accepted_answer_count?: number
  created_at: string
  updated_at: string
}

export interface PlayerSession {
  team_id: string
  session_token: string
  game_code: string
  team_name: string
  created_at?: number // Unix timestamp for session expiry
}

export interface LeaderboardEntry {
  id: string
  name: string
  total_points: number
  current_challenge_index: number
  joined_at: string
  updated_at: string
  // Correct submissions embedded by leaderboard queries (one row per solved
  // challenge). current_challenge_index only advances in linear path mode,
  // so solved counts must be derived from these.
  submissions?: { challenge_id: string }[]
}

export interface SubmissionResult {
  is_correct: boolean
  points_awarded: number
  message: string
  total_points?: number
}

// ============================================
// Sprint 2: RBAC, Library, Analytics
// ============================================

// 'staff': KU STEAM TEAM staff member inside CLASSROOM (lib/auth/roles.ts).
export type UserRole = "teacher" | "admin" | "super_admin" | "staff"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  school: string | null
  phone: string | null
  role: UserRole
  avatar_url: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
  /** Closed sign-up: only active accounts may facilitate. */
  status?: AccountStatus
  first_name?: string | null
  last_name?: string | null
  school_code?: string | null
  municipality?: string | null
  school_type?: string | null
  subjects?: string[]
  grades?: string[]
  approved_at?: string | null
  ai_monthly_limit?: number | null
}

export type AccountStatus = "pending" | "active" | "blocked"

export type LibraryItemStatus = "pending_review" | "approved" | "rejected"

export interface LibraryItem {
  id: string
  source_game_id: string | null
  title: string
  description: string | null
  subject: string | null
  grade_level: string | null
  tags: string[]
  challenge_data: ChallengeSnapshot[]
  settings: GameSettings | null
  status: LibraryItemStatus
  published_by: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  clone_count: number
  created_at: string
  updated_at: string
  // joined fields
  publisher_name?: string
  publisher_email?: string
  challenge_count?: number
}

export interface ChallengeSnapshot {
  title: string
  description: string
  type: ChallengeType
  points: number
  hints: string[]
  options: string[] | null
  image_url: string | null
  maps_url: string | null
  order_index: number
}

// Achievement badges
export type AchievementType = "first_solver" | "speed_demon" | "hint_free" | "perfect_game" | "streak"

export interface Achievement {
  id: string
  game_id: string
  team_id: string
  type: AchievementType
  challenge_id: string | null
  metadata: Record<string, unknown>
  earned_at: string
}

export interface PlatformStats {
  total_games: number
  active_games: number
  total_teachers: number
  total_admins: number
  total_users: number
  total_teams: number
  total_submissions: number
  correct_submissions: number
  library_items_approved: number
  library_items_pending: number
}

export interface GameStats {
  total_teams: number
  total_submissions: number
  correct_submissions: number
  avg_completion_time_seconds: number | null
  challenge_stats: ChallengeStatItem[]
}

export interface ChallengeStatItem {
  challenge_id: string
  title: string
  order_index: number
  points: number
  attempts: number
  solves: number
  avg_attempts_to_solve: number
  difficulty?: "easy" | "medium" | "hard" | null
}
