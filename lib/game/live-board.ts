/**
 * Pure decisions of the class screen (the projector board): places, which
 * of its two phases to show, and how urgent the countdown is. No React and
 * no data access, so they are tested directly (tests/live-board.test.ts).
 */

/**
 * Places for teams already ordered by points, highest first. A team without
 * points has no place yet (null): before the first solved task nobody is
 * first. Teams with the same points share a place, and the next place skips
 * accordingly (1, 1, 3).
 */
export function sharedRanks(teams: readonly { total_points: number }[]): (number | null)[] {
  const ranks: (number | null)[] = []
  teams.forEach((team, index) => {
    if (!(team.total_points > 0)) {
      ranks.push(null)
      return
    }
    const previous = index > 0 ? teams[index - 1] : null
    ranks.push(previous && previous.total_points === team.total_points ? ranks[index - 1] : index + 1)
  })
  return ranks
}

export type BoardPhase = "join" | "board"

/**
 * "join" while the class is still coming in: the screen is the QR code and
 * the activity code. "board" from the first solved task (or the first
 * point), and always once the activity is over.
 */
export function boardPhase({
  status,
  teams,
  solvedCounts,
}: {
  status: string
  teams: readonly { id: string; total_points: number }[]
  solvedCounts: ReadonlyMap<string, number>
}): BoardPhase {
  if (status === "finished") return "board"
  const started = teams.some((team) => team.total_points > 0 || (solvedCounts.get(team.id) ?? 0) > 0)
  return started ? "board" : "join"
}

export type CountdownUrgency = "calm" | "soon" | "last" | "over"

export const COUNTDOWN_SOON_SECONDS = 5 * 60
export const COUNTDOWN_LAST_SECONDS = 60

/** How urgent a countdown is; null (no countdown) is calm. */
export function countdownUrgency(secondsLeft: number | null): CountdownUrgency {
  if (secondsLeft === null) return "calm"
  if (secondsLeft <= 0) return "over"
  if (secondsLeft <= COUNTDOWN_LAST_SECONDS) return "last"
  if (secondsLeft <= COUNTDOWN_SOON_SECONDS) return "soon"
  return "calm"
}

/** The words shown next to the countdown, so colour is never the only sign. */
export const COUNTDOWN_NOTE: Record<CountdownUrgency, string | null> = {
  calm: null,
  soon: "Liko mažiau nei 5 min.",
  last: "Paskutinė minutė",
  over: "Laikas baigėsi",
}

/** The address a participant types: host and path, without the scheme. */
export function shortAddress(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
}
