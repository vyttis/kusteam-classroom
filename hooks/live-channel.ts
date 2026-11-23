export type LiveConnectionState = "connecting" | "live" | "degraded"

/** Fallback read while the realtime channel is down. */
export const FALLBACK_POLL_MS = 30_000
/**
 * Slow full read while the activity runs, even when the channel says it is
 * subscribed: a socket can drop events without ever reporting an error.
 */
export const SAFETY_REFETCH_MS = 45_000

export interface ChannelStatusAction {
  /** The connection state to show, or null to leave it as it is. */
  state: LiveConnectionState | null
  /** What to do with the fallback polling. */
  polling: "start" | "stop" | null
  /** Read the whole state again: events may have been missed. */
  refetch: boolean
}

/**
 * What the live board does when the realtime channel reports a status.
 * Every SUBSCRIBED is followed by a full read. The first one too: the page
 * reads its data while the channel is still joining, and a team that joins
 * in that gap is in neither the read nor the channel (seen in the isolated
 * end-to-end run: the board said "3 komandos" but showed two cards until the
 * slow safety read). Later ones follow a gap in the connection.
 * `subscribedBefore` is kept for callers that tell the two cases apart.
 * CLOSED counts as a failure: the channel no longer delivers anything.
 */
export function channelStatusAction(status: string, subscribedBefore: boolean): ChannelStatusAction {
  void subscribedBefore
  if (status === "SUBSCRIBED") {
    return { state: "live", polling: "stop", refetch: true }
  }
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
    return { state: "degraded", polling: "start", refetch: false }
  }
  return { state: null, polling: null, refetch: false }
}

/**
 * True for the realtime "system" message that says the server now streams
 * database changes to this channel. SUBSCRIBED only means the channel was
 * joined; the database part is set up a moment later, and a row written in
 * between is delivered to nobody. A full read after this message closes
 * that gap (seen in the isolated end-to-end run with a cold realtime
 * service: a team that joined right after the activity started was missing
 * from the board until the slow safety read).
 */
export function isDatabaseStreamReady(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false
  const p = payload as { extension?: unknown; status?: unknown }
  return p.extension === "postgres_changes" && p.status === "ok"
}

export interface RecentRow<T> {
  row: T
  /** When the realtime event reached this page (Date.now()). */
  at: number
}

/**
 * The rows of a full read, plus rows that realtime delivered after the read
 * was started and that the read does not hold. A read is a snapshot from
 * the moment it was sent: a team that joined while it was on its way came
 * over realtime first, and replacing the list with the older snapshot
 * would drop that team again.
 */
export function mergeRowsAfterRead<T extends { id: string }>(
  read: T[],
  recent: Iterable<RecentRow<T>>,
  readStartedAt: number,
): T[] {
  const ids = new Set(read.map((r) => r.id))
  const extra: T[] = []
  for (const r of recent) {
    if (r.at >= readStartedAt && !ids.has(r.row.id)) extra.push(r.row)
  }
  return extra.length ? [...read, ...extra] : read
}
