import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Gives realtime the signed-in user's token before a channel is joined.
 *
 * A channel joined right after the page loads can go out before the client
 * has read the session: it then joins with no token, as `anon`. Since
 * 20261107120000 `anon` cannot read activities, so realtime refuses the
 * subscription outright ("invalid column for filter") and never retries.
 * Seen in production on the facilitator's live page: the activity status
 * and announcement channels were refused, while channels that happened to
 * be joined a moment later worked.
 *
 * Never throws: without a session the channel joins as before.
 */
export async function realtimeSignedIn(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.realtime.setAuth()
  } catch {
    // Joining without a token is what happened before; nothing to add.
  }
}
