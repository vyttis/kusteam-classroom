import type { SupabaseClient } from "@supabase/supabase-js"

/** What a library snapshot keeps of a task: enough to find where it came from. */
export interface SnapshotKey {
  title: string
  type?: string | null
  order_index?: number | null
  options?: string[] | null
}

/** A task of the activity a library item was published from, read with the service role. */
export interface SourceChallenge {
  id: string
  title: string
  type: string
  order_index: number
  options: string[] | null
  answer_hash: string
  explanation: string | null
  difficulty: string | null
  hint_penalty: number | null
  needs_answer: boolean | null
  /** Extra accepted answers (20261107100000); [] when there are none or no column. */
  accepted_answer_hashes?: string[] | null
}

const SOURCE_COLUMNS =
  "id, title, type, order_index, options, answer_hash, explanation, difficulty, hint_penalty, needs_answer"

function sameOptions(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/**
 * For each snapshot task, the source task it was published from, or null.
 *
 * Library snapshots carry no answers (every facilitator can read them), so a
 * copy takes the answer hash from the published activity on the server. A
 * task matches by title, type and position; if the source was reordered
 * since, by title and type alone when that is unambiguous. A choice task
 * matches only with the same options, because its answer is one of them.
 * A source task without a real answer, or one used by an earlier snapshot
 * task, does not match. An unmatched copy keeps needing an answer.
 */
export function matchSourceChallenges<T extends SourceChallenge>(snapshots: SnapshotKey[], sources: T[]): (T | null)[] {
  const used = new Set<string>()
  const usable = sources.filter((s) => !s.needs_answer && s.answer_hash)
  const fits = (snap: SnapshotKey, s: T) =>
    !used.has(s.id) &&
    s.title === snap.title &&
    s.type === (snap.type || "text") &&
    (s.type !== "multiple_choice" || sameOptions(s.options, snap.options))

  return snapshots.map((snap) => {
    let match = usable.find((s) => fits(snap, s) && s.order_index === (snap.order_index ?? 0)) ?? null
    if (!match) {
      const candidates = usable.filter((s) => fits(snap, s))
      match = candidates.length === 1 ? candidates[0] : null
    }
    if (match) used.add(match.id)
    return match
  })
}

/**
 * The published activity's tasks, matched to the snapshot. Missing source
 * activity or a failed read gives no matches (the copies then need answers),
 * never an error.
 *
 * Answers are read with the service role, so the source must belong to the
 * account that published the item: any active facilitator can insert a
 * library item with an arbitrary source_game_id, and without this check an
 * approved item would hand out another facilitator's answers and explanations.
 */
export async function sourceAnswers(
  admin: SupabaseClient,
  sourceGameId: string | null | undefined,
  publishedBy: string | null | undefined,
  snapshots: SnapshotKey[],
): Promise<(SourceChallenge | null)[]> {
  if (!sourceGameId || !publishedBy) return snapshots.map(() => null)
  const { data: owned, error: ownerError } = await admin
    .from("games")
    .select("id")
    .eq("id", sourceGameId)
    .eq("teacher_id", publishedBy)
    .maybeSingle()
  if (ownerError || !owned) return snapshots.map(() => null)
  const read = (columns: string) =>
    admin.from("challenges").select(columns).eq("game_id", sourceGameId) as unknown as PromiseLike<{
      data: SourceChallenge[] | null
      error: { code?: string } | null
    }>
  let { data, error } = await read(`${SOURCE_COLUMNS}, accepted_answer_hashes`)
  // A database without 20261107100000 has no extra answers to copy.
  if (error?.code === "42703") ({ data, error } = await read(SOURCE_COLUMNS))
  if (error || !data) return snapshots.map(() => null)
  return matchSourceChallenges(snapshots, data)
}
