"use client"

import { realtimeSignedIn } from "@/lib/supabase/realtime-auth"
import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import { Megaphone, X } from "lucide-react"

export interface AnnouncementItem {
  id: string
  message: string
  created_at: string
}

interface AnnouncementBannerProps {
  /** The activity. Needed on the facilitator's screen; participants' pages pass `latest`. */
  gameId?: string
  /** "projector": large text for the class screen. */
  variant?: "default" | "projector"
  /**
   * Participants: the latest fresh announcement from the page's status
   * poll (/api/play/status). They cannot read announcements with the anon
   * key (20261107120000), so the banner then makes no Supabase reads. It
   * stays until the participant closes it: a phone that was locked or in a
   * pocket must not miss it.
   * Leave it out on the facilitator's screen, which reads its own
   * activity's announcements and gets them in real time.
   */
  latest?: AnnouncementItem | null
}

// Facilitator's screen only (the class projector, where nobody closes it).
const AUTO_DISMISS_MS = 15000
// On mount, show the latest announcement if it's still fresh — students who
// reload or join late would otherwise never see it (realtime only delivers
// INSERTs that happen while subscribed).
const RECENT_WINDOW_MS = 2 * 60 * 1000

/** sessionStorage key under which a closed announcement is remembered. */
export function closedAnnouncementKey(announcementId: string): string {
  return `ctf_announcement_closed_${announcementId}`
}

/** Closed in this tab before: it does not come back on a reload or another page. */
export function wasAnnouncementClosed(announcementId: string): boolean {
  try {
    return sessionStorage.getItem(closedAnnouncementKey(announcementId)) === "1"
  } catch {
    // Storage unavailable: worst case the banner reappears.
    return false
  }
}

export function rememberAnnouncementClosed(announcementId: string): void {
  try {
    sessionStorage.setItem(closedAnnouncementKey(announcementId), "1")
  } catch {
    // Storage unavailable: worst case the banner reappears.
  }
}

/** When the announcement was sent, e.g. "10:42": it may be read minutes later. */
export function announcementTime(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius" })
}

export function AnnouncementBanner({ gameId, variant = "default", latest }: AnnouncementBannerProps) {
  const large = variant === "projector"
  const fromPoll = latest !== undefined
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<AnnouncementItem | null>(null)
  // The last announcement shown here, so the polling below never shows the
  // same one twice (realtime and the poll may both deliver it).
  const shownIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeAnnouncement) shownIdRef.current = activeAnnouncement.id
  }, [activeAnnouncement])

  const dismiss = useCallback(() => {
    setActiveAnnouncement((current) => {
      // Remember the dismissal across remounts and reloads (e.g. leaderboard round-trip)
      if (current) rememberAnnouncementClosed(current.id)
      return null
    })
  }, [])

  // Participants: show what the status poll delivers, once, unless it was
  // closed here before (the server sends only fresh ones).
  const latestId = latest?.id ?? null
  useEffect(() => {
    if (!fromPoll || !latest) return
    if (!wasAnnouncementClosed(latest.id) && latest.id !== shownIdRef.current) setActiveAnnouncement(latest)
    // Only a new announcement matters, not a new object for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPoll, latestId])

  // Facilitator's screen: the latest recent announcement on load (missed
  // while not subscribed) and every 15 s, because some school networks block
  // the realtime WebSocket and the announcement would otherwise never arrive.
  useEffect(() => {
    if (fromPoll || !gameId) return
    const supabase = createClient()
    let cancelled = false

    async function fetchLatest() {
      const { data } = await supabase
        .from("announcements")
        .select("id, message, created_at")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled || !data) return
      const age = Date.now() - new Date(data.created_at).getTime()
      if (age < RECENT_WINDOW_MS && !wasAnnouncementClosed(data.id) && data.id !== shownIdRef.current) {
        setActiveAnnouncement(data)
      }
    }

    void fetchLatest()
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void fetchLatest()
    }, 15_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [gameId, fromPoll])

  // Auto-dismiss timer: the facilitator's screen only. A participant's
  // banner stays until it is closed.
  useEffect(() => {
    if (fromPoll || !activeAnnouncement) return

    const timer = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [fromPoll, activeAnnouncement, dismiss])

  // Facilitator's screen: realtime announcements of their own activity
  useEffect(() => {
    if (fromPoll || !gameId) return
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    // Join only once realtime has the facilitator's token (realtimeSignedIn).
    realtimeSignedIn(supabase).then(() => {
      if (cancelled) return
      channel = supabase
      .channel(`player_announcements_${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "announcements",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const announcement = payload.new as AnnouncementItem
          if (announcement.id === shownIdRef.current) return
          setActiveAnnouncement(announcement)
        }
      )
      .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [gameId, fromPoll])

  const sentAt = activeAnnouncement && !large ? announcementTime(activeAnnouncement.created_at) : ""

  // The live region is always in the page, so a screen reader announces the
  // message when it appears. In-flow (sticky) instead of fixed: a fixed
  // banner covered the header row (game code, points and the countdown).
  return (
    <div role="status" aria-live="polite" className="sticky top-2 z-50">
      <AnimatePresence>
        {activeAnnouncement && (
          <motion.div
            key={activeAnnouncement.id}
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="mb-3"
          >
            {/* White on secondary-ink is 5.67:1 (on secondary it was 3.9:1). */}
            <div className="bg-secondary-ink text-white shadow-lg rounded-xl text-left">
              <div className={large ? "flex items-start gap-4 px-6 py-5" : "max-w-2xl mx-auto px-4 py-3 flex items-start gap-3"}>
                <Megaphone className={large ? "h-8 w-8 shrink-0" : "h-5 w-5 shrink-0 mt-0.5"} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className={large ? "text-2xl font-semibold leading-snug" : "text-sm font-medium leading-snug break-words"}>
                    <span className="sr-only">Vedėjo pranešimas: </span>
                    {activeAnnouncement.message}
                  </p>
                  {sentAt && <p className="mt-0.5 text-xs">Išsiųsta {sentAt}</p>}
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  aria-label="Uždaryti pranešimą"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
