"use client"

import { useCallback, useMemo, useState } from "react"

/** Where the facilitator signs in again. Opened in a new tab (see the notice). */
export const SIGN_IN_PATH = "/vedejui"

/** The server answered that nobody is signed in: the session has ended. */
export function isSessionExpired(res: { status: number }): boolean {
  return res.status === 401
}

/**
 * Tracks a session that ended while the facilitator was working. Pass every
 * save response through `check`: on 401 it returns true and `expired` stays
 * set, so the screen can show SessionExpiredNotice instead of a bare error
 * toast, keep the form as it is and let the save be repeated after signing in
 * in another tab. Any other answer means the session works, and clears it.
 */
export function useSessionExpired() {
  const [expired, setExpired] = useState(false)
  const check = useCallback((res: { status: number }): boolean => {
    const ended = isSessionExpired(res)
    setExpired(ended)
    return ended
  }, [])
  const clear = useCallback(() => setExpired(false), [])
  return useMemo(() => ({ expired, check, clear }), [expired, check, clear])
}
