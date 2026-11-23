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
