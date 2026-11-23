/**
 * Small pure helpers of the participant screens: places on the board and
 * the state of each task in the progress bar. No React, no requests.
 */

/**
 * The place of each team, in the order given. Teams with the same points
 * share a place and the next one is skipped (1, 1, 3). A team without
 * points has no place yet (null): nobody is "first" before anyone scored.
 */
export function sharedRanks(teams: readonly { total_points: number }[]): (number | null)[] {
  return teams.map((team) =>
    team.total_points > 0 ? 1 + teams.filter((other) => other.total_points > team.total_points).length : null,
  )
}

/** A team's place and the number of teams, or null when it is not on the board. */
export function teamPlace(
  teams: readonly { id: string; total_points: number }[],
  teamId: string | null | undefined,
): { rank: number | null; of: number } | null {
  const index = teams.findIndex((team) => team.id === teamId)
  if (index < 0) return null
  return { rank: sharedRanks(teams)[index], of: teams.length }
}

export type TaskSegment = "solved" | "current" | "todo"

/**
 * One segment per task for the progress bar. A solved task stays "solved"
 * even while it is the open one (its result is on screen).
 */
export function taskSegments(
  taskIds: readonly string[],
  solvedIds: ReadonlySet<string>,
  currentId?: string | null,
): TaskSegment[] {
  return taskIds.map((id) => (solvedIds.has(id) ? "solved" : id === currentId ? "current" : "todo"))
}
