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
 * `subscribedBefore` is true once the channel has been SUBSCRIBED at least
 * once: every later SUBSCRIBED follows a gap, and what happened during the
 * gap never arrives over the channel, so it is read again.
 * CLOSED counts as a failure: the channel no longer delivers anything.
 */
export function channelStatusAction(status: string, subscribedBefore: boolean): ChannelStatusAction {
  if (status === "SUBSCRIBED") {
    return { state: "live", polling: "stop", refetch: subscribedBefore }
  }
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
    return { state: "degraded", polling: "start", refetch: false }
  }
  return { state: null, polling: null, refetch: false }
}
